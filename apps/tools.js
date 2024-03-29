// 主库
import fetch from "node-fetch";
import fs from "node:fs";
import { Buffer } from 'node:buffer';
// 其他库
import axios from "axios";
import _ from "lodash";
import tunnel from "tunnel";
import HttpProxyAgent from "https-proxy-agent";
import { checkAndRemoveFile, deleteFolderRecursive, mkdirIfNotExists, readCurrentDir } from "../utils/file.js";
import {
    downloadBFile,
    getBiliAudio,
    getDownloadUrl,
    getDynamic,
    getVideoInfo,
    m4sToMp3,
    mergeFileToMp4
} from "../utils/bilibili.js";
import { downloadM3u8Videos, mergeAcFileToMp4, parseM3u8, parseUrl } from "../utils/acfun.js";
import {
    BILI_DEFAULT_INTRO_LEN_LIMIT,
    DIVIDING_LINE,
    douyinTypeMap,
    REDIS_YUNZAI_ISOVERSEA,
    transMap,
    TWITTER_BEARER_TOKEN,
    XHS_NO_WATERMARK_HEADER,
} from "../constants/constant.js";
import {
    containsChinese,
    downloadImg,
    downloadMp3,
    formatBiliInfo, formatSeconds,
    getIdVideo,
    secondsToTime, testProxy, truncateString
} from "../utils/common.js";
import config from "../model/index.js";
import Translate from "../utils/trans-strategy.js";
import * as xBogus from "../utils/x-bogus.cjs";
import { getBodianAudio, getBodianMusicInfo, getBodianMv } from "../utils/bodian.js";
import { av2BV } from "../utils/bilibili-bv-av-convert.js";
import querystring from "querystring";
import TokenBucket from "../utils/token-bucket.js";
import { getWbi } from "../utils/biliWbi.js";
import {
    BILI_SUMMARY,
    DY_INFO,
    MIYOUSHE_ARTICLE, NETEASE_SONG_DETAIL, NETEASE_SONG_DOWNLOAD,
    TIKTOK_INFO,
    TWITTER_TWEET_INFO,
    XHS_REQ_LINK,
    GENERAL_REQ_LINK, WEIBO_SINGLE_INFO, WEISHI_VIDEO_INFO
} from "../constants/tools.js";
import child_process from 'node:child_process'
import { getAudio, getVideo } from "../utils/y2b.js";
import { processTikTokUrl } from "../utils/tiktok.js";
import { getDS } from "../utils/mihoyo.js";
import GeneralLinkAdapter from "../utils/general-link-adapter.js";
import { mid2id } from "../utils/weibo.js";

export class tools extends plugin {
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
                    reg: "https?:\\/\\/x.com\\/[0-9-a-zA-Z_]{1,20}\\/status\\/([0-9]*)",
                    fnc: "twitter_x",
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
                    reg: "(kuaishou.com|ixigua.com|h5.pipix.com|h5.pipigx.com|tieba.baidu.com|s.xsj.qq.com)",
                    fnc: "general",
                },
                {
                    reg: "(youtube.com)",
                    fnc: "y2b"
                },
                {
                    reg: "(miyoushe.com)",
                    fnc: "miyoushe"
                },
                {
                    reg: "(music.163.com|163cn.tv)",
                    fnc: "netease",
                },
                {
                    reg: "(weibo.com|m.weibo.cn)",
                    fnc: "weibo",
                },
                {
                    reg: "(pixivision.net)",
                    fnc: "pixivision"
                },
                {
                    reg: "(isee.weishi.qq.com)",
                    fnc: "weishi"
                },
                {
                    reg: "share.xiaochuankeji.cn",
                    fnc: "zuiyou"
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
            const dyApi = DY_INFO.replace("{}", douId);
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
                    // console.log(resp)
                    if (_.isEmpty(await resp?.data)) {
                        e.reply("解析失败，请重试！");
                        return;
                    }
                    // console.log(await resp.data)
                    const item = await resp.data.aweme_detail;
                    e.reply(`识别：抖音, ${ item.desc }`);
                    const urlTypeCode = item.aweme_type;
                    const urlType = douyinTypeMap[urlTypeCode];
                    if (urlType === "video") {
                        const resUrl = item.video.play_addr.url_list[0].replace(
                            "http",
                            "https",
                        );
                        const path = `${ this.getCurDownloadPath(e) }/temp.mp4`;
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
        // 判断海外
        const isOversea = await this.isOverseasServer();
        // 如果不是海外用户且没有梯子直接返回
        if (!isOversea && await testProxy()) {
            e.reply("检测到没有梯子，无法解析TikTok");
            return false;
        }
        // 处理链接
        let url = await processTikTokUrl(e.msg.trim(), isOversea);
        // 处理ID
        let tiktokVideoId = await getIdVideo(url);
        tiktokVideoId = tiktokVideoId.replace(/\//g, "");

        const config = {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
            },
            // redirect: "follow",
            follow: 10,
            timeout: 10000,
        }
        // 如果不是海外，则使用代理
        if (!isOversea) {
            config.httpsAgent = tunnel.httpsOverHttp({
                proxy: new HttpProxyAgent(this.myProxy),
            });
        }

        const params = new URLSearchParams({
            "iid": "7318518857994389254",
            "device_id": "7318517321748022790",
            "channel": "googleplay",
            "app_name": "musical_ly",
            "version_code": "300904",
            "device_platform": "android",
            "device_type": "ASUS_Z01QD",
            "os_version": "9",
            "aweme_id": tiktokVideoId
        })
        console.log(`${TIKTOK_INFO}?${params.toString()}`)
        await fetch(`${TIKTOK_INFO}?${params.toString()}`, config)
            .then(async resp => {
                const respJson = await resp.json();
                const data = respJson.aweme_list[0];
                e.reply(`识别：tiktok, ${ data.desc }`);
                this.downloadVideo(data.video.play_addr.url_list[0], !isOversea).then(video => {
                    e.reply(
                        segment.video(
                            `${ this.getCurDownloadPath(e) }/temp.mp4`,
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
        let url = e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim().replaceAll("\\", "");
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
            url = url.replace(matched[0].replace("\/", ""), av2BV(Number(matched[2])));
        }
        // 只提取音乐处理
        if (e.msg !== undefined && e.msg.includes("bili音乐")) {
            return await this.biliMusic(e, url);
        }
        // 动态处理
        if (url.includes("t.bilibili.com") || url.includes("bilibili.com\/opus")) {
            if (_.isEmpty(this.biliSessData)) {
                e.reply("检测到没有填写biliSessData，无法解析动态");
                return true;
            }
            url = this.biliDynamic(e, url, this.biliSessData);
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
        const combineContent = `\n${ formatBiliInfo(dataProcessMap) }\n简介：${ truncateString(desc, this.toolsConfig.biliIntroLenLimit || BILI_DEFAULT_INTRO_LEN_LIMIT) }`;
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
        const path = `${ this.getCurDownloadPath(e) }/`;
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

    // 下载哔哩哔哩音乐
    async biliMusic(e, url) {
        const videoId = /video\/[^\?\/ ]+/.exec(url)[0].split("/")[1];
        getBiliAudio(videoId, "").then(async audioUrl => {
            const path = this.getCurDownloadPath(e);
            e.reply(segment.record(await m4sToMp3(audioUrl, path)));
        })
        return true
    }

    // 发送哔哩哔哩动态的算法
    biliDynamic(e, url, session) {
        // 去除多余参数
        if (url.includes("?")) {
            url = url.substring(0, url.indexOf("?"));
        }
        const dynamicId = /[^/]+(?!.*\/)/.exec(url)[0];
        getDynamic(dynamicId, session).then(async resp => {
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

    // 例子：https://twitter.com/chonkyanimalx/status/1595834168000204800
    async twitter(e) {
        // 配置参数及解析
        const reg = /https?:\/\/twitter.com\/[0-9-a-zA-Z_]{1,20}\/status\/([0-9]*)/;
        const twitterUrl = reg.exec(e.msg);
        const id = twitterUrl[1];
        // 判断是否是海外服务器，默认为false
        const isOversea = !(await this.isOverseasServer());

        // 请求
        const params = {
            "ids": id,
            "media.fields":
                "duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,alt_text,variants",
            "expansions": ["entities.mentions.username", "attachments.media_keys"],
        }
        await fetch(TWITTER_TWEET_INFO.replace("{}", id), {
            headers: {
                "User-Agent": "v2TweetLookupJS",
                "authorization": `Bearer ${ Buffer.from(TWITTER_BEARER_TOKEN, "base64").toString() }`
            },
            ...params,
            agent: !isOversea ? '' : new HttpProxyAgent(this.myProxy),
        }).then(async resp => {
            logger.info(resp)
            e.reply(`识别：小蓝鸟学习版，${ resp.data.text }`);
            const downloadPath = `${ this.getCurDownloadPath(e) }`;
            // 创建文件夹（如果没有过这个群）
            if (!fs.existsSync(downloadPath)) {
                mkdirsSync(downloadPath);
            }
            // 逐个遍历判断
            let task = [];
            for (let item of resp.includes.media) {
                if (item.type === "photo") {
                    // 图片
                    task.push(downloadImg(item.url, downloadPath, "", true));
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

    // 使用现有api解析小蓝鸟
    async twitter_x(e) {
        // 判断海外
        const isOversea = await this.isOverseasServer();
        // 如果不是海外用户且没有梯子直接返回
        if (!isOversea && await testProxy()) {
            e.reply("检测到没有梯子，无法解析TikTok");
            return false;
        }

        // 配置参数及解析
        const reg = /https?:\/\/x.com\/[0-9-a-zA-Z_]{1,20}\/status\/([0-9]*)/;
        const twitterUrl = reg.exec(e.msg)[0];
        // 提取视频
        const videoUrl = GENERAL_REQ_LINK.link.replace("{}", twitterUrl);
        e.reply("识别：小蓝鸟");
        const config = {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',

            },
            timeout: 10000 // 设置超时时间
        }
        // 如果不是海外，则使用代理
        if (!isOversea) {
            config.httpsAgent = tunnel.httpsOverHttp({
                proxy: {
                    host: this.proxyAddr,
                    port: this.proxyPort
                },
            });
        }
        axios.get(videoUrl, config).then(resp => {
            const url = resp.data.data?.url;
            if (url && (url.endsWith(".jpg") || url.endsWith(".png"))) {
                e.reply(segment.image(url));
            } else {
                this.downloadVideo(url).then(path => {
                    e.reply(segment.video(path + "/temp.mp4"));
                });
            }
        });
    }

    // acfun解析
    async acfun(e) {
        const path = `${ this.getCurDownloadPath(e) }/temp/`;
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
        const downloadPath = `${ this.getCurDownloadPath(e) }`;
        // 获取信息
        fetch(`${ XHS_REQ_LINK }${ id }`, {
            headers: XHS_NO_WATERMARK_HEADER,
        }).then(async resp => {
            const xhsHtml = await resp.text();
            const reg = /window\.__INITIAL_STATE__=(.*?)<\/script>/;
            const res = xhsHtml.match(reg)[1].replace(/undefined/g, "null");
            const resJson = JSON.parse(res);
            const noteData = resJson.note.noteDetailMap[id].note;
            const { title, desc, type } = noteData;
            let imgPromise = [];
            if (type === "video") {
                // 封面
                const cover = noteData.imageList?.[0].urlDefault;
                e.reply([segment.image(cover), `识别：小红书, ${ title }\n${ desc }`]);
                // 构造xhs视频链接
                const xhsVideoUrl = noteData.video.media.stream.h264?.[0]?.masterUrl;
                // 下载视频
                this.downloadVideo(xhsVideoUrl).then(path => {
                    if (path === undefined) {
                        // 创建文件，如果不存在
                        path = `${ this.getCurDownloadPath(e) }/`;
                    }
                    e.reply(segment.video(path + "/temp.mp4"));
                });
                return true;
            } else if (type === "normal") {
                e.reply(`识别：小红书, ${ title }\n${ desc }`);
                noteData.imageList.map(async (item, index) => {
                    imgPromise.push(downloadImg(item.urlDefault, downloadPath, index.toString()));
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

    // 清理垃圾文件
    async clearTrash(e) {
        const dataDirectory = "./data/";

        // 删除Yunzai遗留问题的合成视频垃圾文件
        try {
            const files = await readCurrentDir(dataDirectory);
            let dataClearFileLen = 0;
            for (const file of files) {
                // 如果文件名符合规则，执行删除操作
                if (/^[0-9a-f]{32}$/.test(file)) {
                    await fs.promises.unlink(dataDirectory + file);
                    dataClearFileLen++;
                }
            }
            // 删除R插件临时文件
            const rTempFileLen = await deleteFolderRecursive(this.defaultPath)
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
        const downloadPath = `${ this.getCurDownloadPath(e) }`;
        // 判断是否是海外服务器
        const isOversea = await this.isOverseasServer();
        // 简单封装图片下载
        const downloadInsImg = (url, destination) => {
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
                    imgPromise.push(downloadInsImg(imgUrl, `${ downloadPath }/${ index }.jpg`));
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
            const path = `${ this.getCurDownloadPath(e) }`;
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

    // 网易云解析
    async netease(e) {
        let message =
            e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim();
        const musicUrlReg = /(http:|https:)\/\/music.163.com\/song\/media\/outer\/url\?id=(\d+)/;
        const musicUrlReg2 = /(http:|https:)\/\/y.music.163.com\/m\/song\?(.*)&id=(\d+)/;
        const id =
            musicUrlReg2.exec(message)?.[3] ||
            musicUrlReg.exec(message)?.[2] ||
            /id=(\d+)/.exec(message)[1];
        // 如果没有下载地址跳出if
        if (_.isEmpty(id)) {
            e.reply(`识别：网易云音乐，解析失败！`);
            return
        }
        if (typeof message !== "string") {
            return false;
        }
        try {
            // 小程序
            const musicJson = JSON.parse(message);
            const { preview, title, desc } = musicJson.meta.music || musicJson.meta.news;
            e.reply([`识别：网易云音乐，${title}--${desc}`, segment.image(preview)]);
            JSON.parse(message);
            return true;
        } catch (err) {
            axios.get(NETEASE_SONG_DOWNLOAD.replace("{}", id), {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                },
            }).then(async resp => {
                const url = await resp.data.data?.[0].url;
                // 获取歌曲信息
                const title = await axios.get(NETEASE_SONG_DETAIL.replace("{}", id)).then(res => {
                    const song = res.data.songs[0];
                    return `${song?.name}-${song?.ar?.[0].name}`.replace(/[\/\?<>\\:\*\|".… ]/g, "");
                });
                e.reply(`识别：网易云音乐，${title}`);
                // const mvUrlJson = await getKugouMv(title, 1, 1, 0);
                // const mvUrl = mvUrlJson.map(item => item.mv_url)?.[0];
                // this.downloadVideo(mvUrl).then(path => {
                //     e.reply(segment.video(path + "/temp.mp4"));
                // });
                downloadMp3(url, 'follow').then(path => {
                    Bot.acquireGfs(e.group_id).upload(fs.readFileSync(path), '/', `${title.replace(/[\/\?<>\\:\*\|".… ]/g, '')}.mp3`)
                })
                    .catch(err => {
                        console.error(`下载音乐失败，错误信息为: ${err.message}`);
                    });
            })
            return true;
        }
    }

    // 微博解析
    async weibo(e) {
        let weiboId;
        // 对已知情况进行判断
        if (e.msg.includes("m.weibo.cn")) {
            // https://m.weibo.cn/detail/4976424138313924
            weiboId = /(?<=detail\/)[A-Za-z\d]+/.exec(e.msg)?.[0];
        } else if (e.msg.includes("weibo.com\/tv\/show") && e.msg.includes("mid=")) {
            // https://weibo.com/tv/show/1034:5007449447661594?mid=5007452630158934
            weiboId = /(?<=mid=)[A-Za-z\d]+/.exec(e.msg)?.[0];
            weiboId = mid2id(weiboId);
        } else if (e.msg.includes("weibo.com")) {
            // https://weibo.com/1707895270/5006106478773472
            weiboId = /(?<=weibo.com\/)[A-Za-z\d]+\/[A-Za-z\d]+/.exec(e.msg)?.[0];
        }
        // 无法获取id就结束
        if (!weiboId) {
            e.reply("解析失败：无法获取到wb的id");
            return;
        }
        const id = weiboId.split("/")[1] || weiboId;
        axios.get(WEIBO_SINGLE_INFO.replace("{}", id), {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36",
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "cookie": "_T_WM=40835919903; WEIBOCN_FROM=1110006030; MLOGIN=0; XSRF-TOKEN=4399c8",
            }
        })
            .then(async resp => {
                const wbData = resp.data.data;
                const { text, status_title, source, region_name, pics, page_info } = wbData;
                e.reply(`识别：微博，${text.replace(/<[^>]+>/g, '')}\n${status_title}\n${source}\t${region_name}`);
                if (pics) {
                    // 图片
                    const images = pics.map(item => ({
                        message: segment.image(item?.large.url || item.url),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    }));
                    await this.reply(await Bot.makeForwardMsg(images));
                }
                if (page_info) {
                    // 视频
                    const videoUrl = page_info.urls?.mp4_720p_mp4 || page_info.urls?.mp4_hd_mp4;
                    // 文章
                    if (!videoUrl) return true
                    try {
                        this.downloadVideo(videoUrl, false, {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36",
                            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                            "referer": "https://weibo.com/",
                        }).then(path => {
                            e.reply(segment.video(path + "/temp.mp4"));
                        });
                    } catch (err) {
                        e.reply("视频资源获取失败");
                        logger.error("403错误：", err);
                    }
                }
            });
        return true;
    }

    /**
     * 通用解析
     * @param e
     * @return {Promise<void>}
     */
    async general(e) {
        try {
            const adapter = await GeneralLinkAdapter.create(e.msg);
            e.reply(`识别：${ adapter.name }${ adapter.desc ? `, ${ adapter.desc }` : '' }`);
            logger.mark(adapter);
            if (adapter.images && adapter.images.length > 0) {
                const images = adapter.images.map(item => {
                    return {
                        message: segment.image(item),
                        nickname: this.e.sender.card || this.e.user_id,
                        user_id: this.e.user_id,
                    }
                })
                e.reply(Bot.makeForwardMsg(images));
            } else if (adapter.video && adapter.video !== '') {
                // 视频：https://www.kuaishou.com/short-video/3xhjgcmir24m4nm
                const url = adapter.video;
                this.downloadVideo(url).then(path => {
                    e.reply(segment.video(path + "/temp.mp4"));
                });
            } else {
                e.reply("解析失败：无法获取到资源");
            }
        } catch (err) {
            logger.error("解析失败 ", err);
            return true
        }
        return true
    }

    /**
     * youtube解析
     * @param e
     * @returns {Promise<void>}
     */
    async y2b(e) {
        const urlRex = /(?:https?:\/\/)?(www\.)?youtube\.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = urlRex.exec(e.msg)[0];
        // 判断海外
        const isOversea = await this.isOverseasServer();
        // 如果不是海外用户且没有梯子直接返回
        if (!isOversea && await testProxy()) {
            e.reply("检测到没有梯子，无法解析TikTok");
            return false;
        }

        try {
            // Perform the HTTP GET request
            const formData = {
                "link": url,
                "from": "ytbsaver"
            }
            const params = new URLSearchParams();
            Object.keys(formData).forEach(key => params.append(key, formData[key]));

            const config = {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36",
                    "origin": "https://www.ytbsaver.com"
                },
            }
            // 如果不是海外，则使用代理
            if (!isOversea) {
                config.httpsAgent = tunnel.httpsOverHttp({
                    proxy: {
                        host: this.proxyAddr,
                        port: this.proxyPort
                    },
                });
            }

            const response = await axios.post("https://api.ytbvideoly.com/api/thirdvideo/parse", params.toString(), config);

            const {title, /*thumbnail,*/ duration, formats} = response.data.data;
            e.reply(`识别：油管，${title}\n时长：${formatSeconds(duration)}`);
            if (formats.length > 0) {
                // 大概率是720p
                const videoUrl = formats?.[formats.length - 1].url;
                this.downloadVideo(videoUrl).then(path => {
                    e.reply(segment.video(path + "/temp.mp4"));
                });
            }
        } catch (error) {
            console.error(error);
            throw error; // Rethrow the error so it can be handled by the caller
        }
        return true;
    }

    // 米游社
    async miyoushe(e) {
        let url = e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim();
        let msg = /(?:https?:\/\/)?(m|www)\.miyoushe\.com\/[A-Za-z\d._?%&+\-=\/#]*/.exec(url)?.[0];
        const id = /\/(\d+)$/.exec(msg)?.[0].replace("\/", "");

        fetch(MIYOUSHE_ARTICLE.replace("{}", id), {
            headers: {
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-cn",
                "Connection": "keep-alive",
                "Host": "api-takumi.mihoyo.com",
                "x-rpc-app_version": "2.11.0",
                "x-rpc-client_type": "4",
                "Referer": "https://bbs.mihoyo.com/",
                "DS": getDS(),
            }
        }).then(async resp => {
            const respJson = await resp.json();
            // debug专用
            // fs.writeFile('data.json', JSON.stringify(respJson), (err) => {
            //     if (err) {
            //         console.error('Error writing file:', err);
            //     } else {
            //         console.log('JSON saved to file successfully.');
            //     }
            // });
            // return;
            const data = respJson.data.post.post;
            // 分别获取：封面、主题、内容、图片
            const { cover, subject, content, images } = data;
            let realContent = "";
            // safe JSON.parse
            try {
                realContent = JSON.parse(content);
            } catch (e) {
                realContent = content;
            }
            const normalMsg = `识别：米游社，${ subject }\n${ realContent?.describe || "" }`;
            const replyMsg = cover ? [segment.image(cover), normalMsg] : normalMsg;
            e.reply(replyMsg);
            // 图片
            if (images && images.length > 1) {
                const replyImages = images.map(item => {
                    return {
                        message: segment.image(item),
                        nickname: this.e.sender.card || this.e.user_id,
                        user_id: this.e.user_id,
                    }
                });
                e.reply(Bot.makeForwardMsg(replyImages));
            }
            // 视频
            let vod_list = respJson.data.post?.vod_list;
            if (vod_list.length > 0) {
                const resolutions = vod_list?.[0]?.resolutions;
                // 逐个遍历是否包含url
                for (let i = 0; i < resolutions.length; i++) {
                    if (resolutions) {
                        // 暂时选取分辨率较低的video进行解析
                        const videoUrl = resolutions[i].url;
                        this.downloadVideo(videoUrl).then(path => {
                            e.reply(segment.video(path + "/temp.mp4"));
                        });
                        break;
                    }
                }
            }
        })
    }

    // pixivision 解析
    async pixivision(e) {
        let msg = /https:\/\/www\.pixivision\.net\/zh\/a\/(\d+)/.exec(e.msg)[0];
        if (!msg) {
            e.reply("pixivision 无法获取到信息");
            return;
        }
        fetch(msg, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36",
            }
        }).then(async resp => {
            const html = await resp.text();
            // 正则表达式来匹配包含特定类名的img标签，并捕获src属性的值
            const regex = /<img [^>]*src="([^"]*)"[^>]*class="[^"]*am__work__illust[^"]*"[^>]*>/g;

            let matches;
            const srcs = [];
            // 获取图片信息
            while ((matches = regex.exec(html)) !== null) {
                // matches[1] 是正则表达式中第一个括号捕获的内容，即src属性的值
                srcs.push(matches[1]);
            }
            // 获取下载路径
            const curPath = this.getCurDownloadPath(e);
            // 下载图片
            Promise.all(srcs.map((item) => {
                return new Promise((resolve, reject) => { // 使用新的Promise来控制异步流程
                    axios.get(item, {
                        responseType: 'stream',
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36",
                            "Referer": "https://www.pixiv.net/",
                        }
                    }).then(response => {
                        const downloadPath = `${curPath}/${item.split('/').pop()}`;
                        const writer = fs.createWriteStream(downloadPath);
                        response.data.pipe(writer);
                        writer.on('finish', () => resolve(downloadPath)); // 在文件写入完成后解决Promise
                        writer.on('error', reject); // 监听错误事件
                    }).catch(reject); // 处理axios请求的错误
                });
            })).then(path => {
                // 在这里，path数组包含的是所有下载并成功写入的文件路径
                // 你可以在这里执行e.reply，此时所有文件都已经准备好了
                try {
                    // 假设e.reply返回一个Promise
                    e.reply(Bot.makeForwardMsg(path.map(item => ({
                        message: segment.image(fs.readFileSync(item)),
                        nickname: this.e.sender.card || this.e.user_id,
                        user_id: this.e.user_id,
                    }))));

                    // 删除文件操作
                    path.forEach(item => {
                        try {
                            fs.unlinkSync(item);
                        } catch (err) {
                            logger.error(`删除文件${item}失败，请使用命令”清理data垃圾“进行清理`, err);
                        }
                    });
                } catch (error) {
                    logger.error(`发送消息失败`, error);
                }
            });
        });
        return true;
    }

    // 微视
    async weishi(e) {
        // 拦截恶意链接 【后续如果有小程序检测可以删除这个逻辑】
        if (!e.msg.includes('https://isee.weishi.qq.com/ws/app-pages/share/index.html')) {
            e.reply("识别：微视，但无法完整检测到视频ID");
            // 打个日志 方便后面出bug知道位置
            logger.error("[R插件][微视] 无法检测链接")
            return true;
        }

        const url = e.msg;
        try {
            const idMatch = url.match(/id=(.*)&spid/);
            if (!idMatch || idMatch.length !== 2) {
                e.reply("识别：微视，但无法完整检测到视频ID");
                // 打个日志 方便后面出bug知道位置
                logger.error("[R插件][微视] 无法检测到ID，逻辑大概问题在正则表达式")
                return true;
            }

            const feedId = idMatch[1];
            const response = await axios.get(WEISHI_VIDEO_INFO.replace("{}", feedId), {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36",
                }
            });

            const weishiResponse = response.data;
            const firstFeed = weishiResponse.data.feeds[0];
            // 标题、封面、视频链接
            const title = firstFeed.feed_desc;
            const cover = firstFeed.images[0].url;
            const noWatermarkDownloadUrl = firstFeed.video_url;

            e.reply([segment.image(cover), `识别：微视，${ title }`]);

            this.downloadVideo(noWatermarkDownloadUrl).then(path => {
                e.reply(segment.video(path + "/temp.mp4"));
            });
        } catch (err) {
            logger.error(err);
            return true;
        }
        return true;
    }

    async zuiyou(e) {
        // #最右#分享一条有趣的内容给你，不好看算我输。请戳链接>>https://share.xiaochuankeji.cn/hybrid/share/post?pid=365367131&zy_to=applink&share_count=1&m=dc114ccc8e55492642f6a702b510c1f6&d=9e18ca2dace030af656baea96321e0ea353fe5c46097a7f3962b93f995641e962796dd5faa231feea5531ac65547045f&app=zuiyou&recommend=r0&name=n0&title_type=t0
        let msg = e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim();
        const url = /(?:https?:\/\/)?(share|share.xiaochuankeji)\.cn\/[A-Za-z\d._?%&+\-=\/#]*/.exec(msg)[0];
        try {
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36",
                }
            });
            const html = response.data;

            const videoUrlRegex = /fullscreen="false" src="(.*?)"/;
            const videoTitleRegex = /:<\/span><h1>(.*?)<\/h1><\/div><div class=/;
            const videoCoverRegex = /poster="(.*?)"/;
            const videoAuthorRegex = /<span class="SharePostCard__name">(.*?)<\/span>/;

            const videoUrlMatch = html.match(videoUrlRegex);
            const videoTitleMatch = html.match(videoTitleRegex);
            const videoCoverMatch = html.match(videoCoverRegex);
            const videoAuthorMatch = html.match(videoAuthorRegex);

            const imgSrcRegex = /<img [^>]*src="([^"]*)"[^>]*\/>/gi;
            let match;
            const imgSrcs = [];

            while ((match = imgSrcRegex.exec(html)) !== null) {
                imgSrcs.push(match[1]); // Adds the content of the src attribute to the array
            }

            const images = imgSrcs.filter(item => item.startsWith("http://bd-tbfile.izuiyou.com/img/view/id"))

            // Construct the response object
            const shortVideoInfo = {
                authorName: videoAuthorMatch ? videoAuthorMatch[1] : '',
                title: videoTitleMatch ? videoTitleMatch[1] : '',
                cover: videoCoverMatch ? videoCoverMatch[1] : '',
                noWatermarkDownloadUrl: videoUrlMatch ? videoUrlMatch[1] : '',
                images,
            };

            e.reply([segment.image(shortVideoInfo.cover), `识别：最右，${shortVideoInfo.authorName}\n${shortVideoInfo.title}`])

            if (shortVideoInfo.images.length > 0) {
                const replyImages = shortVideoInfo.images.map(item => {
                    return {
                        message: segment.image(item),
                        nickname: this.e.sender.card || this.e.user_id,
                        user_id: this.e.user_id,
                    }
                });
                e.reply(Bot.makeForwardMsg(replyImages));
            }
            if (shortVideoInfo.noWatermarkDownloadUrl) {
                this.downloadVideo(shortVideoInfo.noWatermarkDownloadUrl).then(path => {
                    e.reply(segment.video(path + "/temp.mp4"));
                });
            }
        } catch (error) {
            console.error(error);
            throw error; // Rethrow the error so it can be handled by the caller
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
     * 获取当前发送人/群的下载路径
     * @param e Yunzai 机器人事件
     * @returns {string}
     */
    getCurDownloadPath(e) {
        return `${ this.defaultPath }${ e.group_id || e.user_id }`
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

    /**
     * 设置海外模式
     * @param e
     * @returns {Promise<boolean>}
     */
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
}
