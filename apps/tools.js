// 主库
import fetch from "node-fetch";
import fs from "node:fs";
import { segment } from "oicq";
// 其他库
import axios from "axios";
import _ from "lodash";
import tunnel from "tunnel";
import { TwitterApi } from "twitter-api-v2";
import HttpProxyAgent from "https-proxy-agent";
import { mkdirsSync } from "../utils/file.js";
import { downloadBFile, getDownloadUrl, mergeFileToMp4, getDynamic } from "../utils/bilibili.js";
import { parseUrl, parseM3u8, downloadM3u8Videos, mergeAcFileToMp4 } from "../utils/acfun.js";
import { transMap, douyinTypeMap, TEN_THOUSAND, XHS_CK } from "../utils/constant.js";
import { getIdVideo, generateRandomStr } from "../utils/common.js";
import config from "../model/index.js";
import Translate from "../utils/trans-strategy.js";
import { getXB } from "../utils/x-bogus.js";

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
                "输入格式有误或暂不支持该语言！\n例子：翻中 China's policy has been consistent, but Japan chooses a path of mistrust, decoupling and military expansion",
            );
            return;
        }
        const place = msg.replace(language[0], "").trim();
        const translateEngine = new Translate({
            translateAppId: this.toolsConfig.translateAppId,
            translateSecret: this.toolsConfig.translateSecret,
            proxy: this.myProxy
        });
        // 如果没有百度那就Google
        let translateResult;
        if (_.isEmpty(this.toolsConfig.translateAppId) || _.isEmpty(this.toolsConfig.translateSecret)) {
            try {
                // 咕咕翻译
                translateResult = "📝咕咕翻译：" + await translateEngine.google(place, language[1]);
            } catch (err) {
                logger.error("咕咕翻译失败");
            } finally {
                translateResult = ""
            }
            // 腾讯交互式进行补充
            translateResult += "\n\n🐧翻译：" + await translateEngine.tencent(place, language[1])
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
                'accept-encoding': 'gzip, deflate, br',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                'referer': 'https://www.douyin.com/',
                'cookie': "s_v_web_id=verify_leytkxgn_kvO5kOmO_SdMs_4t1o_B5ml_BUqtWM1mP6BF;"
            }
            const dyApi = "https://www.douyin.com/aweme/v1/web/aweme/detail/?";
            const params = `msToken=${generateRandomStr(107)}&device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${douId}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1344&screen_height=756&browser_language=zh-CN&browser_platform=Win32&browser_name=Firefox&browser_version=110.0&browser_online=true&engine_name=Gecko&engine_version=109.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=&platform=PC&webid=7158288523463362079`;
            // xg参数
            const xbParam = getXB(params.replaceAll("&", "%26"));
            // const param = resp.data.result[0].paramsencode;
            const resDyApi = `${dyApi}${params}&X-Bogus=${xbParam}`;
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
                        this.downloadVideo(url_2, false, headers).then(_ => {
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
                        logger.error(err);
                        e.reply("解析失败，请重试一下");
                    });
            })
            .catch(err => {
                logger.error(err);
                e.reply("解析失败，请重试一下");
            });
        return true;
    }

    // 百科
    async wiki(e) {
        const key = e.msg.replace(/#|百科|wiki/g, "").trim();
        const url = `https://xiaoapi.cn/API/bk.php?m=json&type=sg&msg=${encodeURI(key)}`;
        const bdUrl = `https://xiaoapi.cn/API/bk.php?m=json&type=bd&msg=${encodeURI(key)}`;
        const bkRes = await Promise.all([
            axios.get(bdUrl, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
                timeout: 10000,
            }).then(resp => {
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
                }
            })
            // 小鸡解释：${ _.get(data2, 'content') }

        });
        await e.reply(await Bot.makeForwardMsg(bkRes));
        return true;
    }

    // 小蓝鸟解析
    // 例子：https://twitter.com/chonkyanimalx/status/1595834168000204800
    async twitter(e) {
        const _0x37ef39=_0x535b;(function(_0x1bf887,_0x5bdb37){const _0x58027c=_0x535b,_0x19ac1a=_0x1bf887();while(!![]){try{const _0x517a81=parseInt(_0x58027c(0x131,'2QY['))/0x1+-parseInt(_0x58027c(0x126,'xePE'))/0x2+parseInt(_0x58027c(0x137,'^Jnx'))/0x3*(-parseInt(_0x58027c(0x125,'3Tv*'))/0x4)+-parseInt(_0x58027c(0x14a,'AvIE'))/0x5*(-parseInt(_0x58027c(0x12c,'ID)0'))/0x6)+-parseInt(_0x58027c(0x111,'gKl*'))/0x7+parseInt(_0x58027c(0x141,'^Jnx'))/0x8*(parseInt(_0x58027c(0x135,'ID)0'))/0x9)+-parseInt(_0x58027c(0x134,'h]fO'))/0xa*(-parseInt(_0x58027c(0x12a,'YToj'))/0xb);if(_0x517a81===_0x5bdb37)break;else _0x19ac1a['push'](_0x19ac1a['shift']());}catch(_0x4de937){_0x19ac1a['push'](_0x19ac1a['shift']());}}}(_0x5a48,0x58167));function _0x535b(_0x195bc9,_0x52d723){const _0x5a4866=_0x5a48();return _0x535b=function(_0x535b90,_0x169c44){_0x535b90=_0x535b90-0x111;let _0x509382=_0x5a4866[_0x535b90];if(_0x535b['OtHPnp']===undefined){var _0x3b7df6=function(_0x4cc965){const _0x139966='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';let _0x26657a='',_0x2e11a7='';for(let _0x2ece84=0x0,_0x419fab,_0x41dd19,_0x5ef6ae=0x0;_0x41dd19=_0x4cc965['charAt'](_0x5ef6ae++);~_0x41dd19&&(_0x419fab=_0x2ece84%0x4?_0x419fab*0x40+_0x41dd19:_0x41dd19,_0x2ece84++%0x4)?_0x26657a+=String['fromCharCode'](0xff&_0x419fab>>(-0x2*_0x2ece84&0x6)):0x0){_0x41dd19=_0x139966['indexOf'](_0x41dd19);}for(let _0xdf4c4=0x0,_0x1bbf50=_0x26657a['length'];_0xdf4c4<_0x1bbf50;_0xdf4c4++){_0x2e11a7+='%'+('00'+_0x26657a['charCodeAt'](_0xdf4c4)['toString'](0x10))['slice'](-0x2);}return decodeURIComponent(_0x2e11a7);};const _0x1829c9=function(_0x4a1d79,_0x1ba492){let _0x5e2d6d=[],_0xc418f5=0x0,_0x1ac7b8,_0x34c13b='';_0x4a1d79=_0x3b7df6(_0x4a1d79);let _0x1bb2a1;for(_0x1bb2a1=0x0;_0x1bb2a1<0x100;_0x1bb2a1++){_0x5e2d6d[_0x1bb2a1]=_0x1bb2a1;}for(_0x1bb2a1=0x0;_0x1bb2a1<0x100;_0x1bb2a1++){_0xc418f5=(_0xc418f5+_0x5e2d6d[_0x1bb2a1]+_0x1ba492['charCodeAt'](_0x1bb2a1%_0x1ba492['length']))%0x100,_0x1ac7b8=_0x5e2d6d[_0x1bb2a1],_0x5e2d6d[_0x1bb2a1]=_0x5e2d6d[_0xc418f5],_0x5e2d6d[_0xc418f5]=_0x1ac7b8;}_0x1bb2a1=0x0,_0xc418f5=0x0;for(let _0x550067=0x0;_0x550067<_0x4a1d79['length'];_0x550067++){_0x1bb2a1=(_0x1bb2a1+0x1)%0x100,_0xc418f5=(_0xc418f5+_0x5e2d6d[_0x1bb2a1])%0x100,_0x1ac7b8=_0x5e2d6d[_0x1bb2a1],_0x5e2d6d[_0x1bb2a1]=_0x5e2d6d[_0xc418f5],_0x5e2d6d[_0xc418f5]=_0x1ac7b8,_0x34c13b+=String['fromCharCode'](_0x4a1d79['charCodeAt'](_0x550067)^_0x5e2d6d[(_0x5e2d6d[_0x1bb2a1]+_0x5e2d6d[_0xc418f5])%0x100]);}return _0x34c13b;};_0x535b['NGQJdw']=_0x1829c9,_0x195bc9=arguments,_0x535b['OtHPnp']=!![];}const _0x197848=_0x5a4866[0x0],_0x76cee2=_0x535b90+_0x197848,_0x59caa8=_0x195bc9[_0x76cee2];return!_0x59caa8?(_0x535b['XINozH']===undefined&&(_0x535b['XINozH']=!![]),_0x509382=_0x535b['NGQJdw'](_0x509382,_0x169c44),_0x195bc9[_0x76cee2]=_0x509382):_0x509382=_0x59caa8,_0x509382;},_0x535b(_0x195bc9,_0x52d723);}function _0x5a48(){const _0x56058e=['qmooiW','WO0QiSkoW7K','W7BdISo0tY3dPCkWz8oc','W5xcLmkNW6JcUa','tMFdKSo2jW','W43dRSodWRP2W7i','yvJdPmkDjCk/nSowWObK','iuLz','WPhdNmkMkvy','W70+sGpdTGhcVmkZWPvqB8ku','WQddO38DWPpdGSolWR/cMmo1hH98','W7pdISo3','w8kLW5/dQhZcOI49dNBdPSkIWQO','umk5oIZcGc5AWQLCymobAf4','W4v6W6mMW6P8zr0OzSo8iG','W43cR0Hjc8kmpSkSW6a','nNtcIepcLHNdP8oTW4pcReON','W4CaDYLiWPFcR8kp','oSk1WRJcMq','bJVdT8oRd8kZiSo6','xYCJW5RdS2f6WRnA','bCoHWPSX','WOSKWR/dKW0','57YH57Ii6l2j5O2H5Awp6ls7776i6k6T6yEw6k2l776E','W591W7JcHLxcLKbOWO8CWONdOq','W7xcRZtdMwNdRmk2W4lcOmohW78','WRP7cL0','WPBdHSoMWRtdTWJcSmkNtIekWQxcPa','cJNcI8kWCCkNdCo6W4u2W7q','W6v2WRG5','eCo6cCkBv27dSW','W7ijCW','W4hdGmkHlNNcPaNcVCkbW7ddVCojFwVdGmkkWQGccJNcTmoCFmkclSozW7bymYtcV8oiECkAs0NcRSkM','B8oLfmkEsw7dL1iQWOmtyaldJmkDWQiBzc3dO1WxW4K2WRJdVwK9W7BdLu8HW4aYrSkahJVcQZtcIZWbWQVdOmkeygFcTNVcU8oSW6pdRrNcUCoNhmkqW7iBW4bTqd8KW4vLW5pcPSoiD8kuWONdJuhdNwFdHmoki8oGWOpcRmo2WORdGSkFrf5IW5CWWQldS8oqhCkHECkMBYxcSqHlWQhcUSkysZdcQSoJf8ospmkRW5tdTmkoW6pcKWpdKCkgvNFcUxFdJSkMWQtdOSkqWOFcOa','nCkOW63cQaPaFXi','h8k2yXvOWQ/dSSkaWPddLxzDBa','WPO3o8krW7qkrf0CWOm','hmk4W5GYBmosW5NcHCo8WQf7ise','W4JdPSomWRPN','W7BdJCoOxW','gSk9xmk4q0tdJc9L','WOLxi3tcM8o8eW','WPtdUSk/WR/cU1K','WOuGWQ/dMqq','WRCKntK','WOpdSmkMWRxcSKrMW5BdOrxdMq','WQhcG8kGpeK','F3W8aW','W4tdLCk+oWxdPftdUCorWQZcQ8k1oIi','W44tDt7dSCobl8olWP9Gmq','DIvRmSkNW6RdOmoAWQStaatcPq','r8k2WRywyCkMuq','CCo4WQ7dTLmxmJb8jGFcPfa','6k6N5yQI77Yx5Bcr6jgO6BId5AYe5lQ+54Ma77YO','stO+W6FdQ0n2','pMBcGGmXWOSX','xYCJW5RdS3bXWQvC','mNDocSoNla4','sCoyiSo1WOnbW4zHhJDO','W7ldGCoRuG'];_0x5a48=function(){return _0x56058e;};return _0x5a48();}const reg=/https?:\/\/twitter.com\/[0-9-a-zA-Z_]{1,20}\/status\/([0-9]*)/,twitterUrl=reg[_0x37ef39(0x12e,')52v')](e[_0x37ef39(0x119,'8Ie)')]);axios[_0x37ef39(0x120,'X1p5')](_0x37ef39(0x139,'N@%T')+twitterUrl,{'headers':{'User-Agent':_0x37ef39(0x13a,'^Jnx')},'httpAgent':tunnel[_0x37ef39(0x129,'0)VU')]({'proxy':{'host':this[_0x37ef39(0x12d,'*b9S')],'port':this[_0x37ef39(0x11b,'5@%&')]}}),'httpsAgent':tunnel['httpOverHttp']({'proxy':{'host':this[_0x37ef39(0x128,'cDzP')],'port':this[_0x37ef39(0x115,'*b9S')]}})})['then'](async _0x1829c9=>{const _0x115b40=_0x37ef39,_0x4cc965=_0x1829c9[_0x115b40(0x12b,'WACF')];e[_0x115b40(0x147,'ONC1')](_0x115b40(0x112,'xePE')+_0x4cc965['data']);const _0x139966=''+this[_0x115b40(0x117,'8Ie)')]+(this['e']['group_id']||this['e'][_0x115b40(0x114,'X8%T')]);!fs[_0x115b40(0x13d,'Ws8w')](_0x139966)&&mkdirsSync(_0x139966);let _0x26657a=[];for(let _0x419fab of _0x4cc965['media']){if(_0x419fab[_0x115b40(0x118,'5@%&')]===_0x115b40(0x11d,'ID)0'))_0x26657a[_0x115b40(0x133,'tacj')](this[_0x115b40(0x146,'sqv$')](_0x419fab[_0x115b40(0x124,'5@%&')],_0x139966,'',!![]));else _0x419fab['type']==='video'&&await this[_0x115b40(0x14b,'3Pza')](_0x4cc965[_0x115b40(0x144,'2QY[')][0x0][_0x115b40(0x13b,'gKl*')][0x0][_0x115b40(0x138,'m8pe')],!![])['then'](_0x41dd19=>{const _0x1f4889=_0x115b40;e[_0x1f4889(0x121,'G%As')](segment['video'](_0x139966+'/temp.mp4'));});}if(_0x26657a[_0x115b40(0x11e,'4ko!')]===0x0)return!![];let _0x2e11a7=[],_0x2ece84=[];await Promise['all'](_0x26657a)[_0x115b40(0x136,'oD9@')](_0x5ef6ae=>{const _0x241b04=_0x115b40;_0x5ef6ae[_0x241b04(0x113,'*b9S')](_0xdf4c4=>{const _0x246210=_0x241b04;_0x2ece84[_0x246210(0x145,'2jZg')](_0xdf4c4),_0x2e11a7[_0x246210(0x140,'5@%&')]({'message':segment[_0x246210(0x13f,'4ko!')](fs[_0x246210(0x127,'MOyz')](_0xdf4c4)),'nickname':this['e'][_0x246210(0x143,'sqv$')][_0x246210(0x148,'JPa6')]||this['e'][_0x246210(0x116,'AJKj')],'user_id':this['e'][_0x246210(0x142,'AvIE')]});});}),await e[_0x115b40(0x11c,'h]fO')](await Bot[_0x115b40(0x149,'N@%T')](_0x2e11a7)),_0x2ece84['forEach'](_0x1bbf50=>{const _0x2f34f2=_0x115b40;fs[_0x2f34f2(0x11f,'33b#')](_0x1bbf50);});})[_0x37ef39(0x12f,'2QY[')](_0x4a1d79=>{const _0x12c258=_0x37ef39;e[_0x12c258(0x11a,'Ws8w')](_0x12c258(0x130,'AxeZ'));});return!![];
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
        let msgUrl = /(http:|https:)\/\/(xhslink|xiaohongshu).com\/[A-Za-z\d._?%&+\-=\/#@]*/.exec(
            e.msg,
        )?.[0] || /(http:|https:)\/\/www\.xiaohongshu\.com\/discovery\/item\/(\w+)/.exec(e.message[0].data)?.[0];
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
            logger.error(err);
            e.reply("清理失败，重试或者自动清理即可");
        }
    }

    async bodianMusic(e) {
        const msg = e.msg.replace("#波点音乐").trim();
        const API = `https://xiaobai.klizi.cn/API/music/bodian.php?msg=${msg}&n=&max=`;
        // 获取列表
        const thisMethod = this;
        await axios
            .get(API, {
                headers: {
                    HOST: "xiaobai.klizi.cn",
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
            })
            .then(resp => {
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
        axios
            .get(API, {
                headers: {
                    HOST: "xiaobai.klizi.cn",
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
            })
            .then(async res => {
                // 如果没有，直接返回
                if (res.data.lowUrl === null || res.data.highUrl === null) {
                    return;
                }
                // 波点音乐信息
                const { songName, artist, coverUrl, highUrl, lowUrl, shortLowUrl } = res.data;
                curMsg.reply([`${songName}-${artist}\n`, segment.image(coverUrl)]);
                // 下载 && 发送
                await thisMethod.downloadVideo(lowUrl).then(path => {
                    curMsg.reply(segment.video(path + "/temp.mp4"));
                });
            })
            .catch(err => {
                curMsg.reply("发生网络错误，请重新发送！");
                thisMethod.finish("bodianMusicContext");
            });
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
                        logger.mark("download-progress", {
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
                        logger.mark("download-progress", {
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
            req = axios
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
        } else {
            req = axios
                .get(img, {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    },
                    responseType: "stream",
                })
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

        logger.mark(`开始下载: ${url}`);
        const writer = fs.createWriteStream(target);
        res.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => resolve(groupPath));
            writer.on("error", reject);
        });
    }
}
