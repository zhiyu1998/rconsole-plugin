// 主库
import fetch from "node-fetch";
import fs from "node:fs";
import { segment } from "oicq";
// 其他库
import md5 from "md5";
import axios from "axios";
import _ from 'lodash'
import tunnel from 'tunnel'
import { TwitterApi } from 'twitter-api-v2'
import HttpProxyAgent from 'https-proxy-agent'
import { mkdirsSync } from '../utils/file.js'
import { downloadBFile, getDownloadUrl, mergeFileToMp4 } from '../utils/bilibili.js'
import { parseUrl, parseM3u8, downloadM3u8Videos, mergeAcFileToMp4 } from '../utils/acfun.js'
// import { get, remove, add } from "../utils/redisu.js";

const transMap = { "中": "zh", "日": "jp", "文": "wyw", "英": "en" }

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
                {
                    reg: "(.*)(twitter.com)",
                    fnc: "twitter",
                },
                {
                    reg: "https:\/\/(m.)?v.qq.com\/(.*)",
                    fnc: "tx"
                },
                {
                    reg: "(.*)(acfun.cn)",
                    fnc: "acfun"
                },
                {
                    reg: "(.*)(xhslink.com|xiaohongshu.com)",
                    fnc: "redbook"
                }
            ],
        });
        // http://api.tuwei.space/girl
        // 视频保存路径
        this.defaultPath = `./data/rcmp4/`;
        // redis的key
        this.redisKey = `Yz:tools:cache:${ this.group_id }`;
        // 代理接口
        // TODO 填写服务器的内网ID和clash的端口
        this.proxyAddr = '10.0.8.10';
        this.proxyPort = '7890'
        this.myProxy = `http://${this.proxyAddr}:${this.proxyPort}`;

    }

    // 翻译插件
    async trans (e) {
        const languageReg = /翻(.)/g;
        const msg = e.msg.trim();
        const language = languageReg.exec(msg);
        if (!transMap.hasOwnProperty(language[1])) {
            e.reply("输入格式有误！例子：翻中 China's policy has been consistent, but Japan chooses a path of mistrust, decoupling and military expansion")
            return;
        }
        const place = msg.replace(language[0], "").trim();
        // let url = /[\u4E00-\u9FFF]+/g.test(place)
        // TODO 查阅百度文档填写
        let url = `http://api.fanyi.baidu.com/api/trans/vip/translate?from=auto&to=${ transMap[language[1]] }&appid=&salt=&sign=${ md5("" + place + "" + "") }&q=${ place }`;
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

        await this.douyinRequest(douUrl).then(async (res) => {
            const douRex = /.*video\/(\d+)\/(.*?)/g;
            const douId = douRex.exec(res)[1];
            // const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${ douId }`;
            const url = `https://www.iesdouyin.com/aweme/v1/web/aweme/detail/?aweme_id=${ douId }&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`
            const resp = await fetch(url);
            const json = await resp.json();
            const item = json.aweme_detail;
            e.reply(`识别：抖音, ${item.desc}`);
            const url_2 = item.video.play_addr.url_list[0];
            this.downloadVideo(url_2).then(video => {
                e.reply(segment.video(`${this.defaultPath}${this.e.group_id || this.e.user_id}/temp.mp4`));
            });
        });
        return true;
    }

    // tiktok解析
    async tiktok (e) {
        const urlRex = /(http:|https:)\/\/www.tiktok.com\/[A-Za-z\d._?%&+\-=\/#@]*/g;
        const urlShortRex = /(http:|https:)\/\/vt.tiktok.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = e.msg.trim()
        // 短号处理
        if (url.includes('vt.tiktok')) {
            const temp_url = urlShortRex.exec(url)[0]
            await fetch(temp_url, {
                redirect: "follow",
                follow: 10,
                timeout: 10000,
                agent: new HttpProxyAgent(this.myProxy)
            }).then((resp) => {
                url = resp.url
            })
        } else {
            url = urlRex.exec(url)[0]
        }
        const idVideo = await this.getIdVideo(url)
        // API链接
        const API_URL = `https://api19-core-useast5.us.tiktokv.com/aweme/v1/feed/?aweme_id=${ idVideo }&version_code=262&app_name=musical_ly&channel=App&device_id=null&os_version=14.4.2&device_platform=iphone&device_type=iPhone9`;

        await axios.get(API_URL, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                "Content-Type": "application/json",
                "Accept-Encoding": "gzip,deflate,compress"
            },
            timeout: 10000,
            proxy: false,
            httpAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
            httpsAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
        }).then(resp => {
            const data = resp.data.aweme_list[0];
            e.reply(`识别：tiktok, ${data.desc}`)
            this.downloadVideo(data.video.play_addr.url_list[0], true).then(video => {
                e.reply(segment.video(`${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp.mp4`));
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
            await fetch(bShortUrl).then(resp => {
                url = resp.url;
            })
        } else {
            url = urlRex.exec(url)[0];
        }

        const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp`
        // 待优化
        if (fs.existsSync(`${ path }.mp4`)) {
            console.log("视频已存在");
            fs.unlinkSync(`${ path }.mp4`);
        }
        // 视频信息获取例子：http://api.bilibili.com/x/web-interface/view?bvid=BV1hY411m7cB
        const baseVideoInfo = "http://api.bilibili.com/x/web-interface/view";
        console.log(url);
        const videoId = /video\/(.*?)(\/|\?)/g.exec(url)[1];
        // 获取视频信息，然后发送
        fetch(videoId.startsWith("BV") ? `${baseVideoInfo}?bvid=${videoId}` : `${baseVideoInfo}?aid=${videoId}`)
            .then(resp => resp.json())
            .then(resp => {
                e.reply(`识别：哔哩哔哩, ${resp.data.title}`)
            })

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
        const url = `https://xiaoapi.cn/API/bk.php?m=json&type=sg&msg=${ encodeURI(key) }`
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
                const data = res[0]
                // const data2 = res[0]
                const template = `
                      解释：${ _.get(data, 'msg') }\n
                      详情：${ _.get(data, 'more') }\n
                    `;
                // 小鸡解释：${ _.get(data2, 'content') }
                e.reply(template)
            })
        return true
    }

    // twitter解析
    // 例子：https://twitter.com/chonkyanimalx/status/1595834168000204800
    async twitter (e) {
        // 配置参数及解析
        const reg = /https?:\/\/twitter.com\/[0-9-a-zA-Z_]{1,20}\/status\/([0-9]*)/
        const twitterUrl = reg.exec(e.msg);
        const id = twitterUrl[1];
        const httpAgent = new HttpProxyAgent(this.myProxy)
        const twitterClient = new TwitterApi('', {httpAgent});

        // Tell typescript it's a readonly app
        const readOnlyClient = twitterClient.readOnly;

        readOnlyClient.v2.singleTweet(id, {
            'media.fields': 'duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,alt_text,variants',
            expansions: [
                'entities.mentions.username',
                'attachments.media_keys',
            ],
        }).then(resp => {
            e.reply(`识别：腿忒学习版，${resp.data.text}`)
            const downloadPath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
            // 创建文件夹（如果没有过这个群）
            if (!fs.existsSync(downloadPath)) {
                mkdirsSync(downloadPath);
            }
            // 开始读取数据
            if (resp.includes.media[0].type === 'photo') {
                // 图片
                resp.includes.media.map(item => {
                    const filePath = `${downloadPath}/${item.url.split('/').pop()}`
                    this.downloadImgs(item.url, downloadPath).then(tmp => {
                        e.reply(segment.image(fs.readFileSync(filePath)))
                    })
                })
            } else {
                // 视频
                this.downloadVideo(resp.includes.media[0].variants[0].url, true).then(video => {
                    e.reply(segment.video(`${downloadPath}/temp.mp4`));
                });
            }
        });
        return true;
    }

    // 视频解析
    async tx( e ) {
        const url = e.msg
        const data = await ( await fetch( `https://xian.txma.cn/API/jx_txjx.php?url=${url}` ) )
            .json()
        const k = data.url
        const name = data.title
        if( k && name ) {
            e.reply( name + '\n' + k )
            let forward = await this.makeForwardMsg( url )
            e.reply( forward )
            return true
        } else {
            e.reply( '解析腾讯视频失败~\n去浏览器使用拼接接口吧...' )
            let forward = await this.makeForwardMsg( url )
            e.reply( forward )
            return true
        }
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
    async downloadVideo (url, isProxy=false) {
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
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                responseType: "stream",
            });
        } else {
            res = await axios.get(url, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                responseType: "stream",
                httpAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
                httpsAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
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
        const matching = url.includes("/video/")
        if (!matching) {
            this.e.reply("没找到，正在获取随机视频！")
            return null
        }
        const idVideo = url.substring(url.indexOf("/video/") + 7, url.length);
        return (idVideo.length > 19) ? idVideo.substring(0, idVideo.indexOf("?")) : idVideo;
    }

    // acfun解析
    async acfun(e) {
        const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp/`
        if (!fs.existsSync(path)) {
            mkdirsSync(path);
        }

        let inputMsg = e.msg;
        // 适配手机分享：https://m.acfun.cn/v/?ac=32838812&sid=d2b0991bd6ad9c09
        if (inputMsg.includes("m.acfun.cn")) {
            inputMsg = `https://www.acfun.cn/v/ac${/ac=([^&?]*)/.exec(inputMsg)[1]}`
        }

        parseUrl(inputMsg).then(res => {
            e.reply(`识别：猴山，${res.videoName}`)
            parseM3u8(res.urlM3u8s[res.urlM3u8s.length-1]).then(res2 => {
                downloadM3u8Videos(res2.m3u8FullUrls, path).then(_ => {
                    mergeAcFileToMp4( res2.tsNames, path, `${path}out.mp4`).then(_ => {
                        e.reply(segment.video(`${path}out.mp4`))
                    })
                })
            })
        })
        return true;
    }

    // 小红书解析
    async redbook(e) {
        const msgUrl = /(http:|https:)\/\/(xhslink|xiaohongshu).com\/[A-Za-z\d._?%&+\-=\/#@]*/.exec(e.msg)[0];
        const url = `https://dlpanda.com/zh-CN/xhs?url=${msgUrl}`

        await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                "Content-Type": "application/json",
                "Accept-Encoding": "gzip,deflate,compress"
            },
            timeout: 10000,
            proxy: false,
        }).then((resp) => {
            const reg = /<img(.*)src="\/\/ci\.xiaohongshu\.com(.*?)"/g
            let res = '';// 主库
            import fetch from "node-fetch";
            import fs from "node:fs";
            import { segment } from "oicq";
// 其他库
            import md5 from "md5";
            import axios from "axios";
            import _ from 'lodash'
            import tunnel from 'tunnel'
            import { TwitterApi } from 'twitter-api-v2'
            import HttpProxyAgent from 'https-proxy-agent'
            import { mkdirsSync } from '../utils/file.js'
            import { downloadBFile, getDownloadUrl, mergeFileToMp4 } from '../utils/bilibili.js'
            import { parseUrl, parseM3u8, downloadM3u8Videos, mergeAcFileToMp4 } from '../utils/acfun.js'
// import { get, remove, add } from "../utils/redisu.js";

            const transMap = { "中": "zh", "日": "jp", "文": "wyw", "英": "en" }

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
                            {
                                reg: "(.*)(twitter.com)",
                                fnc: "twitter",
                            },
                            {
                                reg: "https:\/\/(m.)?v.qq.com\/(.*)",
                                fnc: "tx"
                            },
                            {
                                reg: "(.*)(acfun.cn)",
                                fnc: "acfun"
                            },
                            {
                                reg: "(.*)(xhslink.com|xiaohongshu.com)",
                                fnc: "redbook"
                            }
                        ],
                    });
                    // http://api.tuwei.space/girl
                    // 视频保存路径
                    this.defaultPath = `./data/rcmp4/`;
                    // redis的key
                    this.redisKey = `Yz:tools:cache:${ this.group_id }`;
                    // 代理接口
                    this.proxyAddr = '10.0.8.10';
                    this.proxyPort = '7890'
                    this.myProxy = `http://${this.proxyAddr}:${this.proxyPort}`;

                }

                // 翻译插件
                async trans (e) {
                    const languageReg = /翻(.)/g;
                    const msg = e.msg.trim();
                    const language = languageReg.exec(msg);
                    if (!transMap.hasOwnProperty(language[1])) {
                        e.reply("输入格式有误！例子：翻中 China's policy has been consistent, but Japan chooses a path of mistrust, decoupling and military expansion")
                        return;
                    }
                    const place = msg.replace(language[0], "").trim();
                    // let url = /[\u4E00-\u9FFF]+/g.test(place)
                    let url = `http://api.fanyi.baidu.com/api/trans/vip/translate?from=auto&to=${ transMap[language[1]] }&appid=20210422000794040&salt=542716863&sign=${ md5("20210422000794040" + place + "542716863" + "HooD_ndgwcGH6SAnxGrM") }&q=${ place }`;
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

                    await this.douyinRequest(douUrl).then(async (res) => {
                        const douRex = /.*video\/(\d+)\/(.*?)/g;
                        const douId = douRex.exec(res)[1];
                        // const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${ douId }`;
                        const url = `https://www.iesdouyin.com/aweme/v1/web/aweme/detail/?aweme_id=${ douId }&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`
                        const resp = await fetch(url);
                        const json = await resp.json();
                        const item = json.aweme_detail;
                        e.reply(`识别：抖音, ${item.desc}`);
                        const url_2 = item.video.play_addr.url_list[0];
                        this.downloadVideo(url_2).then(video => {
                            e.reply(segment.video(`${this.defaultPath}${this.e.group_id || this.e.user_id}/temp.mp4`));
                        });
                    });
                    return true;
                }

                // tiktok解析
                async tiktok (e) {
                    const urlRex = /(http:|https:)\/\/www.tiktok.com\/[A-Za-z\d._?%&+\-=\/#@]*/g;
                    const urlShortRex = /(http:|https:)\/\/vt.tiktok.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
                    let url = e.msg.trim()
                    // 短号处理
                    if (url.includes('vt.tiktok')) {
                        const temp_url = urlShortRex.exec(url)[0]
                        await fetch(temp_url, {
                            redirect: "follow",
                            follow: 10,
                            timeout: 10000,
                            agent: new HttpProxyAgent(this.myProxy)
                        }).then((resp) => {
                            url = resp.url
                        })
                    } else {
                        url = urlRex.exec(url)[0]
                    }
                    const idVideo = await this.getIdVideo(url)
                    // API链接
                    const API_URL = `https://api19-core-useast5.us.tiktokv.com/aweme/v1/feed/?aweme_id=${ idVideo }&version_code=262&app_name=musical_ly&channel=App&device_id=null&os_version=14.4.2&device_platform=iphone&device_type=iPhone9`;

                    await axios.get(API_URL, {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                            "Content-Type": "application/json",
                            "Accept-Encoding": "gzip,deflate,compress"
                        },
                        timeout: 10000,
                        proxy: false,
                        httpAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
                        httpsAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
                    }).then(resp => {
                        const data = resp.data.aweme_list[0];
                        e.reply(`识别：tiktok, ${data.desc}`)
                        this.downloadVideo(data.video.play_addr.url_list[0], true).then(video => {
                            e.reply(segment.video(`${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp.mp4`));
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
                        await fetch(bShortUrl).then(resp => {
                            url = resp.url;
                        })
                    } else {
                        url = urlRex.exec(url)[0];
                    }

                    const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp`
                    // 待优化
                    if (fs.existsSync(`${ path }.mp4`)) {
                        console.log("视频已存在");
                        fs.unlinkSync(`${ path }.mp4`);
                    }
                    // 视频信息获取例子：http://api.bilibili.com/x/web-interface/view?bvid=BV1hY411m7cB
                    const baseVideoInfo = "http://api.bilibili.com/x/web-interface/view";
                    console.log(url);
                    const videoId = /video\/(.*?)(\/|\?)/g.exec(url)[1];
                    // 获取视频信息，然后发送
                    fetch(videoId.startsWith("BV") ? `${baseVideoInfo}?bvid=${videoId}` : `${baseVideoInfo}?aid=${videoId}`)
                        .then(resp => resp.json())
                        .then(resp => {
                            e.reply(`识别：哔哩哔哩, ${resp.data.title}`)
                        })

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
                    const url = `https://xiaoapi.cn/API/bk.php?m=json&type=sg&msg=${ encodeURI(key) }`
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
                            const data = res[0]
                            // const data2 = res[0]
                            const template = `
                      解释：${ _.get(data, 'msg') }\n
                      详情：${ _.get(data, 'more') }\n
                    `;
                            // 小鸡解释：${ _.get(data2, 'content') }
                            e.reply(template)
                        })
                    return true
                }

                // twitter解析
                // 例子：https://twitter.com/chonkyanimalx/status/1595834168000204800
                async twitter (e) {
                    // 配置参数及解析
                    const reg = /https?:\/\/twitter.com\/[0-9-a-zA-Z_]{1,20}\/status\/([0-9]*)/
                    const twitterUrl = reg.exec(e.msg);
                    const id = twitterUrl[1];
                    const httpAgent = new HttpProxyAgent(this.myProxy)
                    // TODO 需要填写Twitter id
                    const twitterClient = new TwitterApi('', {httpAgent});

                    // Tell typescript it's a readonly app
                    const readOnlyClient = twitterClient.readOnly;

                    readOnlyClient.v2.singleTweet(id, {
                        'media.fields': 'duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,alt_text,variants',
                        expansions: [
                            'entities.mentions.username',
                            'attachments.media_keys',
                        ],
                    }).then(resp => {
                        e.reply(`识别：腿忒学习版，${resp.data.text}`)
                        const downloadPath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
                        // 创建文件夹（如果没有过这个群）
                        if (!fs.existsSync(downloadPath)) {
                            mkdirsSync(downloadPath);
                        }
                        // 开始读取数据
                        if (resp.includes.media[0].type === 'photo') {
                            // 图片
                            resp.includes.media.map(item => {
                                const filePath = `${downloadPath}/${item.url.split('/').pop()}`
                                this.downloadImgs(item.url, downloadPath).then(tmp => {
                                    e.reply(segment.image(fs.readFileSync(filePath)))
                                })
                            })
                        } else {
                            // 视频
                            this.downloadVideo(resp.includes.media[0].variants[0].url, true).then(video => {
                                e.reply(segment.video(`${downloadPath}/temp.mp4`));
                            });
                        }
                    });
                    return true;
                }

                // 视频解析
                async tx( e ) {
                    const url = e.msg
                    const data = await ( await fetch( `https://xian.txma.cn/API/jx_txjx.php?url=${url}` ) )
                        .json()
                    const k = data.url
                    const name = data.title
                    if( k && name ) {
                        e.reply( name + '\n' + k )
                        let forward = await this.makeForwardMsg( url )
                        e.reply( forward )
                        return true
                    } else {
                        e.reply( '解析腾讯视频失败~\n去浏览器使用拼接接口吧...' )
                        let forward = await this.makeForwardMsg( url )
                        e.reply( forward )
                        return true
                    }
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
                async downloadVideo (url, isProxy=false) {
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
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                            },
                            responseType: "stream",
                        });
                    } else {
                        res = await axios.get(url, {
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                            },
                            responseType: "stream",
                            httpAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
                            httpsAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
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
                    const matching = url.includes("/video/")
                    if (!matching) {
                        this.e.reply("没找到，正在获取随机视频！")
                        return null
                    }
                    const idVideo = url.substring(url.indexOf("/video/") + 7, url.length);
                    return (idVideo.length > 19) ? idVideo.substring(0, idVideo.indexOf("?")) : idVideo;
                }

                // acfun解析
                async acfun(e) {
                    const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp/`
                    if (!fs.existsSync(path)) {
                        mkdirsSync(path);
                    }

                    let inputMsg = e.msg;
                    // 适配手机分享：https://m.acfun.cn/v/?ac=32838812&sid=d2b0991bd6ad9c09
                    if (inputMsg.includes("m.acfun.cn")) {
                        inputMsg = `https://www.acfun.cn/v/ac${/ac=([^&?]*)/.exec(inputMsg)[1]}`
                    }

                    parseUrl(inputMsg).then(res => {
                        e.reply(`识别：猴山，${res.videoName}`)
                        parseM3u8(res.urlM3u8s[res.urlM3u8s.length-1]).then(res2 => {
                            downloadM3u8Videos(res2.m3u8FullUrls, path).then(_ => {
                                mergeAcFileToMp4( res2.tsNames, path, `${path}out.mp4`).then(_ => {
                                    e.reply(segment.video(`${path}out.mp4`))
                                })
                            })
                        })
                    })
                    return true;
                }

                // 小红书解析
                async redbook(e) {
                    const msgUrl = /(http:|https:)\/\/(xhslink|xiaohongshu).com\/[A-Za-z\d._?%&+\-=\/#@]*/.exec(e.msg)[0];
                    const url = `https://dlpanda.com/zh-CN/xhs?url=${msgUrl}`

                    await axios.get(url, {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                            "Content-Type": "application/json",
                            "Accept-Encoding": "gzip,deflate,compress"
                        },
                        timeout: 10000,
                        proxy: false,
                    }).then((resp) => {
                        const reg = /<img(.*)src="\/\/ci\.xiaohongshu\.com(.*?)"/g
                        let res = '';
                        let images = [];
                        while (res = reg.exec(resp.data)) {
                            console.log(`https://ci.xiaohongshu.com${res[2]}`)
                            images.push({
                                message: segment.image(`https://ci.xiaohongshu.com${res[2]}`),
                                nickname: e.sender.card || e.user_id,
                                user_id: e.user_id
                            })
                        }
                        if (images.length > 0) {
                            e.reply(Bot.makeForwardMsg(images))
                        } else {
                            e.reply("解析失败，重新解析下");
                        }
                    })

                    return true;
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

                // 工具：下载一张网络图片
                async downloadImgs(img, dir) {

                    const filename = img.split('/').pop();
                    const filepath = `${dir}/${filename}`;
                    const writer = fs.createWriteStream(filepath);
                    return axios.get(img, {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                        },
                        responseType: "stream",
                        httpAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
                        httpsAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
                    }).then(res => {
                        res.data.pipe(writer);
                        return new Promise((resolve, reject) => {
                            writer.on('finish', () => resolve(filepath));
                            writer.on('error', reject);
                        });
                    });
                }
            }

            let images = [];
            while (res = reg.exec(resp.data)) {
                console.log(`https://ci.xiaohongshu.com${res[2]}`)
                images.push({
                    message: segment.image(`https://ci.xiaohongshu.com${res[2]}`),
                    nickname: e.sender.card || e.user_id,
                    user_id: e.user_id
                })
            }
            if (images.length > 0) {
                e.reply(Bot.makeForwardMsg(images))
            } else {
                e.reply("解析失败，重新解析下");
            }
        })

        return true;
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

    // 工具：下载一张网络图片
    async downloadImgs(img, dir) {

        const filename = img.split('/').pop();
        const filepath = `${dir}/${filename}`;
        const writer = fs.createWriteStream(filepath);
        return axios.get(img, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
            },
            responseType: "stream",
            httpAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
            httpsAgent: tunnel.httpOverHttp({ proxy: { host: this.proxyAddr, port: this.proxyPort } }),
        }).then(res => {
            res.data.pipe(writer);
            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filepath));
                writer.on('error', reject);
            });
        });
    }
}
