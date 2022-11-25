// 主库
import fetch from "node-fetch";
import fs from "node:fs";
import { segment } from "oicq";
// 其他库
import md5 from "md5";
import axios from "axios";
import path from 'path'

export class tools extends plugin {
    constructor () {
        super({
            name: "工具和学习类",
            dsc: "工具相关指令",
            event: "message.group",
            priority: 500,
            rule: [
                {
                    reg: "^#(翻译)(.*)$",
                    fnc: "trans",
                },
                {
                    reg: "(.*)(v.douyin.com)",
                    fnc: "douyin",
                },
                {
                    reg: "(.*)(www.tiktok.com)",
                    fnc: "tiktok",
                },
            ],
        });
        this.defaultPath = `./data/rcmp4/`
    }

    // 翻译插件
    async trans (e) {
        let place = e.msg.replace(/#|翻译/g, "").trim();
        let url = /[\u4E00-\u9FFF]+/g.test(place)
            ? `http://api.fanyi.baidu.com/api/trans/vip/translate?from=zh&to=en&appid=20210422000794040&salt=542716863&sign=${ md5(
                "20210422000794040" + place + "542716863" + "HooD_ndgwcGH6SAnxGrM"
            ) }&q=${ place }`
            : `http://api.fanyi.baidu.com/api/trans/vip/translate?from=en&to=zh&appid=20210422000794040&salt=542716863&sign=${ md5(
                "20210422000794040" + place + "542716863" + "HooD_ndgwcGH6SAnxGrM"
            ) }&q=${ place }`;
        await fetch(url)
            .then((resp) => resp.json())
            .then((text) => text.trans_result)
            .then((res) => this.reply(`${ res[0].dst }`, true))
            .catch((err) => logger.error(err));
        return true;
    }

    // 抖音解析
    async douyin (e) {
        const urlRex = /(http:|https:)\/\/v.douyin.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const douUrl = urlRex.exec(e.msg.trim())[0];
        e.reply("识别：抖音, 解析中...");

        await this.douyinRequest(douUrl).then((res) => {
            const douRex = /.*video\/(\d+)\/(.*?)/g;
            const douId = douRex.exec(res)[1];
            const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${ douId }`;
            return fetch(url)
                .then((resp) => resp.json())
                .then((json) => json.item_list[0])
                .then((item) => item.video.play_addr.url_list[0])
                .then((url) => {
                    this.downloadVideo(url).then(video => {
                        e.reply(segment.video(`${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp.mp4`));
                    })
                });
        });
        return true;
    }

    // tiktok解析
    async tiktok (e) {
        const urlRex = /(http:|https:)\/\/www.tiktok.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const url = urlRex.exec(e.msg.trim())[0]

        const tiktokApi = `https://api.douyin.wtf/api?url=${ url }&minimal=true`
        e.reply("识别：tiktok, 解析中...");
        fetch(tiktokApi)
            .then(resp => resp.json())
            .then(json => {
                this.downloadVideo(json.wm_video_url.replace("https", "http")).then(video => {
                    e.reply(segment.video(`${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp.mp4`))
                })
            })
        return true
    }

    // 请求参数
    async douyinRequest (url) {
        const params = {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
            },
            timeout: 10000,
        };
        return new Promise((resolve, reject) => {
            axios
                .head(url, params)
                .then((resp) => {
                    const location = resp.request.res.responseUrl
                    resolve(location);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    // 根URL据下载视频 / 音频
    async downloadVideo (url) {
        if (!fs.existsSync(this.defaultPath)) {
            this.mkdirsSync(this.defaultPath);
        }
        const target = this.defaultPath + `${ this.e.group_id || this.e.user_id }/temp.mp4`
        // 待优化
        if (fs.existsSync(target)) {
            console.log(`视频已存在`);
            fs.unlinkSync(target);
        }
        const res = await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
            },
            responseType: "stream",
        });
        console.log(`开始下载: ${ url }`);
        const writer = fs.createWriteStream(target);
        res.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });
    }

    // 同步递归创建文件夹
    mkdirsSync (dirname) {
        if (fs.existsSync(dirname)) {
            return true;
        } else {
            if (this.mkdirsSync(path.dirname(dirname))) {
                fs.mkdirSync(dirname);
                return true;
            }
        }
    }

    // 递归创建目录 异步方法
    mkdirs (dirname, callback) {
        fs.exists(dirname, function (exists) {
            if (exists) {
                callback();
            } else {
                // console.log(path.dirname(dirname));
                this.mkdirs(path.dirname(dirname), function () {
                    fs.mkdir(dirname, callback);
                });
            }
        });
    }
}
