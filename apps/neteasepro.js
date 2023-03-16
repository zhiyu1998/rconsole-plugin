import plugin from "../../../lib/plugins/plugin.js";
import axios from "axios";
import fs from "node:fs";
import { segment } from "oicq";
import {
    getQrCode,
    getKey,
    getLoginStatus,
    getDailyRecommend,
    getCookies,
    getUserRecord,
    checkMusic,
    getSong,
    getSongDetail,
} from "../utils/netease.js";
import { ha12store, store2ha1 } from "../utils/encrypt.js";
import fetch from "node-fetch";

export class neteasepro extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "R插件网易云音乐解析",
            /** 功能描述 */
            dsc: "网易云音乐解析Pro",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 500,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: "#网易云登陆",
                    /** 执行方法 */
                    fnc: "neteaseCloudLogin",
                },
                {
                    reg: "#网易云每日推荐",
                    fnc: "neteaseDailyRecommend",
                },
                {
                    reg: "#网易云听歌排行",
                    fnc: "neteaseListenRank",
                },
                {
                    reg: "music.163.com",
                    fnc: "netease",
                },
            ],
        });
    }

    async neteaseCloudLogin(e) {
        let neteaseCookie;
        // 如果不存在cookie
        if (!(await redis.exists(await this.getRedisKey(e.user_id)))) {
            // 获取密钥
            const key = await getKey();
            // console.log(key);
            // 获取二维码
            const qrPic = await getQrCode(key);
            // 下载qrcode
            await this.downloadQrCode(qrPic).then(path => {
                // 发送二维码
                e.reply(segment.image(fs.readFileSync(path)));
            });
            // 定时轮询
            await this.poll(key).then(async cookie => {
                // 存放到redis
                neteaseCookie = cookie;
            });
        } else {
            // 已经登陆过的，直接从redis取出
            neteaseCookie = await store2ha1(
                JSON.parse(await redis.get(await this.getRedisKey(e.user_id))).cookie,
            );
        }
        // 获取用户信息
        const userInfo = await getLoginStatus(neteaseCookie);
        // 提取信息
        const { userId, nickname, avatarUrl } = userInfo.profile;
        e.reply(["欢迎使用 🎶网易云音乐 🎶，" + nickname, segment.image(avatarUrl)]);
        // 重组后存放到redis {uid, cookie}
        await redis.set(
            await this.getRedisKey(e.user_id),
            JSON.stringify({
                uid: userId,
                cookie: await ha12store(neteaseCookie),
            }),
        );
        return true;
    }

    async neteaseDailyRecommend(e) {
        const realCookie = (await this.aopBefore(e)).cookie;
        if (realCookie === "") {
            return true;
        }
        // 获取每日推荐所有数据
        const dailyRecommend = await getDailyRecommend(realCookie);
        //  由于数据过大，取前10
        const combineMsg = await dailyRecommend.dailySongs.slice(0, 10).map(item => {
            // 组合数据
            return {
                message: [
                    segment.text(
                        `${item?.id}: ${item?.name}-${item?.ar?.[0].name}-${item?.al?.name}`,
                    ),
                    segment.image(item?.al?.picUrl),
                ],
                nickname: e.sender.card || e.user_id,
                user_id: e.user_id,
            };
        });
        await e.reply(await Bot.makeForwardMsg(combineMsg));
    }

    async neteaseListenRank(e) {
        const userInfo = await this.aopBefore(e);
        const realCookie = userInfo.cookie;
        if (realCookie === "") {
            return true;
        }
        // 获取用户id
        const uid = userInfo.uid;
        // 获取听歌排行榜
        const userRecord = await getUserRecord(uid);
        let rankId = 0;
        e.reply(" 😘亲，这是你的听歌排行榜Top10");
        const rank = userRecord.weekData.slice(0, 10).map(item => {
            // 组合数据
            const song = item.song;
            rankId++;
            return {
                message: [
                    segment.text(
                        `No.${rankId} ${song?.id}: ${song?.name}-${song?.ar?.[0].name}-${song?.al?.name}`,
                    ),
                    segment.image(song?.al?.picUrl),
                ],
                nickname: e.sender.card || e.user_id,
                user_id: e.user_id,
            };
        });
        await e.reply(await Bot.makeForwardMsg(rank));
    }

    async netease(e) {
        const message =
            e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim();
        const musicUrlReg = /(http:|https:)\/\/music.163.com\/song\/media\/outer\/url\?id=(\d+)/;
        const musicUrlReg2 = /(http:|https:)\/\/y.music.163.com\/m\/song\?(.*)&id=(\d+)/;
        const id =
            musicUrlReg2.exec(message)[3] ||
            musicUrlReg.exec(message)[2] ||
            /id=(\d+)/.exec(message)[1];
        // 是游客
        if (!(await redis.get(await this.getRedisKey(e.user_id)))) {
            // 是小程序
            if (await this.isJSON(message)) {
                const musicJson = JSON.parse(message);
                const { preview, title, desc } = musicJson.meta.music || musicJson.meta.news;
                // console.log(musicUrl, preview, title, desc);
                // 如果没有登陆，就使用官方接口
                e.reply([`识别：网易云音乐，${title}--${desc}`, segment.image(preview)]);
            } else {
                // 非小程序
                const title = await getSongDetail(id).then(res => {
                    const song = res?.songs[0];
                    return song.length > 0 ? `${song?.name}-${song?.ar?.[0].name}`.replace(/[\/\?<>\\:\*\|".… ]/g, "") : "暂无信息";
                });
                e.reply(`识别：网易云音乐，${title}`);
            }
            // 下载游客歌曲
            this.downloadMp3(`https://music.163.com/song/media/outer/url?id=${id}`, "follow")
                .then(path => {
                    Bot.acquireGfs(e.group_id).upload(
                        fs.readFileSync(path),
                        "/",
                        `${id}.mp3`,
                    );
                })
                .catch(err => {
                    console.error(`下载音乐失败，错误信息为: ${err.message}`);
                });
            return true;
        }
        // 检查当前歌曲是否可用
        const checkOne = await checkMusic(id);
        if (checkOne.success === "false") {
            e.reply(checkOne.message);
            return true;
        }
        const userInfo = await this.aopBefore(e);
        // 可用，开始下载
        const userDownloadUrl = (await getSong(id, await userInfo.cookie))[0].url;
        const title = await getSongDetail(id).then(res => {
            const song = res.songs[0];
            return `${song?.name}-${song?.ar?.[0].name}`.replace(/[\/\?<>\\:\*\|".… ]/g, "");
        });
        await this.downloadMp3(userDownloadUrl)
            .then(path => {
                Bot.acquireGfs(e.group_id).upload(fs.readFileSync(path), "/", `${title}.mp3`);
            })
            .catch(err => {
                console.error(`下载音乐失败，错误信息为: ${err.message}`);
            });
        return true;
    }

    // 切面方法检测cookie & 获取cookie和uid
    async aopBefore(e) {
        // 取出cookie
        let userInfo = JSON.parse(await redis.get(await this.getRedisKey(e.user_id)));
        const cookie = userInfo.cookie;
        // 如果不存在cookie
        if (!cookie) {
            e.reply("请先#网易云登录");
            return "";
        }
        // 解析cookie
        userInfo.cookie = store2ha1(cookie);
        return userInfo;
    }

    // 下载二维码
    async downloadQrCode(qrPic) {
        return axios
            .get(qrPic, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                responseType: "stream",
            })
            .then(resp => {
                const filepath = "./netease_qr.jpg";
                const writer = fs.createWriteStream(filepath);
                resp.data.pipe(writer);
                return new Promise((resolve, reject) => {
                    writer.on("finish", () => resolve(filepath));
                    writer.on("error", reject);
                });
            });
    }

    // 判断是否是json的字符串
    async isJSON(str) {
        if (typeof str !== "string") {
            return false;
        }
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    // 定时轮询
    async poll(key) {
        let timer;
        return new Promise((resolve, reject) => {
            timer = setInterval(async () => {
                const statusRes = await getCookies(key);
                // console.log(statusRes);
                if (statusRes.code === 800) {
                    clearInterval(timer);
                    reject("二维码已过期,请重新获取");
                }
                if (statusRes.code === 803) {
                    // 这一步会返回cookie
                    clearInterval(timer);
                    const cookie = statusRes.cookie;
                    resolve(
                        /__csrf=[0-9a-z]+;/.exec(cookie)[0] + /MUSIC_U=[0-9a-z]+;/.exec(cookie)[0],
                    );
                }
            }, 3000);
        });
    }

    /**
     * 下载mp3
     * @param mp3Url
     * @param redirect
     * @returns {Promise<unknown>}
     */
    async downloadMp3(mp3Url, redirect = "manual") {
        return fetch(mp3Url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
            },
            responseType: "stream",
            redirect: redirect,
        }).then(res => {
            const path = `./data/rcmp4/${this.e.group_id || this.e.user_id}/temp.mp3`;
            const fileStream = fs.createWriteStream(path);
            res.body.pipe(fileStream);
            return new Promise((resolve, reject) => {
                fileStream.on("finish", () => {
                    fileStream.close(() => {
                        resolve(path);
                    });
                });
                fileStream.on("error", err => {
                    fs.unlink(path, () => {
                        reject(err);
                    });
                });
            });
        });
    }

    // 获取redis的key
    async getRedisKey(user_id) {
        return `Yz:rconsole:netease:${user_id}`;
    }
}
