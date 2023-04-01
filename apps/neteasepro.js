import plugin from "../../../lib/plugins/plugin.js";
import axios from "axios";
import fs from "node:fs";
import {
    checkMusic,
    getCookies,
    getDailyRecommend,
    getKey,
    getLoginStatus,
    getQrCode,
    getSong,
    getSongDetail,
    getUserRecord,
    getCloud,
    getCloudMusicDetail,
} from "../utils/netease.js";
import { ha12store, store2ha1 } from "../utils/encrypt.js";
import { downloadMp3 } from "../utils/common.js";
import _ from "lodash";

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
                    reg: "^#网易云登录$",
                    /** 执行方法 */
                    fnc: "neteaseCloudLogin",
                },
                {
                    reg: "^#网易云每日推荐$",
                    fnc: "neteaseDailyRecommend",
                },
                {
                    reg: "^#网易云听歌排行$",
                    fnc: "neteaseListenRank",
                },
                {
                    reg: "^#网易云云盘$",
                    fnc: "neteaseCloud",
                },
                {
                    reg: "^#网易云云盘下载(.*)",
                    fnc: "neteaseCloudDownload",
                },
                {
                    reg: "^#网易云云盘(.*)",
                    fnc: "neteaseCloudApplet",
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
            const userData = await redis.get(await this.getRedisKey(e.user_id));
            // 如果cookie存在但是为空
            if (_.isEmpty(userData)) {
                await redis.del(await this.getRedisKey(e.user_id));
                e.reply("发生已知错误：cookie为空，请重试 #网易云登录 即可！");
                return;
            }
            // 已经登陆过的，直接从redis取出
            neteaseCookie = await store2ha1(JSON.parse(userData).cookie);
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
        const combineMsg = await dailyRecommend.dailySongs.map(async item => {
            // 组合数据
            return {
                message: segment.json(await this.musicPack(item)),
                nickname: e.sender.card || e.user_id,
                user_id: e.user_id,
            };
        });
        let forwardMsg = await Bot.makeForwardMsg(await Promise.all(combineMsg));
        await e.reply(await this.musicForwardPack(forwardMsg));
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
        e.reply(" 😘亲，这是你的听歌排行榜Top10");
        //  由于数据过大，取前10
        const rank = userRecord.weekData.slice(0, 10).map(async item => {
            // 组合数据
            const song = item.song;
            return {
                message: segment.json(await this.musicPack(song)),
                nickname: e.sender.card || e.user_id,
                user_id: e.user_id,
            };
        });
        let forwardMsg = await Bot.makeForwardMsg(await Promise.all(rank));
        await e.reply(await this.musicForwardPack(forwardMsg));
    }

    async neteaseCloud(e) {
        const userInfo = await this.aopBefore(e);
        const realCookie = userInfo.cookie;
        if (realCookie === "") {
            return true;
        }
        const cloudMusics = await (
            await getCloud(realCookie)
        ).map(item => {
            return {
                message: `${item.songId}: ${item?.songName??"暂无歌曲信息"}-${item?.artist??"暂无歌手信息"}`,
                nickname: e.sender.card || e.user_id,
                user_id: e.user_id,
            }
        });
        // 获取用户信息
        const { profile } = await getLoginStatus(realCookie);
        e.reply(`<${profile.nickname}> 的网易云云盘`);
        e.reply(await Bot.makeForwardMsg(cloudMusics));
        return true;
    }

    async neteaseCloudDownload(e) {
        const id = e.msg.replace("#网易云云盘下载", "").trim();
        const userInfo = await this.aopBefore(e);
        const realCookie = userInfo.cookie;
        if (realCookie === "") {
            return true;
        }
        const music = (await getSong(id, realCookie))[0];
        const item = (await getCloudMusicDetail(id, realCookie)).data[0];
        const simpleSong = item.simpleSong;
        e.reply([
            segment.image(simpleSong?.al?.picUrl),
            `识别：云盘音乐，${simpleSong?.name}-${simpleSong?.al?.name}`,
        ]);
        const downloadPath = `./data/rcmp4/${this.e.group_id || this.e.user_id}`;
        await downloadMp3(music.url, downloadPath)
            .then(path => {
                Bot.acquireGfs(e.group_id).upload(
                    fs.readFileSync(path),
                    "/",
                    `${simpleSong?.name}.mp3`,
                );
            })
            .catch(err => {
                console.error(`下载音乐失败，错误信息为: ${err.message}`);
            });
        return true;
    }

    async neteaseCloudApplet(e) {
        const id = e.msg.replace("#网易云云盘", "").trim();
        logger.mark(id);
        const userInfo = await this.aopBefore(e);
        const realCookie = userInfo.cookie;
        if (realCookie === "") {
            return true;
        }
        const music = (await getSong(id, realCookie))[0];
        const item = (await getCloudMusicDetail(id, realCookie)).data[0];
        const appletMusic = {
            message: segment.json(await this.cloudMusicPack(item, music.url)),
            nickname: e.sender.card || e.user_id,
            user_id: e.user_id,
        };
        let forwardMsg = await Bot.makeForwardMsg(appletMusic);
        await e.reply(await this.musicForwardPack(forwardMsg));
    }

    async netease(e) {
        const message =
            e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim();
        const musicUrlReg = /(http:|https:)\/\/music.163.com\/song\/media\/outer\/url\?id=(\d+)/;
        const musicUrlReg2 = /(http:|https:)\/\/y.music.163.com\/m\/song\?(.*)&id=(\d+)/;
        const id =
            musicUrlReg2.exec(message)?.[3] ||
            musicUrlReg.exec(message)?.[2] ||
            /id=(\d+)/.exec(message)[1];
        const downloadPath = `./data/rcmp4/${this.e.group_id || this.e.user_id}`;
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
                    const song = res.songs?.[0];
                    return song.length > 0
                        ? `${song?.name}-${song?.ar?.[0].name}`.replace(/[\/\?<>\\:\*\|".… ]/g, "")
                        : "暂无信息";
                });
                e.reply(`识别：网易云音乐，${title}`);
            }
            // 下载游客歌曲
            downloadMp3(
                `https://music.163.com/song/media/outer/url?id=${id}`,
                downloadPath,
                "follow",
            )
                .then(path => {
                    Bot.acquireGfs(e.group_id).upload(fs.readFileSync(path), "/", `${id}.mp3`);
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
        await downloadMp3(userDownloadUrl, downloadPath)
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
        const userDataJson = await redis.get(await this.getRedisKey(e.user_id));
        // 如果不存在cookie
        if (_.isEmpty(userDataJson)) {
            e.reply("请先#网易云登录");
            return "";
        }
        let userData = JSON.parse(userDataJson);
        const cookie = userData?.cookie;
        logger.mark(cookie);
        // 解析cookie
        userData.cookie = await store2ha1(cookie);
        // 检查cookie是否可用
        const userInfo = await getLoginStatus(userData.cookie);
        logger.mark(userData);
        if (_.isNil(userInfo.profile)) {
            e.reply("cookie已经过期，请重新#网易云登录！");
            // 删除过期的cookie
            await redis.del(await this.getRedisKey(e.user_id));
            return "";
        }
        // 没有过期直接返回
        return userData;
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

    async cloudMusicPack(item, url) {
        return {
            app: "com.tencent.structmsg",
            desc: "音乐",
            view: "music",
            ver: "0.0.0.1",
            prompt: "[分享]" + item.songName + "-" + item.album,
            meta: {
                music: {
                    app_type: 1,
                    appid: 100495085,
                    desc: item.artist,
                    jumpUrl: `https://y.music.163.com/m/song?id=${item.songId}`,
                    musicUrl: url,
                    preview: "https://i.gtimg.cn/open/app_icon/00/49/50/85/100495085_100_m.png",
                    sourceMsgId: "0",
                    source_icon: "https://i.gtimg.cn/open/app_icon/00/49/50/85/100495085_100_m.png",
                    source_url: "",
                    tag: "网易云音乐",
                    title: item.fileName,
                },
            },
            config: {
                type: "normal",
                forward: true,
                ctime: Date.now(),
            },
        };
    }

    // 包装分享小程序数据
    async musicPack(song) {
        const title = song.name;
        const singer = song.ar?.[0]?.name;
        const jumpUrl = `https://y.music.163.com/m/song?id=${song.id}`;
        const preview = song.al?.picUrl;
        const musicUrl = `https://music.163.com/song/media/outer/url?id=${song.id}.mp3`;
        return {
            app: "com.tencent.structmsg",
            desc: "音乐",
            view: "music",
            ver: "0.0.0.1",
            prompt: "[分享]" + title + "-" + singer,
            meta: {
                music: {
                    app_type: 1,
                    appid: 100495085,
                    desc: singer,
                    jumpUrl: jumpUrl,
                    musicUrl: musicUrl,
                    preview: preview,
                    sourceMsgId: "0",
                    source_icon: "https://i.gtimg.cn/open/app_icon/00/49/50/85/100495085_100_m.png",
                    source_url: "",
                    tag: "网易云音乐",
                    title: title,
                },
            },
            config: {
                type: "normal",
                forward: true,
                ctime: Date.now(),
            },
        };
    }

    async musicForwardPack(forwardMsg, forwardMsgName = "R插件消息") {
        forwardMsg.data = forwardMsg.data
            .replace(
                '<?xml version="1.0" encoding="utf-8"?>',
                '<?xml version="1.0" encoding="utf-8" ?>',
            )
            .replace(/\n/g, "")
            .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, "___")
            .replace(/___+/, `<title color="#777777" size="26">${forwardMsgName}</title>`);
        return forwardMsg;
    }

    // 获取redis的key
    async getRedisKey(user_id) {
        return `Yz:rconsole:netease:${user_id}`;
    }
}
