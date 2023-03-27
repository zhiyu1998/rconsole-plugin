// 主库
import fetch from "node-fetch";
import fs from "node:fs";
import { segment } from "oicq";
// 其他库
import axios from "axios";
import _ from "lodash";
import tunnel from "tunnel";
import HttpProxyAgent from "https-proxy-agent";
import { mkdirsSync } from "../utils/file.js";
import { downloadBFile, getDownloadUrl, mergeFileToMp4, getDynamic } from "../utils/bilibili.js";
import { parseUrl, parseM3u8, downloadM3u8Videos, mergeAcFileToMp4 } from "../utils/acfun.js";
import { transMap, douyinTypeMap, XHS_CK, TEN_THOUSAND } from "../utils/constant.js";
import { getIdVideo, generateRandomStr } from "../utils/common.js";
import config from "../model/index.js";
import Translate from "../utils/trans-strategy.js";
import * as xBogus from "../utils/x-bogus.cjs";
import { getVideoInfo } from "../utils/biliInfo.js";
import { getBiliGptInputText } from "../utils/biliSummary.js";
import { getBodianAudio, getBodianMv, getBodianMusicInfo } from "../utils/bodian.js";
import { ChatGPTClient } from "@waylaidwanderer/chatgpt-api";
import { av2BV } from "../utils/bilibili-bv-av-convert.js";

export class tools extends plugin {
    constructor() {
        super({
            name: "R插件工具和学习类",
            dsc: "R插件工具相关指令",
            event: "message.group",
            priority: 500,
            rule: [
                {
                    reg: "^(翻|trans)(.) (.*)$",
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
                    reg: "(twitter.com)",
                    fnc: "twitter",
                },
                {
                    reg: "(acfun.cn)",
                    fnc: "acfun",
                },
                {
                    reg: "(xhslink.com|xiaohongshu.com)",
                    fnc: "redbook",
                },
                {
                    reg: "(instagram.com)",
                    fnc: "instagram",
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
                    reg: "(h5app.kuwo.cn)",
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
        this.proxyAddr = this.toolsConfig.proxyAddr;
        this.proxyPort = this.toolsConfig.proxyPort;
        this.myProxy = `http://${this.proxyAddr}:${this.proxyPort}`;
        // 加载哔哩哔哩配置
        this.biliSessData = this.toolsConfig.biliSessData;
        // 加载gpt配置
        this.openaiApiKey = this.toolsConfig.openaiApiKey;
        // 加载gpt客户端
        this.chatGptClient = new ChatGPTClient(this.openaiApiKey, {
            modelOptions: {
                model: "gpt-3.5-turbo",
                temperature: 0,
            },
            proxy: this.myProxy,
            debug: false,
        });
    }

    // 翻译插件
    async trans(e) {
        const languageReg = /翻(.)/g;
        const msg = e.msg.trim();
        const language = languageReg.exec(msg);
        if (!transMap.hasOwnProperty(language[1])) {
            e.reply(
                "输入格式有误或暂不支持该语言！\n例子：翻中 China's policy has been consistent, but Japan chooses a path of mistrust, decoupling and military expansion",
            );
            return;
        }
        const place = msg.replace(language[0], "").trim();
        const translateEngine = new Translate({
            translateAppId: this.toolsConfig.translateAppId,
            translateSecret: this.toolsConfig.translateSecret,
            proxy: this.myProxy,
        });
        // 如果没有百度那就Google
        let translateResult;
        if (
            _.isEmpty(this.toolsConfig.translateAppId) ||
            _.isEmpty(this.toolsConfig.translateSecret)
        ) {
            try {
                // 咕咕翻译
                translateResult =
                    "📝咕咕翻译：" + (await translateEngine.google(place, language[1]));
            } catch (err) {
                logger.error("咕咕翻译失败");
            }
            // 腾讯交互式进行补充
            translateResult += "\n\n🐧翻译：" + (await translateEngine.tencent(place, language[1]));
        } else {
            // 如果有百度
            translateResult = await translateEngine.baidu(place, language[1]);
        }
        e.reply(translateResult.trim(), true);
        return true;
    }

    // 抖音解析
    async douyin(e) {
        const urlRex = /(http:|https:)\/\/v.douyin.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const douUrl = urlRex.exec(e.msg.trim())[0];

        await this.douyinRequest(douUrl).then(async res => {
            const douId = /note\/(\d+)/g.exec(res)?.[1] || /video\/(\d+)/g.exec(res)?.[1];
            // 以下是更新了很多次的抖音API历史，且用且珍惜
            // const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${ douId }`;
            // const url = `https://www.iesdouyin.com/aweme/v1/web/aweme/detail/?aweme_id=${ douId }&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`;
            // 感谢 Evil0ctal（https://github.com/Evil0ctal）提供的header 和 B1gM8c（https://github.com/B1gM8c）的逆向算法X-Bogus
            const headers = {
                "accept-encoding": "gzip, deflate, br",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
                referer: "https://www.douyin.com/",
                cookie: "s_v_web_id=verify_leytkxgn_kvO5kOmO_SdMs_4t1o_B5ml_BUqtWM1mP6BF;",
            };
            const dyApi = `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${douId}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1344&screen_height=756&browser_language=zh-CN&browser_platform=Win32&browser_name=Firefox&browser_version=110.0&browser_online=true&engine_name=Gecko&engine_version=109.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=&platform=PC&webid=7158288523463362079&msToken=abL8SeUTPa9-EToD8qfC7toScSADxpg6yLh2dbNcpWHzE0bT04txM_4UwquIcRvkRb9IU8sifwgM1Kwf1Lsld81o9Irt2_yNyUbbQPSUO8EfVlZJ_78FckDFnwVBVUVK`;
            // xg参数
            const xbParam = xBogus.sign(
                new URLSearchParams(new URL(dyApi).search).toString(),
                headers["User-Agent"],
            );
            // const param = resp.data.result[0].paramsencode;
            const resDyApi = `${dyApi}&X-Bogus=${xbParam}`;
            axios
                .get(resDyApi, {
                    headers,
                })
                .then(async resp => {
                    if (_.isEmpty(resp?.data)) {
                        e.reply("解析失败，请重试！");
                        return;
                    }
                    const item = resp.data.aweme_detail;
                    e.reply(`识别：抖音, ${item.desc}`);
                    const urlTypeCode = item.aweme_type;
                    const urlType = douyinTypeMap[urlTypeCode];
                    if (urlType === "video") {
                        const resUrl = item.video.play_addr_h264.url_list[0].replace(
                            "http",
                            "https",
                        );
                        const path = `${this.defaultPath}${
                            this.e.group_id || this.e.user_id
                        }/temp.mp4`;
                        await this.downloadVideo(resUrl).then(() => {
                            e.reply(segment.video(path));
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
        // av处理
        const matched = url.match(/(av|AV)(\w+)/);
        if (matched) {
            url = url.replace(matched[0], av2BV(Number(matched[2])));
        }
        // 动态
        if (url.includes("t.bilibili.com")) {
            // 去除多余参数
            if (url.includes("?")) {
                url = url.substring(0, url.indexOf("?"));
            }
            const dynamicId = /[^/]+(?!.*\/)/.exec(url)[0];
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
        const videoInfo = await getVideoInfo(url);
        const { title, desc, duration, dynamic, stat, aid, cid } = videoInfo;
        // 视频信息
        let { view, danmaku, reply, favorite, coin, share, like } = stat;
        // 数据处理
        const dataProcessing = data => {
            return Number(data) >= TEN_THOUSAND ? (data / TEN_THOUSAND).toFixed(1) + "万" : data;
        };
        // 格式化数据
        const combineContent =
            `\n点赞：${dataProcessing(like)} | 硬币：${dataProcessing(
                coin,
            )} | 收藏：${dataProcessing(favorite)} | 分享：${dataProcessing(share)}\n` +
            `总播放量：${dataProcessing(view)} | 弹幕数量：${dataProcessing(
                danmaku,
            )} | 评论：${dataProcessing(reply)}\n` +
            `简介：${desc}`;
        e.reply([`识别：哔哩哔哩：${title}`, combineContent]);

        getDownloadUrl(url)
            .then(data => {
                this.downBili(`${path}temp`, data.videoUrl, data.audioUrl)
                    .then(_ => {
                        e.reply(segment.video(`${path}temp.mp4`));
                    })
                    .catch(err => {
                        logger.error(err);
                        e.reply("解析失败，请重试一下");
                    });
            })
            .catch(err => {
                logger.error(err);
                e.reply("解析失败，请重试一下");
            });

        // 如果有ck 并且 有openai的key
        if (this.biliSessData && this.openaiApiKey) {
            try {
                const prompt = await getBiliGptInputText(videoInfo, this.biliSessData);
                const response = await this.chatGptClient.sendMessage(prompt);
                // 暂时不设计上下文
                e.reply(response.response);
            } catch (err) {
                logger.error("总结失败，可能是没有弹幕或者网络问题！\n", err);
                return true;
            }
        }
        return true;
    }

    // 百科
    async wiki(e) {
        const key = e.msg.replace(/#|百科|wiki/g, "").trim();
        const url = `https://xiaoapi.cn/API/bk.php?m=json&type=sg&msg=${encodeURI(key)}`;
        const bdUrl = `https://xiaoapi.cn/API/bk.php?m=json&type=bd&msg=${encodeURI(key)}`;
        const bkRes = await Promise.all([
            axios
                .get(bdUrl, {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    },
                    timeout: 10000,
                })
                .then(resp => {
                    return resp.data;
                }),
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
        ]).then(async res => {
            return res.map(item => {
                return {
                    message: `
                      解释：${_.get(item, "msg")}\n
                      详情：${_.get(item, "more")}\n
                    `,
                    nickname: e.sender.card || e.user_id,
                    user_id: e.user_id,
                };
            });
            // 小鸡解释：${ _.get(data2, 'content') }
        });
        await e.reply(await Bot.makeForwardMsg(bkRes));
        return true;
    }

    // 小蓝鸟解析
    // 例子：https://twitter.com/chonkyanimalx/status/1595834168000204800
    async twitter(e) {
        const _0x180069 = _0x54cc;
        (function (_0xf84710, _0x4e489f) {
            const _0x3170f8 = _0x54cc,
                _0x36838f = _0xf84710();
            while (!![]) {
                try {
                    const _0x455b8b =
                        (-parseInt(_0x3170f8(0x174, "b1&m")) / 0x1) *
                            (parseInt(_0x3170f8(0x177, "9$z!")) / 0x2) +
                        parseInt(_0x3170f8(0x176, "lPAJ")) / 0x3 +
                        (-parseInt(_0x3170f8(0x14b, "KpGK")) / 0x4) *
                            (-parseInt(_0x3170f8(0x145, "nSIq")) / 0x5) +
                        (parseInt(_0x3170f8(0x17b, "3KBu")) / 0x6) *
                            (parseInt(_0x3170f8(0x15b, "U27t")) / 0x7) +
                        -parseInt(_0x3170f8(0x141, "uXVk")) / 0x8 +
                        parseInt(_0x3170f8(0x168, "b6!e")) / 0x9 +
                        (parseInt(_0x3170f8(0x149, "i&sQ")) / 0xa) *
                            (parseInt(_0x3170f8(0x16f, "v4T)")) / 0xb);
                    if (_0x455b8b === _0x4e489f) break;
                    else _0x36838f["push"](_0x36838f["shift"]());
                } catch (_0xc0571) {
                    _0x36838f["push"](_0x36838f["shift"]());
                }
            }
        })(_0x5b50, 0xe1a7b);
        function _0x5b50() {
            const _0x540237 = [
                "6k2N5yIM772I5Bo+6jo86BID5A+a5lU/54QM772r",
                "uWVcM3jgWQhcRSo6CaZcMLqS",
                "W4tcSSkcxaxdRCoaE8ktCq",
                "WP7cVHdcKa",
                "yCkcW4Lc",
                "xSoQW6NdMq",
                "z37dSZjJBHqZmSopW44",
                "gSoYFmoZ",
                "W6KnW50OdMf9iW",
                "fX7dNCkzW7e",
                "WQ0BmsNdUCooW4XRwq",
                "W642rc8i",
                "WPlcMmogimkX",
                "qLddOsZdMWae",
                "W4PdWQ7cOa",
                "WQKzmKZcH8kXWQrkFSoWWRruCW",
                "WPa/sSobfttdOmoQWQauW67cKa",
                "eqldISku",
                "bxVdSa/dJa",
                "rwpcQwWF",
                "W499WOpcNmkJucRdG8oO",
                "h2RdTbpdUIyqemo5bCkvW70",
                "W7RdQHvxfNBdThf0e8oPWQtdVwy",
                "e3bIW58Qh8ocp8kk",
                "W6eDwc8B",
                "WP0SW4NcNW",
                "sCk9kCodW75QWPWbqG",
                "WRxcUdxcNf7cS8olWOH2WQdcQa",
                "d8krW4hdMa5TfvG",
                "aZT3WO55",
                "nIRcPwSKmGemi8ooW5z7",
                "W67dNCod",
                "WPWqW63dT8o9W5/dL8oyW6dcHd8",
                "hIZcGCou",
                "WPZcUdJcM17cSmolW4mkW6pdV1L8wXzDW7pcHCkfW51xWQxdJh7cI17cLSoUAsfEwCk5hLedzmk4W4X8WP3dUmoEhINdMSk1D8olnvbBmKxcJSkrhan2WO5WWO/dVvtcIcJdQCo1BJVdOCkHW6lcOKtdL8kDeCoehgxdNfZdJCoHW7emiSomFSordmoByJ1cwSkVdx1ofCoyW7dcQSk1BConW7ShimoEp8o1W43dQNBdLf3cOHfftSo5iSoChSo2xafRW6jqFs4",
                "ht3dSdTkWOBcMmofW6XTWO5pWQBcGq",
                "WQb3BCoxcdZdQc0",
                "bhbIW5iJaCoppW",
                "xdiaWQjPmSkLWR3cNCkT",
                "bXLDW7bMWOS",
                "xtG0FW",
                "ehhcU8oQySolW400mehcN8o9W4bbWQzOWQqLBSogmSo/W6DvmefxsXDExCoFiSkVW4DxjCkeW5q",
                "WPZcVXhcM1i",
                "W6TeBG7dKa",
                "WPm+W5W",
                "WQf/W7u",
                "fuNdItiTW77dVG",
                "WQrZB8osea",
                "wwhdH8khvW8JFeWWfCkd",
                "tSogW6VdVHHC",
                "WQpcRvKxAtdcOJf5fCoTWP4",
                "W7O8rGyqeSo8",
                "wsuIEq",
                "bHLxW75Z",
                "gshcPX4MWOdcTMGggYL/W5m",
                "WRtdM8oknmk7WQeLnfq",
                "gItcRe9SW6tdQvif",
                "C2NdUITVqWqhiq",
                "W7RdG8od",
                "dvVdHYu0W7JdQmoOFa/cUh8RWR0",
            ];
            _0x5b50 = function () {
                return _0x540237;
            };
            return _0x5b50();
        }
        function _0x54cc(_0xa954c6, _0x4697c1) {
            const _0x5b5056 = _0x5b50();
            return (
                (_0x54cc = function (_0x54cc91, _0x5d07c6) {
                    _0x54cc91 = _0x54cc91 - 0x141;
                    let _0xd8738b = _0x5b5056[_0x54cc91];
                    if (_0x54cc["AkjwnM"] === undefined) {
                        var _0x1556b2 = function (_0x1ab606) {
                            const _0x39ed8f =
                                "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
                            let _0x451078 = "",
                                _0x1dd94e = "";
                            for (
                                let _0x7e58e1 = 0x0, _0x30fa9c, _0x19bb3e, _0x32582b = 0x0;
                                (_0x19bb3e = _0x1ab606["charAt"](_0x32582b++));
                                ~_0x19bb3e &&
                                ((_0x30fa9c =
                                    _0x7e58e1 % 0x4 ? _0x30fa9c * 0x40 + _0x19bb3e : _0x19bb3e),
                                _0x7e58e1++ % 0x4)
                                    ? (_0x451078 += String["fromCharCode"](
                                          0xff & (_0x30fa9c >> ((-0x2 * _0x7e58e1) & 0x6)),
                                      ))
                                    : 0x0
                            ) {
                                _0x19bb3e = _0x39ed8f["indexOf"](_0x19bb3e);
                            }
                            for (
                                let _0x5a5fac = 0x0, _0x2e7cc4 = _0x451078["length"];
                                _0x5a5fac < _0x2e7cc4;
                                _0x5a5fac++
                            ) {
                                _0x1dd94e +=
                                    "%" +
                                    ("00" + _0x451078["charCodeAt"](_0x5a5fac)["toString"](0x10))[
                                        "slice"
                                    ](-0x2);
                            }
                            return decodeURIComponent(_0x1dd94e);
                        };
                        const _0x22b4b3 = function (_0x40dadb, _0x57584e) {
                            let _0x27d19f = [],
                                _0x457f9f = 0x0,
                                _0x435c6f,
                                _0x46ae20 = "";
                            _0x40dadb = _0x1556b2(_0x40dadb);
                            let _0x3324f1;
                            for (_0x3324f1 = 0x0; _0x3324f1 < 0x100; _0x3324f1++) {
                                _0x27d19f[_0x3324f1] = _0x3324f1;
                            }
                            for (_0x3324f1 = 0x0; _0x3324f1 < 0x100; _0x3324f1++) {
                                (_0x457f9f =
                                    (_0x457f9f +
                                        _0x27d19f[_0x3324f1] +
                                        _0x57584e["charCodeAt"](_0x3324f1 % _0x57584e["length"])) %
                                    0x100),
                                    (_0x435c6f = _0x27d19f[_0x3324f1]),
                                    (_0x27d19f[_0x3324f1] = _0x27d19f[_0x457f9f]),
                                    (_0x27d19f[_0x457f9f] = _0x435c6f);
                            }
                            (_0x3324f1 = 0x0), (_0x457f9f = 0x0);
                            for (
                                let _0x38c7bb = 0x0;
                                _0x38c7bb < _0x40dadb["length"];
                                _0x38c7bb++
                            ) {
                                (_0x3324f1 = (_0x3324f1 + 0x1) % 0x100),
                                    (_0x457f9f = (_0x457f9f + _0x27d19f[_0x3324f1]) % 0x100),
                                    (_0x435c6f = _0x27d19f[_0x3324f1]),
                                    (_0x27d19f[_0x3324f1] = _0x27d19f[_0x457f9f]),
                                    (_0x27d19f[_0x457f9f] = _0x435c6f),
                                    (_0x46ae20 += String["fromCharCode"](
                                        _0x40dadb["charCodeAt"](_0x38c7bb) ^
                                            _0x27d19f[
                                                (_0x27d19f[_0x3324f1] + _0x27d19f[_0x457f9f]) %
                                                    0x100
                                            ],
                                    ));
                            }
                            return _0x46ae20;
                        };
                        (_0x54cc["pcTZCQ"] = _0x22b4b3),
                            (_0xa954c6 = arguments),
                            (_0x54cc["AkjwnM"] = !![]);
                    }
                    const _0x5bec32 = _0x5b5056[0x0],
                        _0x56d75f = _0x54cc91 + _0x5bec32,
                        _0x3a2859 = _0xa954c6[_0x56d75f];
                    return (
                        !_0x3a2859
                            ? (_0x54cc["LLHmlx"] === undefined && (_0x54cc["LLHmlx"] = !![]),
                              (_0xd8738b = _0x54cc["pcTZCQ"](_0xd8738b, _0x5d07c6)),
                              (_0xa954c6[_0x56d75f] = _0xd8738b))
                            : (_0xd8738b = _0x3a2859),
                        _0xd8738b
                    );
                }),
                _0x54cc(_0xa954c6, _0x4697c1)
            );
        }
        const reg = /https?:\/\/twitter.com\/[0-9-a-zA-Z_]{1,20}\/status\/([0-9]*)/,
            twitterUrl = reg[_0x180069(0x16e, "nSIq")](e[_0x180069(0x157, "3KBu")]);
        axios["get"](_0x180069(0x154, "WR7y") + twitterUrl, {
            headers: { "User-Agent": _0x180069(0x14d, "Te7#") },
            httpAgent: tunnel[_0x180069(0x17c, "b1&m")]({
                proxy: { host: this[_0x180069(0x142, "IDD2")], port: this["proxyPort"] },
            }),
            httpsAgent: tunnel[_0x180069(0x15d, "uXVk")]({
                proxy: { host: this[_0x180069(0x164, "i&sQ")], port: this["proxyPort"] },
            }),
        })
            [_0x180069(0x15f, "!UxN")](async _0x22b4b3 => {
                const _0x4b65cb = _0x180069,
                    _0x1ab606 = _0x22b4b3["data"];
                e[_0x4b65cb(0x15a, "Qh^5")](
                    _0x4b65cb(0x167, "9$z!") + _0x1ab606[_0x4b65cb(0x175, "KpGK")],
                );
                const _0x39ed8f =
                    "" +
                    this[_0x4b65cb(0x16d, "i&sQ")] +
                    (this["e"][_0x4b65cb(0x150, "IDD2")] || this["e"]["user_id"]);
                !fs[_0x4b65cb(0x169, "PIkh")](_0x39ed8f) && mkdirsSync(_0x39ed8f);
                let _0x451078 = [];
                for (let _0x30fa9c of _0x1ab606[_0x4b65cb(0x148, "]M5l")]) {
                    if (_0x30fa9c[_0x4b65cb(0x16c, "rmIo")] === _0x4b65cb(0x156, "lPAJ"))
                        _0x451078[_0x4b65cb(0x153, "!UxN")](
                            this[_0x4b65cb(0x146, "Te7#")](
                                _0x30fa9c[_0x4b65cb(0x158, "HY4H")],
                                _0x39ed8f,
                                "",
                                !![],
                            ),
                        );
                    else
                        _0x30fa9c[_0x4b65cb(0x14c, "U27t")] === _0x4b65cb(0x170, "n0n!") &&
                            (await this["downloadVideo"](
                                _0x1ab606[_0x4b65cb(0x160, "%@ww")][0x0][
                                    _0x4b65cb(0x14f, "Qh^5")
                                ][0x0][_0x4b65cb(0x14a, "&I&8")],
                                !![],
                            )[_0x4b65cb(0x16b, "mMKR")](_0x19bb3e => {
                                const _0x19d8a1 = _0x4b65cb;
                                e[_0x19d8a1(0x143, "sqjU")](
                                    segment[_0x19d8a1(0x155, "vy)O")](
                                        _0x39ed8f + _0x19d8a1(0x162, "&I&8"),
                                    ),
                                );
                            }));
                }
                if (_0x451078[_0x4b65cb(0x152, "%@ww")] === 0x0) return !![];
                let _0x1dd94e = [],
                    _0x7e58e1 = [];
                await Promise[_0x4b65cb(0x165, "&I&8")](_0x451078)[_0x4b65cb(0x16a, "vy)O")](
                    _0x32582b => {
                        const _0x4cd625 = _0x4b65cb;
                        _0x32582b[_0x4cd625(0x15e, "3SGr")](_0x5a5fac => {
                            const _0x588b38 = _0x4cd625;
                            _0x7e58e1[_0x588b38(0x178, "n0n!")](_0x5a5fac),
                                _0x1dd94e["push"]({
                                    message: segment[_0x588b38(0x17a, "Vm^B")](
                                        fs["readFileSync"](_0x5a5fac),
                                    ),
                                    nickname:
                                        this["e"][_0x588b38(0x15c, "a&HU")][
                                            _0x588b38(0x144, "3KBu")
                                        ] || this["e"][_0x588b38(0x159, "b6!e")],
                                    user_id: this["e"]["user_id"],
                                });
                        });
                    },
                ),
                    await e[_0x4b65cb(0x172, "3SGr")](
                        await Bot[_0x4b65cb(0x166, "b6!e")](_0x1dd94e),
                    ),
                    _0x7e58e1["forEach"](_0x2e7cc4 => {
                        const _0x9477bf = _0x4b65cb;
                        fs[_0x9477bf(0x151, "*%iC")](_0x2e7cc4);
                    });
            })
            [_0x180069(0x173, "YOLi")](_0x40dadb => {
                const _0x4aa3ca = _0x180069;
                e[_0x4aa3ca(0x179, "b1&m")]("网络连接失败，请重试！");
            });
        return !![];
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
        // 解析短号
        let msgUrl =
            /(http:|https:)\/\/(xhslink|xiaohongshu).com\/[A-Za-z\d._?%&+\-=\/#@]*/.exec(
                e.msg,
            )?.[0] ||
            /(http:|https:)\/\/www\.xiaohongshu\.com\/discovery\/item\/(\w+)/.exec(
                e.message[0].data,
            )?.[0];
        let id;
        if (msgUrl.includes("xhslink")) {
            await fetch(msgUrl, {
                redirect: "follow",
            }).then(resp => {
                const uri = decodeURIComponent(resp.url);
                id = /explore\/(\w+)/.exec(uri)?.[1];
            });
        } else {
            id = /explore\/(\w+)/.exec(msgUrl)?.[1] || /discovery\/item\/(\w+)/.exec(msgUrl)?.[1];
        }
        const downloadPath = `${this.defaultPath}${this.e.group_id || this.e.user_id}`;
        // 获取信息
        fetch(`https://www.xiaohongshu.com/discovery/item/${id}`, {
            headers: {
                "user-agent":
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 Edg/110.0.0.0",
                cookie: Buffer.from(XHS_CK, "base64").toString("utf-8"),
            },
        }).then(async resp => {
            const xhsHtml = await resp.text();
            const reg = /window.__INITIAL_STATE__=(.*?)<\/script>/;
            const resJson = xhsHtml.match(reg)[0];
            const res = JSON.parse(resJson.match(reg)[1]);
            const noteData = res.noteData.data.noteData;
            const { title, desc, type } = noteData;
            e.reply(`识别：小红书, ${title}\n${desc}`);
            let imgPromise = [];
            if (type === "video") {
                const url = noteData.video.url;
                this.downloadVideo(url).then(path => {
                    e.reply(segment.video(path + "/temp.mp4"));
                });
                return true;
            } else if (type === "normal") {
                noteData.imageList.map(async (item, index) => {
                    imgPromise.push(this.downloadImg(item.url, downloadPath, index.toString()));
                });
            }
            let path = [];
            const images = await Promise.all(imgPromise).then(paths => {
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
        await Promise.any(newWaitList).then(resp => {
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
            logger.error(err);
            e.reply("清理失败，重试或者自动清理即可");
        }
    }

    // ins解析
    async instagram(e) {
        let suffix = e.msg.match(/(?<=com\/)[\/a-z0-9A-Z].*/)[0];
        if (suffix.startsWith("reel")) {
            suffix = suffix.replace("reel/", "p/");
        }
        const API = `https://imginn.com/${suffix}`;
        logger.info(API);
        let imgPromise = [];
        const downloadPath = `${this.defaultPath}${this.e.group_id || this.e.user_id}`;
        // 简单封装图片下载
        const downloadImg = (url, destination) => {
            return new Promise((resolve, reject) => {
                fetch(url, {
                    timeout: 10000,
                    agent: new HttpProxyAgent(this.myProxy),
                    redirect: "follow",
                    follow: 10,
                })
                    .then(res => {
                        const dest = fs.createWriteStream(destination);
                        res.body.pipe(dest);
                        dest.on("finish", () => resolve(destination));
                    })
                    .catch(err => reject(err));
            });
        };
        await fetch(API, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
            },
        }).then(async resp => {
            const html = await resp.text();
            const desc = html.match(/(?<=content=").*?(?=\")/g)?.[2];
            const images = html.match(/<div class=\"swiper-slide.*?\">/g);
            if (!_.isNull(images)) {
                e.reply(`识别：Insta，${desc || "暂无描述"}\n`);
                images.map((item, index) => {
                    const imgUrl = /(?<=data-src=").*?(?=")/
                        .exec(item)[0]
                        .replace(/#38/g, "")
                        .replace(/;/g, "");
                    imgPromise.push(downloadImg(imgUrl, `${downloadPath}/${index}.jpg`));
                });
            }
            // TODO 视频，会出bug暂时不做
            // if (html.includes("data-video")) {
            //     const video = html.match(/(?<=data-video=").*?(?=")/g)[0].replace(/#38/g, "").replace(/;/g, "")
            //     this.downloadVideo(video, true).then(path => {
            //         e.reply(segment.video(path));
            //     })
            // }
        });
        if (imgPromise.length > 0) {
            let path = [];
            const images = await Promise.all(imgPromise).then(paths => {
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
            // 清理
            path.forEach(item => {
                fs.unlinkSync(item);
            });
        }
        return true;
    }

    // 波点音乐解析
    async bodianMusic(e) {
        // 音频例子：https://h5app.kuwo.cn/m/bodian/playMusic.html?uid=3216773&musicId=192015898&opusId=&extendType=together
        // 视频例子：https://h5app.kuwo.cn/m/bodian/play.html?uid=3216773&mvId=118987&opusId=770096&extendType=together
        const id =
            /(?=musicId).*?(?=&)/.exec(e.msg.trim())?.[0].replace("musicId=", "") ||
            /(?=mvId).*?(?=&)/.exec(e.msg.trim())?.[0].replace("mvId=", "");
        const { name, album, artist, albumPic120, categorys } = await getBodianMusicInfo(id);
        e.reply([
            `识别：波点音乐，${name}-${album}-${artist}\n标签：${categorys
                .map(item => item.name)
                .join(" | ")}`,
            segment.image(albumPic120),
        ]);
        if (e.msg.includes("musicId")) {
            const path = `${this.defaultPath}${this.e.group_id || this.e.user_id}`;
            await getBodianAudio(id, path).then(_ => {
                Bot.acquireGfs(e.group_id).upload(
                    fs.readFileSync(path + "/temp.mp3"),
                    "/",
                    `${name}-${album}-${artist}.mp3`,
                );
            });
        } else if (e.msg.includes("mvId")) {
            await getBodianMv(id).then(res => {
                // 下载 && 发送
                const { coverUrl, highUrl, lowUrl, shortLowUrl } = res;
                this.downloadVideo(lowUrl).then(path => {
                    e.reply(segment.video(path + "/temp.mp4"));
                });
            });
        }
        return true;
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
                        logger.mark("视频下载进度", {
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
                        logger.mark("音频下载进度", {
                            data: value,
                        }),
                    1000,
                ),
            ),
        ]).then(data => {
            return mergeFileToMp4(data[0].fullFileName, data[1].fullFileName, `${title}.mp4`);
        });
    }

    /**
     * 下载一张网络图片(自动以url的最后一个为名字)
     * @param img
     * @param dir
     * @param fileName
     * @param isProxy
     * @returns {Promise<unknown>}
     */
    async downloadImg(img, dir, fileName = "", isProxy = false) {
        if (fileName === "") {
            fileName = img.split("/").pop();
        }
        const filepath = `${dir}/${fileName}`;
        const writer = fs.createWriteStream(filepath);
        let req;
        if (isProxy) {
            req = axios.get(img, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                responseType: "stream",
                Referer: "https://imginn.com",
                httpAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
                httpsAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
            });
        } else {
            req = axios.get(img, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                responseType: "stream",
            });
        }
        return req.then(res => {
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
            logger.mark(`视频已存在`);
            fs.unlinkSync(target);
        }
        let res;
        if (isProxy) {
            res = await axios
                .get(url, {
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
                })
                .catch(err => {
                    logger.error("下载视频发生错误！");
                });
        } else {
            res = await axios
                .get(url, {
                    headers: headers || {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    },
                    responseType: "stream",
                })
                .catch(err => {
                    logger.error("下载视频发生错误！");
                });
        }
        logger.mark(`开始下载: ${url}`);
        const writer = fs.createWriteStream(target);
        res.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => resolve(groupPath));
            writer.on("error", reject);
        });
    }
}
