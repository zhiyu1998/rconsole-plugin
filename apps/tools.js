// 主库
import fetch from "node-fetch";
import fs from "node:fs";
import { segment } from "oicq";
// 其他库
import md5 from "md5";
import axios from "axios";
import _ from "lodash";
import tunnel from "tunnel";
import { TwitterApi } from "twitter-api-v2";
import HttpProxyAgent from "https-proxy-agent";
import { mkdirsSync } from "../utils/file.js";
import { downloadBFile, getDownloadUrl, mergeFileToMp4, getDynamic } from "../utils/bilibili.js";
import { parseUrl, parseM3u8, downloadM3u8Videos, mergeAcFileToMp4 } from "../utils/acfun.js";
import { transMap, douyinTypeMap } from "../utils/constant.js";
import { retry } from "../utils/common.js";
import config from "../model/index.js";

export class tools extends plugin {
    constructor () {
        super({
            name: "工具和学习类",
            dsc: "工具相关指令",
            event: "message.group",
            priority: 500,
            rule: [
                {
                    reg: "^(翻|transl)(.) (.*)$",
                    fnc: "trans",
                },
                {
                    reg: "(.*)(v.douyin.com)",
                    fnc: "douyin",
                },
                {
                    reg: "(.*)(www.tiktok.com)|(vt.tiktok.com)|(vm.tiktok.com)",
                    fnc: "tiktok",
                },
                {
                    reg: "(.*)(bilibili.com|b23.tv|t.bilibili.com)",
                    fnc: "bili",
                },
                {
                    reg: "^#(wiki|百科)(.*)$",
                    fnc: "wiki",
                },
                {
                    reg: "(.*)(twitter.com)",
                    fnc: "twitter",
                },
                {
                    reg: "https://(m.)?v.qq.com/(.*)",
                    fnc: "tx",
                },
                {
                    reg: "(.*)(acfun.cn)",
                    fnc: "acfun",
                },
                {
                    reg: "(.*)(xhslink.com|xiaohongshu.com)",
                    fnc: "redbook",
                },
                {
                    reg: "(.*)(doi.org)",
                    fnc: "literature",
                },
            ],
        });
        // http://api.tuwei.space/girl
        // 配置文件
        this.toolsConfig = config.getConfig("tools");
        // 视频保存路径
        this.defaultPath = this.toolsConfig.defaultPath;
        // 代理接口
        // TODO 填写服务器的内网ID和clash的端口
        this.proxyAddr = this.toolsConfig.proxyAddr;
        this.proxyPort = this.toolsConfig.proxyPort;
        this.myProxy = `http://${ this.proxyAddr }:${ this.proxyPort }`;
        // console.log(this.myProxy)
        // 加载百度翻译配置
        this.translateAppId = this.toolsConfig.translateAppId;
        this.translateSecret = this.toolsConfig.translateSecret;
        // 加载twitter配置
        this.bearerToken = this.toolsConfig.bearerToken;
    }

    // 翻译插件
    async trans (e) {
        const languageReg = /翻(.)/g;
        const msg = e.msg.trim();
        const language = languageReg.exec(msg);
        if (!transMap.hasOwnProperty(language[1])) {
            e.reply(
                "输入格式有误！例子：翻中 China's policy has been consistent, but Japan chooses a path of mistrust, decoupling and military expansion"
            );
            return;
        }
        const place = msg.replace(language[0], "").trim();
        // let url = /[\u4E00-\u9FFF]+/g.test(place)
        // let url = `http://api.fanyi.baidu.com/api/trans/vip/translate?from=auto&to=${ transMap[language[1]] }&appid=APP ID&salt=自定义&sign=${ md5("APP ID" + place + "自定义" + "密钥") }&q=${ place }`;
        let url = `http://api.fanyi.baidu.com/api/trans/vip/translate?from=auto&to=${
            transMap[language[1]]
        }&appid=${ this.translateAppId }&salt=rconsole&sign=${ md5(
            this.translateAppId + place + "rconsole" + this.translateSecret
        ) }&q=${ place }`;
        // console.log(url)
        await fetch(url)
            .then(resp => resp.json())
            .then(text => text.trans_result)
            .then(res => this.reply(`${ res[0].dst }`, true))
            .catch(err => logger.error(err));
        return true;
    }

    // 抖音解析
    async douyin (e) {
        const urlRex = /(http:|https:)\/\/v.douyin.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const douUrl = urlRex.exec(e.msg.trim())[0];

        await this.douyinRequest(douUrl).then(async res => {
            const douRex = /.*video\/(\d+)\/(.*?)/g;
            const douId = douRex.exec(res)[1];
            // 且行且珍惜，下面是已经过期的两个抖音api，获取难度越来越大
            // const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${ douId }`;
            // const url = `https://www.iesdouyin.com/aweme/v1/web/aweme/detail/?aweme_id=${ douId }&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`;

            fetch("https://ttwid.bytedance.com/ttwid/union/register/", {
                "method": "POST",
                "mode": "cors",
                "credentials": 'include',
                body: JSON.stringify({
                    "region": "cn",
                    "aid": 1768,
                    "needFid": false,
                    "service": "www.ixigua.com",
                    "migrate_info": {
                        "ticket": "",
                        "source": "node"
                    },
                    "cbUrlProtocol": "https",
                    "union": true
                })
            }).then(resp => {
                const ttwid = resp.headers.get('set-cookie');
                const odin_tt = 'a09d8eb0d95b7b9adb4b6fc6591918bfb996096967a7aa4305bd81b5150a8199d2e29ed21883cdd7709c5beaa2be3baa';
                const headers = {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36',
                    'referer':'https://www.douyin.com/',
                    'Cookie': `ttwid=${ttwid};${odin_tt}`
                }
                const dyApi = 'https://www.douyin.com/aweme/v1/web/aweme/detail/?'
                const params = `aweme_id=${ douId }&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`
                // xg参数
                axios.post(`http://47.115.200.238/xg/path?url=${params.replaceAll('&','%26')}`, {
                    headers: {
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
                        "referer": "https://www.douyin.com/",
                        "cookie": ""
                    },
                }).then(resp => {
                    const param = resp.data.result[0].paramsencode
                    const resDyApi = `${dyApi}${param}`
                    axios.get(resDyApi, {
                        headers
                    }).then(async resp => {
                        const item = resp.data.aweme_detail;
                        e.reply(`识别：抖音, ${ item.desc }`);
                        const urlTypeCode = item.aweme_type;
                        const urlType = douyinTypeMap[urlTypeCode];
                        if (urlType === "video") {
                            const url_2 = item.video.play_addr.url_list[2];
                            this.downloadVideo(url_2, false, headers).then(video => {
                                e.reply(
                                    segment.video(
                                        `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp.mp4`
                                    )
                                );
                            });
                        } else if (urlType === "image") {
                            // 无水印图片列表
                            let no_watermark_image_list = [];
                            // 有水印图片列表
                            // let watermark_image_list = [];
                            for (let i of item.images) {
                                // 无水印图片列表
                                no_watermark_image_list.push({
                                    message: segment.image(i.url_list[0]),
                                    nickname: this.e.sender.card || this.e.user_id,
                                    user_id: this.e.user_id,
                                });
                                // 有水印图片列表
                                // watermark_image_list.push(i.download_url_list[0]);
                                // e.reply(segment.image(i.url_list[0]));
                            }
                            // console.log(no_watermark_image_list)
                            await this.reply(await Bot.makeForwardMsg(no_watermark_image_list));
                        }
                    })
                })
            })
        });
        return true;
    }

    // tiktok解析
    async tiktok (e) {
        const urlRex = /(http:|https:)\/\/www.tiktok.com\/[A-Za-z\d._?%&+\-=\/#@]*/g;
        const urlShortRex = /(http:|https:)\/\/vt.tiktok.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const urlShortRex2 = /(http:|https:)\/\/vm.tiktok.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = e.msg.trim();
        // 短号处理
        if (url.includes("vt.tiktok")) {
            const temp_url = urlShortRex.exec(url)[0];
            await fetch(temp_url, {
                redirect: "follow",
                follow: 10,
                timeout: 10000,
                agent: new HttpProxyAgent(this.myProxy),
            }).then(resp => {
                url = resp.url;
            });
        } else if (url.includes("vm.tiktok")) {
            const temp_url = urlShortRex2.exec(url)[0];
            await fetch(temp_url, {
                headers: { "User-Agent": "facebookexternalhit/1.1" },
                redirect: "follow",
                follow: 10,
                timeout: 10000,
                agent: new HttpProxyAgent(this.myProxy),
            }).then(resp => {
                url = resp.url;
            });
        } else {
            url = urlRex.exec(url)[0];
        }
        const idVideo = await this.getIdVideo(url);
        // API链接
        const API_URL = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${ idVideo }&version_code=262&app_name=musical_ly&channel=App&device_id=null&os_version=14.4.2&device_platform=iphone&device_type=iPhone9`;

        await axios
            .get(API_URL, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    "Content-Type": "application/json",
                    "Accept-Encoding": "gzip,deflate,compress",
                },
                timeout: 10000,
                proxy: false,
                httpAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
                httpsAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
            })
            .then(resp => {
                const data = resp.data.aweme_list[0];
                e.reply(`识别：tiktok, ${ data.desc }`);
                this.downloadVideo(data.video.play_addr.url_list[0], true).then(video => {
                    e.reply(
                        segment.video(
                            `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp.mp4`
                        )
                    );
                });
            });
        return true;
    }

    // bilibi解析
    async bili (e) {
        const urlRex = /(http:|https:)\/\/www.bilibili.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const bShortRex = /(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = e.msg.trim();
        // 短号处理
        if (url.includes("b23.tv")) {
            const bShortUrl = bShortRex.exec(url)[0];
            await fetch(bShortUrl).then(resp => {
                url = resp.url;
            });
        } else if (url.includes("www.bilibili.com")) {
            url = urlRex.exec(url)[0];
        }

        // 动态
        if (url.includes("t.bilibili.com")) {
            // 去除多余参数
            if (url.includes("?")) {
                url = url.substring(0, url.indexOf("?"));
            }
            const dynamicId = /[^/]+(?!.*\/)/.exec(url)[0];
            // console.log(dynamicId)
            getDynamic(dynamicId).then(async resp => {
                if (resp.dynamicSrc.length > 0) {
                    e.reply(`识别：哔哩哔哩动态, ${ resp.dynamicDesc }`);
                    let dynamicSrcMsg = []
                    resp.dynamicSrc.forEach(item => {
                        dynamicSrcMsg.push({
                            message: segment.image(item),
                            nickname: e.sender.card || e.user_id,
                            user_id: e.user_id,
                        })
                    })
                    await this.reply(await Bot.makeForwardMsg(dynamicSrcMsg));
                    // resp.dynamicSrc.forEach(item => {
                    //     e.reply(segment.image(item));
                    // });
                } else {
                    e.reply(`识别：哔哩哔哩动态, 但是失败！`);
                }
            });
            return true;
        }

        const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/`;
        if (!fs.existsSync(path)) {
            mkdirsSync(path);
        }
        // 视频信息获取例子：http://api.bilibili.com/x/web-interface/view?bvid=BV1hY411m7cB
        // 请求视频信息
        (function () {
            const baseVideoInfo = "http://api.bilibili.com/x/web-interface/view";
            const videoId = /video\/[^\?\/ ]+/.exec(url)[0].split("/")[1];
            // 获取视频信息，然后发送
            fetch(
                videoId.startsWith("BV")
                    ? `${ baseVideoInfo }?bvid=${ videoId }`
                    : `${ baseVideoInfo }?aid=${ videoId }`
            )
                .then(resp => resp.json())
                .then(resp => {
                    e.reply(`识别：哔哩哔哩, ${ resp.data.title }`).catch(err => {
                        e.reply("解析失败，重试一下");
                        console.log(err);
                    });
                });
        })();

        await getDownloadUrl(url)
            .then(data => {
                this.downBili(`${ path }temp`, data.videoUrl, data.audioUrl)
                    .then(data => {
                        e.reply(segment.video(`${ path }temp.mp4`));
                    })
                    .catch(err => {
                        console.log(err);
                        e.reply("解析失败，请重试一下");
                    });
            })
            .catch(err => {
                console.log(err);
                e.reply("解析失败，请重试一下");
            });
        return true;
    }

    // 百科
    async wiki (e) {
        const key = e.msg.replace(/#|百科|wiki/g, "").trim();
        const url = `https://xiaoapi.cn/API/bk.php?m=json&type=sg&msg=${ encodeURI(key) }`;
        // const url2 = 'https://api.jikipedia.com/go/auto_complete'
        Promise.all([
            // axios.post(url2, {
            //     headers: {
            //         "User-Agent":
            //             "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
            //         "Content-Type": "application/json",
            //     },
            //     timeout: 10000,
            //     "phrase": key,
            // })
            //     .then(resp => {
            //         const data = resp.data.data
            //         if (_.isEmpty(data)) {
            //             return data;
            //         }
            //         return data[0].entities[0];
            //     }),
            axios
                .get(url, {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    },
                    timeout: 10000,
                })
                .then(resp => {
                    return resp.data;
                }),
        ]).then(res => {
            const data = res[0];
            // const data2 = res[0]
            const template = `
                      解释：${ _.get(data, "msg") }\n
                      详情：${ _.get(data, "more") }\n
                    `;
            // 小鸡解释：${ _.get(data2, 'content') }
            e.reply(template);
        });
        return true;
    }

    // 小蓝鸟解析
    // 例子：https://twitter.com/chonkyanimalx/status/1595834168000204800
    async twitter (e) {
        // 配置参数及解析
        const reg = /https?:\/\/twitter.com\/[0-9-a-zA-Z_]{1,20}\/status\/([0-9]*)/;
        const twitterUrl = reg.exec(e.msg);
        const id = twitterUrl[1];
        const httpAgent = new HttpProxyAgent(this.myProxy);
        const twitterClient = new TwitterApi(this.bearerToken, { httpAgent });

        // Tell typescript it's a readonly app
        const readOnlyClient = twitterClient.readOnly;

        readOnlyClient.v2
            .singleTweet(id, {
                "media.fields":
                    "duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,alt_text,variants",
                expansions: [ "entities.mentions.username", "attachments.media_keys" ],
            })
            .then(async resp => {
                e.reply(`识别：小蓝鸟学习版，${ resp.data.text }`);
                const downloadPath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
                // 创建文件夹（如果没有过这个群）
                if (!fs.existsSync(downloadPath)) {
                    mkdirsSync(downloadPath);
                }
                // 逐个遍历判断
                let task = []
                for (let item of resp.includes.media) {
                    if (item.type === "photo") {
                        // 图片
                        task.push(this.downloadImg(item.url, downloadPath))
                    } else if (item.type === "video") {
                        // 视频
                        await this.downloadVideo(resp.includes.media[0].variants[0].url, true).then(_ => {
                            e.reply(segment.video(`${ downloadPath }/temp.mp4`));
                        });
                    }
                }
                let images = []
                let path = []
                // 获取所有图片的promise
                await Promise.all(task).then(resp => {
                    // console.log(resp)
                    resp.forEach(item => {
                        path.push(item)
                        images.push({
                            message: segment.image(fs.readFileSync(item)),
                            nickname: this.e.sender.card || this.e.user_id,
                            user_id: this.e.user_id,
                        });
                    })
                })
                await e.reply(await Bot.makeForwardMsg(images))
                // 清理文件
                path.forEach(item => {
                    fs.unlinkSync(item);
                })
            });
        return true;
    }

    // acfun解析
    async acfun (e) {
        const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp/`;
        if (!fs.existsSync(path)) {
            mkdirsSync(path);
        }

        let inputMsg = e.msg;
        // 适配手机分享：https://m.acfun.cn/v/?ac=32838812&sid=d2b0991bd6ad9c09
        if (inputMsg.includes("m.acfun.cn")) {
            inputMsg = `https://www.acfun.cn/v/ac${ /ac=([^&?]*)/.exec(inputMsg)[1] }`;
        }

        parseUrl(inputMsg).then(res => {
            e.reply(`识别：猴山，${ res.videoName }`);
            parseM3u8(res.urlM3u8s[res.urlM3u8s.length - 1]).then(res2 => {
                downloadM3u8Videos(res2.m3u8FullUrls, path).then(_ => {
                    mergeAcFileToMp4(res2.tsNames, path, `${ path }out.mp4`).then(_ => {
                        e.reply(segment.video(`${ path }out.mp4`));
                    });
                });
            });
        });
        return true;
    }

    // 小红书解析
    async redbook (e) {
        const msgUrl = /(http:|https:)\/\/(xhslink|xiaohongshu).com\/[A-Za-z\d._?%&+\-=\/#@]*/.exec(
            e.msg
        )[0];
        const url = `https://dlpanda.com/zh-CN/xhs?url=${ msgUrl }`;

        await axios
            .get(url, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    "Content-Type": "application/json",
                    "Accept-Encoding": "gzip,deflate,compress",
                },
                timeout: 10000,
                proxy: false,
            })
            .then(resp => {
                const reg = /<img(.*)src="\/\/ci\.xiaohongshu\.com(.*?)"/g;
                let res = "";

                const downloadPath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
                // 创建文件夹（如果没有过这个群）
                if (!fs.existsSync(downloadPath)) {
                    mkdirsSync(downloadPath);
                }
                while ((res = reg.exec(resp.data))) {
                    const addr = `https://ci.xiaohongshu.com${ res[2] }`;
                    axios
                        .get(addr, {
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                            },
                            responseType: "stream",
                        })
                        .then(resp => {
                            const filepath = `${ downloadPath }/${ /com\/(.*)\?/.exec(addr)[1] }.jpg`;
                            const writer = fs.createWriteStream(filepath);
                            resp.data.pipe(writer);
                            return new Promise((resolve, reject) => {
                                writer.on("finish", () => resolve(filepath));
                                writer.on("error", reject);
                            });
                        })
                        .then(filepath => {
                            e.reply(segment.image(fs.readFileSync(filepath)));
                            fs.unlinkSync(filepath);
                        });
                }
            });

        return true;
    }

    // 文献解析
    async literature (e) {
        const litReg = /(http:|https:)\/\/doi.org\/[A-Za-z\d._?%&+\-=\/#@]*/;
        const url = litReg.exec(e.msg.trim())[0];
        const waitList = [
            "https://sci-hub.se/",
            "https://sci-hub.st/",
            "https://sci-hub.do/",
            "https://sci-hubtw.hkvisa.net/",
            "https://sci-hub.ren/",
            "https://sci-hub.ee/",
            "https://sci-hub.ru/",
        ];
        const flag = /doi.org\/(.*)/.exec(url)[1];
        const newWaitList = waitList.map(item => {
            return item + flag;
        });
        await Promise.race(newWaitList).then(resp => {
            e.reply(resp);
        });
    }

    async downBili (title, videoUrl, audioUrl) {
        return Promise.all([
            downloadBFile(
                videoUrl,
                title + "-video.m4s",
                _.throttle(
                    value =>
                        console.log("download-progress", {
                            type: "video",
                            data: value,
                        }),
                    1000
                )
            ),
            downloadBFile(
                audioUrl,
                title + "-audio.m4s",
                _.throttle(
                    value =>
                        console.log("download-progress", {
                            type: "audio",
                            data: value,
                        }),
                    1000
                )
            ),
        ]).then(data => {
            return mergeFileToMp4(data[0].fullFileName, data[1].fullFileName, title + ".mp4");
        });
    }

    // 工具：下载一张网络图片
    async downloadImg (img, dir) {
        const filename = img.split("/").pop();
        const filepath = `${ dir }/${ filename }`;
        const writer = fs.createWriteStream(filepath);
        return axios
            .get(img, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                responseType: "stream",
                httpAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
                httpsAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
            })
            .then(res => {
                res.data.pipe(writer);
                return new Promise((resolve, reject) => {
                    writer.on("finish", () => {
                        writer.close(() => {
                            resolve(filepath);
                        });
                    });
                    writer.on("error", err => {
                        fs.unlink(filepath, () => {
                            reject(err);
                        });
                    });
                });
            });
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
                .then(resp => {
                    const location = resp.request.res.responseUrl;
                    resolve(location);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    // 工具：根URL据下载视频 / 音频
    async downloadVideo (url, isProxy = false, headers = null) {
        const groupPath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
        if (!fs.existsSync(groupPath)) {
            mkdirsSync(groupPath);
        }
        const target = `${ groupPath }/temp.mp4`;
        // 待优化
        if (fs.existsSync(target)) {
            console.log(`视频已存在`);
            fs.unlinkSync(target);
        }
        let res;
        if (!isProxy) {
            res = await axios.get(url, {
                headers: headers || {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                responseType: "stream",
            });
        } else {
            res = await axios.get(url, {
                headers: headers || {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                responseType: "stream",
                httpAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
                httpsAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
            });
        }
        console.log(`开始下载: ${ url }`);
        const writer = fs.createWriteStream(target);
        res.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });
    }

    // 工具：找到tiktok的视频id
    async getIdVideo (url) {
        const matching = url.includes("/video/");
        if (!matching) {
            this.e.reply("没找到，正在获取随机视频！");
            return null;
        }
        const idVideo = url.substring(url.indexOf("/video/") + 7, url.length);
        return idVideo.length > 19 ? idVideo.substring(0, idVideo.indexOf("?")) : idVideo;
    }
}
