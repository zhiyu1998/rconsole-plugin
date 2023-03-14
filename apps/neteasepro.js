import plugin from "../../../lib/plugins/plugin.js";
import axios from "axios";
import fs from 'node:fs';
import {segment} from "oicq";
import {getQrCode, getKey, getLoginStatus, getDailyRecommend, getCookies} from '../utils/netease.js';
import {ha12store, store2ha1} from '../utils/encrypt.js';


export class neteasepro extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: 'R插件网易云音乐解析',
            /** 功能描述 */
            dsc: '网易云音乐解析Pro',
            /** https://oicqjs.github.io/oicq/#events */
            event: 'message',
            /** 优先级，数字越小等级越高 */
            priority: 1,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: '#网易云登陆',
                    /** 执行方法 */
                    fnc: 'neteaseCloudLogin'
                },
                {
                    reg: '#网易云每日推荐',
                    fnc: 'neteaseDailyRecommend'
                }
            ]
        })
    }

    async neteaseCloudLogin(e) {
        let userInfo;
        // 如果不存在cookie
        if (!await redis.exists(await this.getRedisKey(e.user_id))) {
            // 获取密钥
            const key = await getKey();
            // console.log(key);
            // 获取二维码
            const qrPic = await getQrCode(key);
            // 下载qrcode
            await this.downloadQrCode(qrPic).then(path => {
                // 发送二维码
                e.reply(segment.image(fs.readFileSync(path)))
            })
            // 定时轮询
            await this.poll(key).then(async cookie => {
                // 存放到redis
                await redis.set(await this.getRedisKey(e.user_id), ha12store(cookie))
            });
        }
        // 从redis中获取
        const realCookie = await store2ha1(await redis.get(await this.getRedisKey(e.user_id)));
        // 获取用户信息
        userInfo = await getLoginStatus(realCookie);
        // 提取信息
        const {nickname, avatarUrl} = userInfo.profile;
        e.reply(["欢迎使用 🎶网易云音乐 🎶，" + nickname, segment.image(avatarUrl)])
    }

    async neteaseDailyRecommend(e) {
        const realCookie = await this.aopBefore(e);
        if (realCookie === "") {
            return true;
        }
        // 获取每日推荐所有数据
        const dailyRecommend = await getDailyRecommend(realCookie);
        //  由于数据过大，取前10
        let combineMsg = []
        dailyRecommend.dailySongs.slice(0, 10).forEach(item => {
            combineMsg.push([`${item?.id}: ${item?.name}-${item?.ar?.[0].name}-${item?.al?.name}`, segment.image(item?.al?.picUrl)])
        })
        await e.reply(await Bot.makeForwardMsg(combineMsg));
    }

    // 切面方法检测cookie
    async aopBefore(e) {
        // 取出cookie
        const cookie = await redis.get(await this.getRedisKey(e.user_id));
        // 如果不存在cookie
        if (!cookie) {
            e.reply("请先#网易云登录");
            return "";
        }
        // 解析cookie
        return store2ha1(cookie);
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
            .then((resp) => {
                const filepath = "./netease_qr.jpg";
                const writer = fs.createWriteStream(filepath);
                resp.data.pipe(writer);
                return new Promise((resolve, reject) => {
                    writer.on("finish", () => resolve(filepath));
                    writer.on("error", reject);
                });
            });
    }

    // 定时轮询
    async poll(key) {
        let timer;
        return new Promise((resolve, reject) => {
            timer = setInterval(async () => {
                const statusRes = await getCookies(key)
                console.log(statusRes)
                if (statusRes.code === 800) {
                    clearInterval(timer)
                    reject('二维码已过期,请重新获取')
                }
                if (statusRes.code === 803) {
                    // 这一步会返回cookie
                    clearInterval(timer)
                    const cookie = statusRes.cookie;
                    resolve(/__csrf=[0-9a-z]+;/.exec(cookie)[0] + /MUSIC_U=[0-9a-z]+;/.exec(cookie)[0]);
                }
            }, 3000)
        });
    }

    // 获取redis的key
    async getRedisKey(user_id) {
        return `Yz:rconsole:netease:${user_id}`;
    }
}