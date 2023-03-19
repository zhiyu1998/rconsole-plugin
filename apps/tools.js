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
import { transMap, douyinTypeMap, TEN_THOUSAND } from "../utils/constant.js";
import { getIdVideo, generateRandomStr } from "../utils/common.js";
import config from "../model/index.js";

export class tools extends plugin {
    constructor() {
        super({
            name: "R插件工具和学习类",
            dsc: "R插件工具相关指令",
            event: "message.group",
            priority: 500,
            rule: [
                {
                    reg: "^(翻|transl)(.) (.*)$",
                    fnc: "trans",
                },
                {
                    reg: "(v.douyin.com)",
                    fnc: "douyin",
                },
                {
                    reg: "(www.tiktok.com)|(vt.tiktok.com)|(vm.tiktok.com)",
                    fnc: "tiktok",
                },
                {
                    reg: "(bilibili.com|b23.tv|t.bilibili.com)",
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
                    reg: "(acfun.cn)",
                    fnc: "acfun",
                },
                {
                    reg: "(.*)(xhslink.com|xiaohongshu.com)",
                    fnc: "redbook",
                },
                {
                    reg: "(doi.org)",
                    fnc: "literature",
                },
                {
                    reg: "^#清理data垃圾$",
                    fnc: "clearTrash",
                    permission: "master",
                },
                {
                    reg: "^#波点音乐(.*)",
                    fnc: "bodianMusic",
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
        this.myProxy = `http://${this.proxyAddr}:${this.proxyPort}`;
        // console.log(this.myProxy)
        // 加载百度翻译配置
        this.translateAppId = this.toolsConfig.translateAppId;
        this.translateSecret = this.toolsConfig.translateSecret;
        // 加载twitter配置
        this.bearerToken = this.toolsConfig.bearerToken;
    }

    // 翻译插件
    async trans(e) {
        const languageReg = /翻(.)/g;
        const msg = e.msg.trim();
        const language = languageReg.exec(msg);
        if (!transMap.hasOwnProperty(language[1])) {
            e.reply(
                "输入格式有误！例子：翻中 China's policy has been consistent, but Japan chooses a path of mistrust, decoupling and military expansion",
            );
            return;
        }
        const place = msg.replace(language[0], "").trim();
        // let url = /[\u4E00-\u9FFF]+/g.test(place)
        // let url = `http://api.fanyi.baidu.com/api/trans/vip/translate?from=auto&to=${ transMap[language[1]] }&appid=APP ID&salt=自定义&sign=${ md5("APP ID" + place + "自定义" + "密钥") }&q=${ place }`;
        let url = `http://api.fanyi.baidu.com/api/trans/vip/translate?from=auto&to=${
            transMap[language[1]]
        }&appid=${this.translateAppId}&salt=rconsole&sign=${md5(
            this.translateAppId + place + "rconsole" + this.translateSecret,
        )}&q=${place}`;
        // console.log(url)
        await fetch(url)
            .then(resp => resp.json())
            .then(text => text.trans_result)
            .then(res => this.reply(`${res[0].dst}`, true))
            .catch(err => logger.error(err));
        return true;
    }

    // 抖音解析
    async douyin(e) {
        const urlRex = /(http:|https:)\/\/v.douyin.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const douUrl = urlRex.exec(e.msg.trim())[0];

        await this.douyinRequest(douUrl).then(async res => {
            const douId = /note\/(\d+)/g.exec(res)?.[1] || /video\/(\d+)/g.exec(res)?.[1];
            // 且行且珍惜，下面是已经过期的两个抖音api，获取难度越来越大
            // const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${ douId }`;
            // const url = `https://www.iesdouyin.com/aweme/v1/web/aweme/detail/?aweme_id=${ douId }&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`;

            fetch("https://ttwid.bytedance.com/ttwid/union/register/", {
                method: "POST",
                mode: "cors",
                credentials: "include",
                body: JSON.stringify({
                    region: "cn",
                    aid: 1768,
                    needFid: false,
                    service: "www.ixigua.com",
                    migrate_info: {
                        ticket: "",
                        source: "node",
                    },
                    cbUrlProtocol: "https",
                    union: true,
                }),
            }).then(resp => {
                const ttwid = resp.headers.get("set-cookie");
                const odin_tt =
                    "a09d8eb0d95b7b9adb4b6fc6591918bfb996096967a7aa4305bd81b5150a8199d2e29ed21883cdd7709c5beaa2be3baa";
                const passport_csrf_token = "2f142a9bb5db1f81f249d6fc997fe4a1";
                const headers = {
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
                    referer: "https://www.douyin.com/",
                    Cookie: `ttwid=${ttwid};odin_tt=${odin_tt};passport_csrf_token=${passport_csrf_token}`,
                };
                const dyApi = "https://www.douyin.com/aweme/v1/web/aweme/detail/?";
                const params = `msToken=${generateRandomStr(
                    107,
                )}&aweme_id=${douId}&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`;
                // xg参数
                axios
                    .post(`http://47.115.200.238/xg/path?url=${params.replaceAll("&", "%26")}`, {
                        headers: {
                            "user-agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
                            referer: "https://www.douyin.com/",
                            cookie: "",
                        },
                    })
                    .then(resp => {
                        const param = resp.data.result[0].paramsencode;
                        const resDyApi = `${dyApi}${param}`;
                        axios
                            .get(resDyApi, {
                                headers,
                            })
                            .then(async resp => {
                                const item = resp.data.aweme_detail;
                                e.reply(`识别：抖音, ${item.desc}`);
                                const urlTypeCode = item.aweme_type;
                                const urlType = douyinTypeMap[urlTypeCode];
                                if (urlType === "video") {
                                    const url_2 = item.video.play_addr.url_list[2];
                                    this.downloadVideo(url_2, false, headers).then(video => {
                                        e.reply(
                                            segment.video(
                                                `${this.defaultPath}${
                                                    this.e.group_id || this.e.user_id
                                                }/temp.mp4`,
                                            ),
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
                                    await this.reply(
                                        await Bot.makeForwardMsg(no_watermark_image_list),
                                    );
                                }
                            });
                    });
            });
        });
        return true;
    }

    // tiktok解析
    async tiktok(e) {
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
        let idVideo = await getIdVideo(url);
        idVideo = idVideo.replace(/\//g, "");
        // API链接
        const API_URL = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${idVideo}&version_code=262&app_name=musical_ly&channel=App&device_id=null&os_version=14.4.2&device_platform=iphone&device_type=iPhone9`;

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
                e.reply(`识别：tiktok, ${data.desc}`);
                this.downloadVideo(data.video.play_addr.url_list[0], true).then(video => {
                    e.reply(
                        segment.video(
                            `${this.defaultPath}${this.e.group_id || this.e.user_id}/temp.mp4`,
                        ),
                    );
                });
            });
        return true;
    }

    // bilibi解析
    async bili(e) {
        const urlRex = /(http:|https:)\/\/www.bilibili.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const bShortRex = /(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim();
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
                    e.reply(`识别：哔哩哔哩动态, ${resp.dynamicDesc}`);
                    let dynamicSrcMsg = [];
                    resp.dynamicSrc.forEach(item => {
                        dynamicSrcMsg.push({
                            message: segment.image(item),
                            nickname: e.sender.card || e.user_id,
                            user_id: e.user_id,
                        });
                    });
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

        const path = `${this.defaultPath}${this.e.group_id || this.e.user_id}/`;
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
                    ? `${baseVideoInfo}?bvid=${videoId}`
                    : `${baseVideoInfo}?aid=${videoId}`,
            ).then(async resp => {
                const respJson = await resp.json();
                const respData = respJson.data;
                // 视频标题
                const title = "识别：哔哩哔哩，" + respData.title + "\n";
                // 视频图片(暂时不加入，影响性能)
                // const videoCover = respData.pic;
                // 视频信息
                let { view, danmaku, reply, favorite, coin, share, like } = respData.stat;
                // 数据处理
                const dataProcessing = data => {
                    return Number(data) >= TEN_THOUSAND
                        ? (data / TEN_THOUSAND).toFixed(1) + "万"
                        : data;
                };
                // 组合内容
                const combineContent = `总播放量：${dataProcessing(
                    view,
                )}, 弹幕数量：${dataProcessing(danmaku)}, 回复量：${dataProcessing(
                    reply,
                )}, 收藏数：${dataProcessing(favorite)}, 投币：${dataProcessing(
                    coin,
                )}, 分享：${dataProcessing(share)}, 点赞：${dataProcessing(like)}\n`;
                const msgCombine = [title, combineContent /*, segment.image(videoCover)*/];
                await e.reply(msgCombine);
            });
        })();

        await getDownloadUrl(url)
            .then(data => {
                this.downBili(`${path}temp`, data.videoUrl, data.audioUrl)
                    .then(data => {
                        e.reply(segment.video(`${path}temp.mp4`));
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
    async wiki(e) {
        const key = e.msg.replace(/#|百科|wiki/g, "").trim();
        const url = `https://xiaoapi.cn/API/bk.php?m=json&type=sg&msg=${encodeURI(key)}`;
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
                      解释：${_.get(data, "msg")}\n
                      详情：${_.get(data, "more")}\n
                    `;
            // 小鸡解释：${ _.get(data2, 'content') }
            e.reply(template);
        });
        return true;
    }

    // 小蓝鸟解析
    // 例子：https://twitter.com/chonkyanimalx/status/1595834168000204800
    async twitter(e) {
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
                expansions: ["entities.mentions.username", "attachments.media_keys"],
            })
            .then(async resp => {
                e.reply(`识别：小蓝鸟学习版，${resp.data.text}`);
                const downloadPath = `${this.defaultPath}${this.e.group_id || this.e.user_id}`;
                // 创建文件夹（如果没有过这个群）
                if (!fs.existsSync(downloadPath)) {
                    mkdirsSync(downloadPath);
                }
                // 逐个遍历判断
                let task = [];
                for (let item of resp.includes.media) {
                    if (item.type === "photo") {
                        // 图片
                        task.push(this.downloadImg(item.url, downloadPath));
                    } else if (item.type === "video") {
                        // 视频
                        await this.downloadVideo(resp.includes.media[0].variants[0].url, true).then(
                            _ => {
                                e.reply(segment.video(`${downloadPath}/temp.mp4`));
                            },
                        );
                    }
                }
                // 如果没有图片直接返回走
                if (task.length === 0) {
                    return true;
                }
                // 下面是有图片的情况
                let images = [];
                let path = [];
                // 获取所有图片的promise
                await Promise.all(task).then(resp => {
                    // console.log(resp)
                    resp.forEach(item => {
                        path.push(item);
                        images.push({
                            message: segment.image(fs.readFileSync(item)),
                            nickname: this.e.sender.card || this.e.user_id,
                            user_id: this.e.user_id,
                        });
                    });
                });
                await e.reply(await Bot.makeForwardMsg(images));
                // 清理文件
                path.forEach(item => {
                    fs.unlinkSync(item);
                });
            });
        return true;
    }

    // acfun解析
    async acfun(e) {
        const path = `${this.defaultPath}${this.e.group_id || this.e.user_id}/temp/`;
        if (!fs.existsSync(path)) {
            mkdirsSync(path);
        }

        let inputMsg = e.msg;
        // 适配手机分享：https://m.acfun.cn/v/?ac=32838812&sid=d2b0991bd6ad9c09
        if (inputMsg.includes("m.acfun.cn")) {
            inputMsg = `https://www.acfun.cn/v/ac${/ac=([^&?]*)/.exec(inputMsg)[1]}`;
        }

        parseUrl(inputMsg).then(res => {
            e.reply(`识别：猴山，${res.videoName}`);
            parseM3u8(res.urlM3u8s[res.urlM3u8s.length - 1]).then(res2 => {
                downloadM3u8Videos(res2.m3u8FullUrls, path).then(_ => {
                    mergeAcFileToMp4(res2.tsNames, path, `${path}out.mp4`).then(_ => {
                        e.reply(segment.video(`${path}out.mp4`));
                    });
                });
            });
        });
        return true;
    }

    // 小红书解析
    async redbook(e) {
        const msgUrl = /(http:|https:)\/\/(xhslink|xiaohongshu).com\/[A-Za-z\d._?%&+\-=\/#@]*/.exec(
            e.msg,
        )[0];
        const url = `https://dlpanda.com/zh-CN/xhs?url=${msgUrl}`;

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
            .then(async resp => {
                const reg = /<img(.*)src="\/\/ci\.xiaohongshu\.com(.*?)"/g;

                const downloadPath = `${this.defaultPath}${this.e.group_id || this.e.user_id}`;
                // 创建文件夹（如果没有过这个群）
                if (!fs.existsSync(downloadPath)) {
                    mkdirsSync(downloadPath);
                }
                const res = resp.data.match(reg);
                const imagesPath = res.map(item => {
                    const addr = `https:${item.split('"')[3]}`;
                    return axios
                        .get(addr, {
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                            },
                            responseType: "stream",
                        })
                        .then(resp => {
                            const filepath = `${downloadPath}/${/com\/(.*)\?/.exec(addr)[1]}.jpg`;
                            const writer = fs.createWriteStream(filepath);
                            resp.data.pipe(writer);
                            return new Promise((resolve, reject) => {
                                writer.on("finish", () => resolve(filepath));
                                writer.on("error", reject);
                            });
                        });
                });
                let path = [];
                const images = await Promise.all(imagesPath).then(paths => {
                    return paths.map(item => {
                        path.push(item);
                        return {
                            message: segment.image(fs.readFileSync(item)),
                            nickname: e.sender.card || e.user_id,
                            user_id: e.user_id,
                        };
                    });
                });
                await this.reply(await Bot.makeForwardMsg(images));
                // 清理文件
                path.forEach(item => {
                    fs.unlinkSync(item);
                });
            });

        return true;
    }

    // 文献解析
    async literature(e) {
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

    // 清理垃圾文件
    async clearTrash(e) {
        const directory = "./data/";
        try {
            fs.readdir(directory, (err, files) => {
                for (const file of files) {
                    // 如果文件名符合规则，执行删除操作
                    if (/^[0-9a-f]{32}$/.test(file)) {
                        fs.unlinkSync(directory + file);
                    }
                }
            });
            await e.reply(`清理完成！`);
        } catch (err) {
            console.log(err);
            e.reply("清理失败，重试或者自动清理即可");
        }
    }

    async bodianMusic(e) {
        const msg = e.msg.replace("#波点音乐").trim();
        const API = `https://xiaobai.klizi.cn/API/music/bodian.php?msg=${msg}&n=&max=`;
        // 获取列表
        const thisMethod = this;
        await axios.get(API).then(resp => {
            /**
             * "songName": "山海",
             * "artist": "草东没有派对",
             * "coverUrl": "https://img3.kuwo.cn/wmvpic/324/78/55/3196258119.jpg",
             * "highUrl": "http://other.player.nf03.sycdn.kuwo.cn/f7451ba7f02256b6b5d5ae8a74336502/64172260/resource/m2/55/56/3401786858.mp4?from=bodian",
             * "lowUrl": "http://other.player.nf03.sycdn.kuwo.cn/47e753a5f8350140716e439f1c87dc1f/64172260/resource/m3/50/96/2318372432.mp4?from=bodian",
             * "shortLowUrl": null
             */
            e.reply("请选择一个要播放的视频：\n" + resp.data);
            thisMethod.setContext("bodianMusicContext");
        });
        return true;
    }

    /**
     * @link bodianMusic 波点音乐上下文
     * @returns {Promise<void>}
     */
    async bodianMusicContext() {
        // 当前消息
        const curMsg = this.e;
        // 上一个消息
        const preMsg = await this.getContext().bodianMusicContext;
        const msg = preMsg.msg.replace("#波点音乐", "").trim();
        const API = `https://xiaobai.klizi.cn/API/music/bodian.php?msg=${msg}&n=${Number(
            curMsg.msg,
        )}&max=`;
        const thisMethod = this;
        axios.get(API).then(async res => {
            try {
                const { songName, artist, coverUrl, highUrl, lowUrl, shortLowUrl } = res.data;
                curMsg.reply([`${songName}-${artist}\n`, segment.image(coverUrl)]);
                await thisMethod.downloadVideo(lowUrl).then(path => {
                    curMsg.reply(segment.video(path + "/temp.mp4"));
                });
            } catch (err) {
                curMsg.reply("发生网络错误，请重新发送！");
            } finally {
                thisMethod.finish("bodianMusicContext");
            }
        });
        this.finish("bodianMusicContext");
    }

    /**
     * 哔哩哔哩下载
     * @param title
     * @param videoUrl
     * @param audioUrl
     * @returns {Promise<unknown>}
     */
    async downBili(title, videoUrl, audioUrl) {
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
                    1000,
                ),
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
                    1000,
                ),
            ),
        ]).then(data => {
            return mergeFileToMp4(data[0].fullFileName, data[1].fullFileName, title + ".mp4");
        });
    }

    /**
     * 下载一张网络图片(自动以url的最后一个为名字)
     * @param img
     * @param dir
     * @returns {Promise<unknown>}
     */
    async downloadImg(img, dir) {
        const filename = img.split("/").pop();
        const filepath = `${dir}/${filename}`;
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

    /**
     * douyin 请求参数
     * @param url
     * @returns {Promise<unknown>}
     */
    async douyinRequest(url) {
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

    /**
     * 工具：根URL据下载视频 / 音频
     * @param url       下载地址
     * @param isProxy   是否需要魔法
     * @param headers   覆盖头节点
     * @returns {Promise<unknown>}
     */
    async downloadVideo(url, isProxy = false, headers = null) {
        const groupPath = `${this.defaultPath}${this.e.group_id || this.e.user_id}`;
        if (!fs.existsSync(groupPath)) {
            mkdirsSync(groupPath);
        }
        const target = `${groupPath}/temp.mp4`;
        // 待优化
        if (fs.existsSync(target)) {
            console.log(`视频已存在`);
            fs.unlinkSync(target);
        }
        let res;
        if (isProxy) {
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
        } else {
            res = await axios.get(url, {
                headers: headers || {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                responseType: "stream",
            });
        }

        console.log(`开始下载: ${url}`);
        const writer = fs.createWriteStream(target);
        res.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => resolve(groupPath));
            writer.on("error", reject);
        });
    }
}
