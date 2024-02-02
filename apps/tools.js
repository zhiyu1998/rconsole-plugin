// 主库
import fetch from "node-fetch";
import fs from "node:fs";
import { Buffer } from 'node:buffer';
// 其他库
import axios from "axios";
import _ from "lodash";
import tunnel from "tunnel";
import HttpProxyAgent, { HttpsProxyAgent } from "https-proxy-agent";
import { mkdirIfNotExists, checkAndRemoveFile, deleteFolderRecursive } from "../utils/file.js";
import { downloadBFile, getAudioUrl, getDownloadUrl, mergeFileToMp4 } from "../utils/bilibili.js";
import { parseUrl, parseM3u8, downloadM3u8Videos, mergeAcFileToMp4 } from "../utils/acfun.js";
import {
    transMap,
    douyinTypeMap,
    DIVIDING_LINE,
    XHS_NO_WATERMARK_HEADER,
    REDIS_YUNZAI_ISOVERSEA,
} from "../constants/constant.js";
import { containsChinese, formatBiliInfo, getIdVideo, secondsToTime } from "../utils/common.js";
import config from "../model/index.js";
import Translate from "../utils/trans-strategy.js";
import * as xBogus from "../utils/x-bogus.cjs";
import { getVideoInfo, getDynamic } from "../utils/biliInfo.js";
import { getBodianAudio, getBodianMv, getBodianMusicInfo } from "../utils/bodian.js";
import { av2BV } from "../utils/bilibili-bv-av-convert.js";
import querystring from "querystring";
import TokenBucket from "../utils/token-bucket.js";
import { getWbi } from "../utils/biliWbi.js";
import { BILI_SUMMARY } from "../constants/bili.js";
import { XHS_VIDEO } from "../constants/xhs.js";
import child_process from 'node:child_process'
import { getAudio, getVideo } from "../utils/y2b.js";

export class tools extends plugin {
    constructor() {
        super({
            name: "R插件工具和学习类",
            dsc: "R插件工具相关指令",
            event: "message.group",
            priority: 300,
            rule: [
                {
                    reg: `^(翻|trans)[${ tools.Constants.existsTransKey }]`,
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
                    fnc: "xhs",
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
                    reg: "^清理data垃圾$",
                    fnc: "clearTrash",
                    permission: "master",
                },
                {
                    reg: "^#设置海外解析$",
                    fnc: "setOversea",
                    permission: "master",
                },
                {
                    reg: "(h5app.kuwo.cn)",
                    fnc: "bodianMusic",
                },
                {
                    reg: "(kuaishou.com)",
                    fnc: "kuaishou",
                },
                {
                    reg: "(youtube.com)",
                    fnc: "y2b"
                }
            ],
        });
        // 配置文件
        this.toolsConfig = config.getConfig("tools");
        // 视频保存路径
        this.defaultPath = this.toolsConfig.defaultPath;
        // 魔法接口
        this.proxyAddr = this.toolsConfig.proxyAddr;
        this.proxyPort = this.toolsConfig.proxyPort;
        this.myProxy = `http://${ this.proxyAddr }:${ this.proxyPort }`;
        // 加载哔哩哔哩配置
        this.biliSessData = this.toolsConfig.biliSessData;
        // 加载哔哩哔哩的限制时长
        this.biliDuration = this.toolsConfig.biliDuration;
        // 加载抖音Cookie
        this.douyinCookie = this.toolsConfig.douyinCookie;
        // 翻译引擎
        this.translateEngine = new Translate({
            translateAppId: this.toolsConfig.translateAppId,
            translateSecret: this.toolsConfig.translateSecret,
            proxy: this.myProxy,
        });
    }

    // 翻译插件
    async trans(e) {
        const languageReg = /翻(.)/s;
        const msg = e.msg.trim();
        const language = languageReg.exec(msg);
        if (!(language[1] in transMap)) {
            e.reply(
                "输入格式有误或暂不支持该语言！\n例子：翻中 China's policy has been consistent, but Japan chooses a path of mistrust, decoupling and military expansion",
            );
            return;
        }
        const place = msg.slice(1 + language[1].length)
        // 如果没有百度那就Google
        const translateResult = await this.translateEngine.translate(place, language[1]);
        e.reply(translateResult.trim(), true);
        return true;
    }

    // 抖音解析
    async douyin(e) {
        const urlRex = /(http:|https:)\/\/v.douyin.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const douUrl = urlRex.exec(e.msg.trim())[0];

        await this.douyinRequest(douUrl).then(async res => {
            // 当前版本需要填入cookie
            if (_.isEmpty(this.douyinCookie)) {
                e.reply("检测到没有Cookie，无法解析抖音");
                return;
            }
            const douId = /note\/(\d+)/g.exec(res)?.[1] || /video\/(\d+)/g.exec(res)?.[1];
            // 以下是更新了很多次的抖音API历史，且用且珍惜
            // const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${ douId }`;
            // const url = `https://www.iesdouyin.com/aweme/v1/web/aweme/detail/?aweme_id=${ douId }&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`;
            // 感谢 Evil0ctal（https://github.com/Evil0ctal）提供的header 和 B1gM8c（https://github.com/B1gM8c）的逆向算法X-Bogus
            const headers = {
                "accept-encoding": "gzip, deflate, br",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
                Referer: "https://www.douyin.com/",
                cookie: this.douyinCookie,
            };
            const dyApi = `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${ douId }&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1344&screen_height=756&browser_language=zh-CN&browser_platform=Win32&browser_name=Firefox&browser_version=118.0&browser_online=true&engine_name=Gecko&engine_version=109.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=&platform=PC&webid=7284189800734082615&msToken=B1N9FM825TkvFbayDsDvZxM8r5suLrsfQbC93TciS0O9Iii8iJpAPd__FM2rpLUJi5xtMencSXLeNn8xmOS9q7bP0CUsrt9oVTL08YXLPRzZm0dHKLc9PGRlyEk=`;
            // xg参数
            const xbParam = xBogus.sign(
                new URLSearchParams(new URL(dyApi).search).toString(),
                headers["User-Agent"],
            );
            // const param = resp.data.result[0].paramsencode;
            const resDyApi = `${ dyApi }&X-Bogus=${ xbParam }`;
            headers['Referer'] = `https://www.douyin.com/video/${ douId }`
            axios
                .get(resDyApi, {
                    headers,
                })
                .then(async resp => {
                    if (_.isEmpty(resp?.data)) {
                        e.reply("解析失败，请重试！");
                        return;
                    }
                    // console.log(resp.data)
                    const item = resp.data.aweme_detail;
                    e.reply(`识别：抖音, ${ item.desc }`);
                    const urlTypeCode = item.aweme_type;
                    const urlType = douyinTypeMap[urlTypeCode];
                    if (urlType === "video") {
                        const resUrl = item.video.play_addr.url_list[0].replace(
                            "http",
                            "https",
                        );
                        const path = `${ this.defaultPath }${
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
        // 判断是否是海外服务器
        const isOversea = await this.isOverseasServer();
        // 短号处理
        if (url.includes("vt.tiktok")) {
            const temp_url = urlShortRex.exec(url)[0];
            await fetch(temp_url, {
                redirect: "follow",
                follow: 10,
                timeout: 10000,
                agent: isOversea ? '' : new HttpProxyAgent(this.myProxy),
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
                agent: isOversea ? '' : new HttpProxyAgent(this.myProxy),
            }).then(resp => {
                url = resp.url;
            });
        } else {
            url = urlRex.exec(url)[0];
        }
        let tiktokVideoId = await getIdVideo(url);
        tiktokVideoId = tiktokVideoId.replace(/\//g, "");
        // API链接
        const API_URL = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${ tiktokVideoId }`;
        await fetch(API_URL, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                "Content-Type": "application/json",
                "Accept-Encoding": "gzip,deflate,compress",
            },
            // redirect: "follow",
            follow: 10,
            timeout: 10000,
            agent: isOversea ? '' : new HttpProxyAgent(this.myProxy),
        })
            .then(async resp => {
                const respJson = await resp.json();
                const data = respJson.aweme_list[0];
                e.reply(`识别：tiktok, ${ data.desc }`);
                this.downloadVideo(data.video.play_addr.url_list[0], !isOversea).then(video => {
                    e.reply(
                        segment.video(
                            `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp.mp4`,
                        ),
                    );
                });
            });
        return true;
    }

    // bilibi解析
    async bili(e) {
        await this.limitUserUse(e, () => {
            this.biliCore(e);
        });
    }

    async biliCore(e) {
        const urlRex = /(?:https?:\/\/)?www\.bilibili\.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const bShortRex = /(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim();
        // 短号处理
        if (url.includes("b23.tv")) {
            const bShortUrl = bShortRex.exec(url)?.[0];
            await fetch(bShortUrl, {
                method: "HEAD"
            }).then(resp => {
                url = resp.url;
            });
        } else if (url.includes("www.bilibili.com")) {
            url = urlRex.exec(url)[0];
        }
        // 补充https
        url = url.startsWith("https://") ? url : "https://" + url;
        // av处理
        const matched = url.match(/\/(AV|av)(\w+)/);
        if (matched) {
            url = url.replace(matched[0], av2BV(Number(matched[2])));
        }
        // 只提取音乐处理
        if (e.msg !== undefined && e.msg.includes("bili音乐")) {
            await this.biliMusic(url, e);
            return true;
        }
        // 动态处理
        if (url.includes("t.bilibili.com")) {
            url = this.biliDynamic(url, e);
            return true;
        }
        // 视频信息获取例子：http://api.bilibili.com/x/web-interface/view?bvid=BV1hY411m7cB
        // 请求视频信息
        const videoInfo = await getVideoInfo(url);
        const { title, pic, desc, duration, dynamic, stat, bvid, aid, cid, owner, pages } = videoInfo;
        // 视频信息
        let { view, danmaku, reply, favorite, coin, share, like } = stat;
        // 限制时长 & 考虑分页视频情况
        const query = querystring.parse(url);
        const curPage = query?.p || 0;
        const curDuration = pages?.[curPage]?.duration || duration;
        const isLimitDuration = curDuration > this.biliDuration
        // 构造一个可扩展的Map
        const dataProcessMap = {
            "点赞": like,
            "硬币": coin,
            "收藏": favorite,
            "分享": share,
            "总播放量": view,
            "弹幕数量": danmaku,
            "评论": reply
        };
        // 格式化数据
        const combineContent = `\n${ formatBiliInfo(dataProcessMap) }\n简介：${ desc }`;
        let biliInfo = [`识别：哔哩哔哩：${ title }`, combineContent]
        // 总结
        const summary = await this.getBiliSummary(bvid, cid, owner.mid);
        // 不提取音乐，正常处理
        if (isLimitDuration) {
            // 加入图片
            biliInfo.unshift(segment.image(pic))
            // 限制视频解析
            const durationInMinutes = (curDuration / 60).toFixed(0);
            biliInfo.push(`${ DIVIDING_LINE.replace('{}', '限制说明') }\n当前视频时长约：${ durationInMinutes }分钟，\n大于管理员设置的最大时长 ${ this.biliDuration / 60 } 分钟！`)
            summary && biliInfo.push(`\n${ summary }`);
            e.reply(biliInfo);
            return true;
        } else {
            summary && biliInfo.push(`\n${ summary }`);
            e.reply(biliInfo);
        }

        // 创建文件，如果不存在
        const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/`;
        await mkdirIfNotExists(path);
        // 下载文件
        getDownloadUrl(url)
            .then(data => {
                this.downBili(`${ path }temp`, data.videoUrl, data.audioUrl)
                    .then(_ => {
                        e.reply(segment.video(`${ path }temp.mp4`));
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

    async biliMusic(url, e) {
        const { audioUrl } = await getAudioUrl(url);
        e.reply(segment.record(audioUrl))
        return true
    }

    // 发送哔哩哔哩动态的算法
    biliDynamic(url, e) {
        // 去除多余参数
        if (url.includes("?")) {
            url = url.substring(0, url.indexOf("?"));
        }
        const dynamicId = /[^/]+(?!.*\/)/.exec(url)[0];
        getDynamic(dynamicId).then(async resp => {
            if (resp.dynamicSrc.length > 0) {
                e.reply(`识别：哔哩哔哩动态, ${ resp.dynamicDesc }`);
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
        return url;
    }

    /**
     * 哔哩哔哩总结
     * @author zhiyu1998
     * @param bvid 稿件
     * @param cid 视频 cid
     * @param up_mid UP主 mid
     * @return {Promise<void>}
     */
    async getBiliSummary(bvid, cid, up_mid) {
        // 这个有点用，但不多
        let wbi = "wts=1701546363&w_rid=1073871926b3ccd99bd790f0162af634"
        if (!_.isEmpty(this.biliSessData)) {
            wbi = await getWbi({ bvid, cid, up_mid }, this.biliSessData);
        }
        // 构造API
        const summaryUrl = `${ BILI_SUMMARY }?${ wbi }`;
        logger.info(summaryUrl)
        // 构造结果：https://api.bilibili.com/x/web-interface/view/conclusion/get?bvid=BV1L94y1H7CV&cid=1335073288&up_mid=297242063&wts=1701546363&w_rid=1073871926b3ccd99bd790f0162af634
        return axios.get(summaryUrl)
            .then(resp => {
                const data = resp.data.data?.model_result;
                // logger.info(data)
                const summary = data?.summary;
                const outline = data?.outline;
                let resReply = "";
                // 总体总结
                if (summary) {
                    resReply = `\n摘要：${ summary }\n`
                }
                // 分段总结
                if (outline) {
                    const specificTimeSummary = outline.map(item => {
                        const smallTitle = item.title;
                        const keyPoint = item?.part_outline;
                        // 时间点的总结
                        const specificContent = keyPoint.map(point => {
                            const { timestamp, content } = point
                            const specificTime = secondsToTime(timestamp)
                            return `${ specificTime }  ${ content }\n`;
                        }).join("");
                        return `- ${ smallTitle }\n${ specificContent }\n`;
                    });
                    resReply += specificTimeSummary.join("");
                }
                return resReply;
            })
    }

    // 百科
    async wiki(e) {
        const key = e.msg.replace(/#|百科|wiki/g, "").trim();
        const url = `https://xiaoapi.cn/API/bk.php?m=json&type=sg&msg=${ encodeURI(key) }`;
        const bdUrl = `https://xiaoapi.cn/API/bk.php?m=json&type=bd&msg=${ encodeURI(key) }`;
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
                      解释：${ _.get(item, "msg") }\n
                      详情：${ _.get(item, "more") }\n
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
        // 配置参数及解析
        const reg = /https?:\/\/twitter.com\/[0-9-a-zA-Z_]{1,20}\/status\/([0-9]*)/;
        const twitterUrl = reg.exec(e.msg);
        const id = twitterUrl[1];
        // 判断是否是海外服务器，默认为false
        const isProxy = !(await this.isOverseasServer());
        const httpAgent = new HttpsProxyAgent(this.myProxy);
        const twitterClient = new TwitterApi(Buffer.from(TWITTER_BEARER_TOKEN, "base64").toString(), !isProxy ?? { httpAgent });

        // Tell typescript it's a readonly app
        const readOnlyClient = twitterClient.readOnly;
        readOnlyClient.v2
            .singleTweet(id, {
                "media.fields":
                    "duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,alt_text,variants",
                expansions: ["entities.mentions.username", "attachments.media_keys"],
            })
            .then(async resp => {
                e.reply(`识别：小蓝鸟学习版，${ resp.data.text }`);
                const downloadPath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
                // 创建文件夹（如果没有过这个群）
                if (!fs.existsSync(downloadPath)) {
                    mkdirsSync(downloadPath);
                }
                // 逐个遍历判断
                let task = [];
                for (let item of resp.includes.media) {
                    if (item.type === "photo") {
                        // 图片
                        task.push(this.downloadImg(item.url, downloadPath, "", true));
                    } else if (item.type === "video") {
                        // 视频
                        await this.downloadVideo(resp.includes.media[0].variants[0].url, true).then(
                            _ => {
                                e.reply(segment.video(`${ downloadPath }/temp.mp4`));
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
        const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/temp/`;
        await mkdirIfNotExists(path);

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
    async xhs(e) {
        // 正则说明：匹配手机链接、匹配小程序、匹配PC链接
        let msgUrl =
            /(http:|https:)\/\/(xhslink|xiaohongshu).com\/[A-Za-z\d._?%&+\-=\/#@]*/.exec(
                e.msg,
            )?.[0]
            || /(http:|https:)\/\/www\.xiaohongshu\.com\/discovery\/item\/(\w+)/.exec(
                e.message[0].data,
            )?.[0]
            || /(http:|https:)\/\/www\.xiaohongshu\.com\/explore\/(\w+)/.exec(
                e.msg,
            )?.[0]
        // 解析短号
        let id;
        if (msgUrl.includes("xhslink")) {
            await fetch(msgUrl, {
                redirect: "follow",
            }).then(resp => {
                const uri = decodeURIComponent(resp.url);
                // 如果出现了网页验证uri:https://www.xiaohongshu.com/website-login/captcha?redirectPath=https://www.xiaohongshu.com/discovery/item/63c93ac3000000002203b28a?app_platform=android&app_version=8.23.1&author_share=1&ignoreEngage=true&share_from_user_hidden=true&type=normal&xhsshare=CopyLink&appuid=62c58b90000000000303dc54&apptime=1706149572&exSource=&verifyUuid=a5f32b62-453e-426b-98fe-2cfe0c16776d&verifyType=102&verifyBiz=461
                const verify = uri.match(/\/item\/([0-9a-fA-F]+)/);
                // 一般情况下不会出现问题就使用这个正则
                id = /explore\/(\w+)/.exec(uri)?.[1] ?? verify?.[1];
            });
        } else {
            id = /explore\/(\w+)/.exec(msgUrl)?.[1] || /discovery\/item\/(\w+)/.exec(msgUrl)?.[1];
        }
        const downloadPath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
        // 获取信息
        fetch(`https://www.xiaohongshu.com/explore/${ id }`, {
            headers: XHS_NO_WATERMARK_HEADER,
        }).then(async resp => {
            const xhsHtml = await resp.text();
            const reg = /window\.__INITIAL_STATE__=(.*?)<\/script>/;
            const res = xhsHtml.match(reg)[1].replace(/undefined/g, "null");
            const resJson = JSON.parse(res);
            const noteData = resJson.note.noteDetailMap[id].note
            const { title, desc, type } = noteData;
            let imgPromise = [];
            if (type === "video") {
                // 封面
                const cover = noteData.imageList?.[0].urlDefault;
                e.reply([segment.image(cover), `识别：小红书, ${ title }\n${ desc }`]);
                // 构造xhs视频链接
                const xhsVideoUrl = `${ XHS_VIDEO }${ noteData.video.consumer.originVideoKey.replace('pre_post\/', '') }`;
                // 下载视频
                this.downloadVideo(xhsVideoUrl).then(path => {
                    if (path === undefined) {
                        // 创建文件，如果不存在
                        path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/`;
                    }
                    e.reply(segment.video(path + "/temp.mp4"));
                });
                return true;
            } else if (type === "normal") {
                e.reply(`识别：小红书, ${ title }\n${ desc }`);
                noteData.imageList.map(async (item, index) => {
                    imgPromise.push(this.downloadImg(item.urlDefault, downloadPath, index.toString()));
                });
            }
            const paths = await Promise.all(imgPromise);
            const imagesData = await Promise.all(
                paths.map(async item => {
                    const fileContent = await fs.promises.readFile(item);
                    return {
                        message: segment.image(fileContent),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    };
                }),
            );

            // Reply with forward message
            e.reply(await Bot.makeForwardMsg(imagesData));

            // Clean up files
            await Promise.all(paths.map(item => fs.promises.unlink(item)));
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
        const dataDirectory = "./data/";

        try {
            const files = await fs.promises.readdir(dataDirectory);
            let dataClearFileLen = 0;
            for (const file of files) {
                // 如果文件名符合规则，执行删除操作
                if (/^[0-9a-f]{32}$/.test(file)) {
                    await fs.promises.unlink(dataDirectory + file);
                    dataClearFileLen++;
                }
            }
            const rTempFileLen = await deleteFolderRecursive(this.toolsConfig.defaultPath)
            e.reply(
                `数据统计：\n` +
                `- 当前清理了${ dataDirectory }下总计：${ dataClearFileLen } 个垃圾文件\n` +
                `- 当前清理了${ this.toolsConfig.defaultPath }下文件夹：${ rTempFileLen } 个群的所有临时文件`
            );
        } catch (err) {
            logger.error(err);
            await e.reply("清理失败，重试或者手动清理即可");
        }
    }

    // ins解析
    async instagram(e) {
        let suffix = e.msg.match(/(?<=com\/)[\/a-z0-9A-Z].*/)[0];
        if (suffix.startsWith("reel")) {
            suffix = suffix.replace("reel/", "p/");
        }
        const API = `https://imginn.com/${ suffix }`;
        // logger.info(API);
        let imgPromise = [];
        const downloadPath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
        // 判断是否是海外服务器
        const isOversea = await this.isOverseasServer();
        // 简单封装图片下载
        const downloadImg = (url, destination) => {
            return new Promise((resolve, reject) => {
                fetch(url, {
                    timeout: 10000,
                    agent: isOversea ? '' : new HttpProxyAgent(this.myProxy),
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
                e.reply(`识别：Insta，${ desc || "暂无描述" }\n`);
                images.map((item, index) => {
                    const imgUrl = /(?<=data-src=").*?(?=")/
                        .exec(item)[0]
                        .replace(/#38/g, "")
                        .replace(/;/g, "");
                    imgPromise.push(downloadImg(imgUrl, `${ downloadPath }/${ index }.jpg`));
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
            `识别：波点音乐，${ name }-${ album }-${ artist }\n标签：${ categorys
                .map(item => item.name)
                .join(" | ") }`,
            segment.image(albumPic120),
        ]);
        if (e.msg.includes("musicId")) {
            const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
            await getBodianAudio(id, path).then(_ => {
                Bot.acquireGfs(e.group_id).upload(
                    fs.readFileSync(path + "/temp.mp3"),
                    "/",
                    `${ name }-${ album }-${ artist }.mp3`,
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
     * 快手解析
     * @param e
     * @return {Promise<void>}
     */
    async kuaishou(e) {
        // 例子：https://www.kuaishou.com/short-video/3xkfs8p4pnd67p4?authorId=3xkznsztpwetngu&streamSource=find&area=homexxbrilliant
        // https://v.m.chenzhongtech.com/fw/photo/3xburnkmj3auazc
        const msg = e.msg;
        let video_id;
        if (msg.includes('/fw/photo/')) {
            video_id = msg.match(/\/fw\/photo\/([^/?]+)/)[1];
        } else if (msg.includes("short-video")) {
            video_id = msg.match(/short-video\/([^/?]+)/)[1];
        } else {
            e.reply("无法提取快手的信息，请重试或者换一个视频！")
            return
        }
        // 提取视频
        const videoUrl = `https://www.kuaishou.com/short-video/${ video_id }`;

        // 发送GET请求
        const response = await axios.get(videoUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Cookie': 'kpf=PC_WEB; clientid=3; did=web_c5627223fe1e796669894e6cb74f1461; _ga=GA1.1.1139357938.1696318390; didv=1696329758000; _ga_0P9YPW1GQ3=GS1.1.1696659232.14.0.1696659232.0.0.0; kpn=KUAISHOU_VISION',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Google Chrome";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
            },
            timeout: 10000 // 设置超时时间
        });

        // 使用正则表达式提取视频数据
        const videoDataMatch = response.data.match(/"photoH265Url":"(.*?)"/);
        let videoData = videoDataMatch ? videoDataMatch[1] : null;
        if (!videoData) {
            e.reply("快手解析失败，可能原因：解析太多暂时失效，过一段时间再解析！");
            return;
        }
        e.reply("识别：快手")
        videoData = decodeURIComponent(videoData).replace(/\\u002F/g, '/');
        this.downloadVideo(videoData).then(path => {
            e.reply(segment.video(path + "/temp.mp4"));
        });
    }

    /**
     * youtube解析
     * @param e
     * @returns {Promise<void>}
     */
    async y2b(e) {
        const urlRex = /(?:https?:\/\/)?(www\.)?youtube\.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = urlRex.exec(e.msg)[0];
        // 获取url查询参数
        const query = querystring.parse(url.split("?")[1]);
        let p = query?.p || '0';
        let v = query?.v || url.match(/shorts\/([A-Za-z0-9_-]+)/)[1];
        // 判断是否是海外服务器，默认为false
        const isProxy = !(await this.isOverseasServer());

        let audios = [], videos = [];
        let bestAudio = {}, bestVideo = {};

        let rs = { title: '', thumbnail: '', formats: [] };
        try {
            let cmd = `yt-dlp --print-json --skip-download ${ this.y2bCk !== undefined ? `--cookies ${ this.y2bCk }` : '' } '${ url }' ${ isProxy ? `--proxy ${ this.proxyAddr }:${ this.proxyPort }` : '' } 2> /dev/null`
            logger.mark('解析视频, 命令:', cmd);
            rs = child_process.execSync(cmd).toString();
            try {
                rs = JSON.parse(rs);
            } catch (error) {
                let cmd = `yt-dlp --print-json --skip-download ${ this.y2bCk !== undefined ? `--cookies ${ this.y2bCk }` : '' } '${ url }?p=1' ${ isProxy ? `--proxy ${ this.proxyAddr }:${ this.proxyPort }` : '' } 2> /dev/null`;
                logger.mark('尝试分P, 命令:', cmd);
                rs = child_process.execSync(cmd).toString();
                rs = JSON.parse(rs);
                p = '1';
                // url = `${msg.url}?p=1`;
            }
            if (!containsChinese(rs.title)) {
                // 启用翻译引擎翻译不是中文的标题
                const transedTitle = await this.translateEngine.translate(rs.title, '中');
                // const transedDescription = await this.translateEngine.translate(rs.description, '中');
                e.reply(`识别：油管，
                    ${ rs.title.trim() }\n
                    ${ DIVIDING_LINE.replace("{}", "R插件翻译引擎服务") }\n
                    ${ transedTitle }\n
                    ${ rs.description }
                `);
            } else {
                e.reply(`识别：油管，${ rs.title }`);
            }
        } catch (error) {
            logger.error(error.toString());
            e.reply("解析失败")
            return;
        }

        // 格式化
        rs.formats.forEach(it => {
            let length = (it.filesize_approx ? '≈' : '') + ((it.filesize || it.filesize_approx || 0) / 1024 / 1024).toFixed(2);
            if (it.audio_ext != 'none') {
                audios.push(getAudio(it.format_id, it.ext, (it.abr || 0).toFixed(0), it.format_note || it.format || '', length));
            } else if (it.video_ext != 'none') {
                videos.push(getVideo(it.format_id, it.ext, it.resolution, it.height, (it.vbr || 0).toFixed(0), it.format_note || it.format || '', length));
            }
        });

        // 寻找最佳的分辨率
        // bestAudio = Array.from(audios).sort((a, b) => a.rate - b.rate)[audios.length - 1];
        // bestVideo = Array.from(videos).sort((a, b) => a.rate - b.rate)[videos.length - 1];

        // 较为有性能的分辨率
        bestVideo = Array.from(videos).filter(item => item.scale.includes("720") || item.scale.includes("360"))[0];
        bestAudio = Array.from(audios).filter(item => item.format === 'm4a')[0];
        // logger.mark({
        //     bestVideo,
        //     bestAudio
        // })

        // 格式化yt-dlp的请求
        const format = `${ bestVideo.id }x${ bestAudio.id }`
        // 下载地址格式化
        const path = `${ v }${ p ? `/p${ p }` : '' }`;
        const fullpath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }/${ path }`;
        // 创建下载文件夹
        await mkdirIfNotExists(fullpath);
        // yt-dlp下载
        let cmd = //`cd '${__dirname}' && (cd tmp > /dev/null || (mkdir tmp && cd tmp)) &&` +
            `yt-dlp  ${ this.y2bCk !== undefined ? `--cookies ${ this.y2bCk }` : '' } ${url} -f ${ format.replace('x', '+') } ` +
            `-o '${ fullpath }/${ v }.%(ext)s' ${ isProxy ? `--proxy ${ this.proxyAddr }:${ this.proxyPort }` : '' } -k --write-info-json`;
        logger.info(cmd)
        try {
            await child_process.execSync(cmd);
            e.reply(segment.video(`${ fullpath }/${ v }.mp4`))
            // 清理文件
            // await deleteFolderRecursive(`${ fullpath.split('\/').slice(0, -2).join('/') }`);
        } catch (error) {
            logger.error(error.toString());
            e.reply("y2b下载失败");
            return;
        }
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
            return mergeFileToMp4(data[0].fullFileName, data[1].fullFileName, `${ title }.mp4`);
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
        const filepath = `${ dir }/${ fileName }`;
        await mkdirIfNotExists(dir)
        const writer = fs.createWriteStream(filepath);
        const axiosConfig = {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
            },
            responseType: "stream",
        };

        if (isProxy) {
            axiosConfig.httpAgent = tunnel.httpOverHttp({
                proxy: { host: this.proxyAddr, port: this.proxyPort },
            });
            axiosConfig.httpsAgent = tunnel.httpOverHttp({
                proxy: { host: this.proxyAddr, port: this.proxyPort },
            });
        }
        try {
            const res = await axios.get(img, axiosConfig);
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
        } catch (err) {
            logger.error("图片下载失败");
        }
    }

    /**
     * douyin 请求参数
     * @param url
     * @returns {Promise<string>}
     */
    async douyinRequest(url) {
        const params = {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
            },
            timeout: 10000,
        };
        try {
            const resp = await axios.head(url, params);
            const location = resp.request.res.responseUrl;
            return location;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    /**
     * 提取视频下载位置
     * @returns {{groupPath: string, target: string}}
     */
    getGroupPathAndTarget() {
        const groupPath = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`;
        const target = `${ groupPath }/temp.mp4`;
        return { groupPath, target };
    }

    /**
     * 工具：根URL据下载视频 / 音频
     * @param url       下载地址
     * @param isProxy   是否需要魔法
     * @param headers   覆盖头节点
     * @returns {Promise<unknown>}
     */
    async downloadVideo(url, isProxy = false, headers = null) {
        const { groupPath, target } = this.getGroupPathAndTarget.call(this);

        await mkdirIfNotExists(groupPath);

        const userAgent =
            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36";
        const axiosConfig = {
            headers: headers || { "User-Agent": userAgent },
            responseType: "stream",
            ...(isProxy && {
                httpAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
                httpsAgent: tunnel.httpOverHttp({
                    proxy: { host: this.proxyAddr, port: this.proxyPort },
                }),
            }),
        };

        try {
            await checkAndRemoveFile(target);

            const res = await axios.get(url, axiosConfig);
            logger.mark(`开始下载: ${ url }`);
            const writer = fs.createWriteStream(target);
            res.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on("finish", () => resolve(groupPath));
                writer.on("error", reject);
            });
        } catch (err) {
            logger.error(`下载视频发生错误！\ninfo:${ err }`);
        }
    }

    async setOversea(e) {
        // 查看当前设置
        let os;
        if ((await redis.exists(REDIS_YUNZAI_ISOVERSEA))) {
            os = JSON.parse(await redis.get(REDIS_YUNZAI_ISOVERSEA)).os;
        }
        // 设置
        os = ~os
        await redis.set(
            REDIS_YUNZAI_ISOVERSEA,
            JSON.stringify({
                os: os,
            }),
        );
        e.reply(`当前服务器：${ os ? '海外服务器' : '国内服务器' }`)
        return true;
    }

    /**
     * 判断是否是海外服务器
     * @return {Promise<Boolean>}
     */
    async isOverseasServer() {
        // 如果第一次使用没有值就设置
        if (!(await redis.exists(REDIS_YUNZAI_ISOVERSEA))) {
            await redis.set(
                REDIS_YUNZAI_ISOVERSEA,
                JSON.stringify({
                    os: false,
                }),
            );
            return true;
        }
        // 如果有就取出来
        return JSON.parse((await redis.get(REDIS_YUNZAI_ISOVERSEA))).os;
    }

    /**
     * 限制用户调用
     * @param e
     * @param func
     * @return {Promise<void>}
     */
    async limitUserUse(e, func) {
        if (tools.#tokenBucket.consume(e.user_id, 1)) {
            await func();
        } else {
            logger.warn(`解析被限制使用`);
        }
    }

    /**
     * 构造安全的命令
     * @type {{existsPromptKey: string, existsTransKey: string}}
     */
    static Constants = {
        existsTransKey: Object.keys(transMap).join("|"),
    };

    /**
     * 构造令牌桶，防止解析致使服务器宕机（默认限制5s调用一次）
     * @type {TokenBucket}
     */
    static #tokenBucket = new TokenBucket(1, 1, 5);
}
