// 主库
import fetch from "node-fetch";
import fs from "node:fs";
import { segment } from "oicq";
// 其他库
import md5 from "md5";
import axios from "axios";
import _ from 'lodash'
import { mkdirsSync } from '../utils/file.js'
import { downloadBFile, getDownloadUrl, mergeFileToMp4 } from '../utils/bilibili.js'
import { get, remove, add } from "../utils/redisu.js";

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
                    reg: "(.*)(www.tiktok.com)|(vt.tiktok.com)",
                    fnc: "tiktok",
                },
                {
                    reg: "(.*)(bilibili.com|b23.tv)",
                    fnc: "bili",
                },
                {
                    reg: "^#(wiki|百科)(.*)$",
                    fnc: "wiki",
                },
            ],
        });
        // 视频保存路径
        this.defaultPath = `./data/rcmp4/`
        // redis的key
        this.redisKey = `Yz:tools:cache:${ this.group_id }`
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
        const urlShortRex = /(http:|https:)\/\/vt.tiktok.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = e.msg.trim()
        // 短号处理
        if (url.includes('vt.tiktok')) {
            url = urlShortRex.exec(url)[0]
        } else {
            url = urlRex.exec(url)[0]
        }

        const tiktokApi = `https://api.douyin.wtf/api?url=${ url }&minimal=true`;
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

    // bilibi解析
    async bili (e) {
        const urlRex = /(http:|https:)\/\/www.bilibili.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const bShortRex = /(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = e.msg.trim()
        // 短号处理
        if (url.includes('b23.tv')) {
            const bShortUrl = bShortRex.exec(url)[0]
            await this.douyinRequest(bShortUrl).then((res) => {
                url = res.replace("m", "www")
            });
        } else {
            url = urlRex.exec(url)[0];
        }

        const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp`
        // 待优化
        if (fs.existsSync(`${ path }.mp4`)) {
            console.log("视频已存在");
            fs.unlinkSync(`${ path }.mp4`);
        }
        e.reply('识别：哔哩哔哩，解析中...')
        await getDownloadUrl(url)
            .then(data => {
                this.downBili(path, data.videoUrl, data.audioUrl)
                    .then(data => {
                        e.reply(segment.video(`${ path }.mp4`))
                    })
                    .catch(data => {
                        e.reply('解析失败，请重试一下')
                    });
            })
            .catch(err => {
                e.reply('解析失败，请重试一下')
            });
        return true
    }

    // 百科
    async wiki (e) {
        const key = e.msg.replace(/#|百科|wiki/g, "").trim();
        const url = `https://xiaoapi.cn/API/bk.php?m=json&type=bd&msg=${ encodeURI(key) }`
        const url2 = 'https://api.jikipedia.com/go/auto_complete'
        Promise.all([
            axios.post(url2, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    "Content-Type": "application/json",
                },
                timeout: 10000,
                "phrase": key,
            })
                .then(resp => {
                    const data = resp.data.data
                    if (_.isEmpty(data)) {
                        return data;
                    }
                    return data[0].entities[0];
                }),
            axios.get(url, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                timeout: 10000,
            })
                .then(resp => {
                    return resp.data
                })
        ])
            .then(res => {
                const data = res[1]
                const data2 = res[0]
                const template = `
                      解释：${ _.isUndefined(data.msg) ? '暂无' : data.msg }\n
                      详情：${ _.isUndefined(data.more) ? '暂无' : data.more }\n
                      小鸡解释：${ _.isUndefined(data2.content) ? '暂无' : data2.content }
                    `;
                e.reply(template)
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

    // 工具：根URL据下载视频 / 音频
    async downloadVideo (url) {
        if (!fs.existsSync(this.defaultPath)) {
            mkdirsSync(this.defaultPath);
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

    // 工具：下载哔哩哔哩
    async downBili (title, videoUrl, audioUrl) {
        return Promise.all([
            downloadBFile(
                videoUrl,
                title + '-video.m4s',
                _.throttle(
                    value =>
                        console.log('download-progress', {
                            type: 'video',
                            data: value,
                        }),
                    1000,
                ),
            ),
            downloadBFile(
                audioUrl,
                title + '-audio.m4s',
                _.throttle(
                    value =>
                        console.log('download-progress', {
                            type: 'audio',
                            data: value,
                        }),
                    1000,
                ),
            ),
        ])
            .then(data => {
                return mergeFileToMp4(data[0].fullFileName, data[1].fullFileName, title + '.mp4');
            })
    }
}
