import axios from "axios";
import { exec, execSync } from "child_process";
import { HttpsProxyAgent } from 'https-proxy-agent';
import _ from "lodash";
import fetch from "node-fetch";
import { Buffer } from 'node:buffer';
import fs from "node:fs";
import PQueue from 'p-queue';
import path from "path";
import querystring from "querystring";
import {
    BILI_CDN_SELECT_LIST,
    BILI_DEFAULT_INTRO_LEN_LIMIT,
    COMMON_USER_AGENT,
    DIVIDING_LINE,
    douyinTypeMap,
    DOWNLOAD_WAIT_DETECT_FILE_TIME,
    HELP_DOC,
    MESSAGE_RECALL_TIME,
    REDIS_YUNZAI_ISOVERSEA,
    REDIS_YUNZAI_LAGRANGE,
    REDIS_YUNZAI_WHITELIST,
    SUMMARY_PROMPT,
    transMap,
    TWITTER_BEARER_TOKEN,
    XHS_NO_WATERMARK_HEADER,
} from "../constants/constant.js";
import {
    ANIME_SERIES_SEARCH_LINK,
    ANIME_SERIES_SEARCH_LINK2,
    BILI_EP_INFO,
    BILI_ONLINE,
    BILI_SSID_INFO,
    BILI_STREAM_INFO,
    BILI_SUMMARY,
    DY_COMMENT,
    DY_INFO,
    DY_TOUTIAO_INFO,
    GENERAL_REQ_LINK,
    HIBI_API_SERVICE,
    MIYOUSHE_ARTICLE,
    NETEASE_API_CN,
    NETEASE_SONG_DOWNLOAD,
    NETEASE_TEMP_API,
    QISHUI_MUSIC_TEMP_API,
    QQ_MUSIC_TEMP_API,
    TWITTER_TWEET_INFO,
    WEIBO_SINGLE_INFO,
    WEISHI_VIDEO_INFO,
    XHS_REQ_LINK
} from "../constants/tools.js";
import config from "../model/config.js";
import * as aBogus from "../utils/a-bogus.cjs";
import { downloadM3u8Videos, mergeAcFileToMp4, parseM3u8, parseUrl } from "../utils/acfun.js";
import { startBBDown } from "../utils/bbdown-util.js";
import { av2BV } from "../utils/bilibili-bv-av-convert.js";
import {
    BILI_HEADER,
    downloadBFile,
    filterBiliDescLink,
    getBiliAudio,
    getDownloadUrl,
    getDynamic,
    getScanCodeData,
    getVideoInfo,
    m4sToMp3,
    mergeFileToMp4
} from "../utils/bilibili.js";
import { getWbi } from "../utils/biliWbi.js";
import { getBodianAudio, getBodianMusicInfo, getBodianMv } from "../utils/bodian.js";
import {
    checkToolInCurEnv,
    cleanFilename,
    downloadAudio,
    downloadImg,
    estimateReadingTime,
    formatBiliInfo,
    retryAxiosReq,
    secondsToTime,
    testProxy,
    truncateString,
    urlTransformShortLink
} from "../utils/common.js";
import { extractKeyframes } from "../utils/ffmpeg-util.js";
import {
    checkAndRemoveFile,
    deleteFolderRecursive,
    getMediaFilesAndOthers,
    mkdirIfNotExists,
    readCurrentDir
} from "../utils/file.js";
import GeneralLinkAdapter from "../utils/general-link-adapter.js";
import { LagrangeAdapter } from "../utils/lagrange-adapter.js";
import { contentEstimator } from "../utils/link-share-summary-util.js";
import { deepSeekChat, llmRead } from "../utils/llm-util.js";
import { getDS } from "../utils/mihoyo.js";
import { OpenaiBuilder } from "../utils/openai-builder.js";
import { redisExistKey, redisGetKey, redisSetKey } from "../utils/redis-util.js";
import { saveTDL, startTDL } from "../utils/tdl-util.js";
import Translate from "../utils/trans-strategy.js";
import { mid2id } from "../utils/weibo.js";
import { ytDlpGetTilt, ytDlpHelper } from "../utils/yt-dlp-util.js";
import { textArrayToMakeForward } from "../utils/yunzai-util.js";

export class tools extends plugin {
    /**
     * 用于计数applemusic，达到一定数量清理文件
     * @type {number}
     */
    static #amCount = 0;
    /**
     * 构造安全的命令
     * @type {{existsPromptKey: string, existsTransKey: string}}
     */
    static Constants = {
        existsTransKey: Object.keys(transMap).join("|"),
    };

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
                    reg: "^#(RBQ|rbq)$",
                    fnc: "biliScan",
                    permission: 'master',
                },
                {
                    reg: "(bilibili.com|b23.tv|t.bilibili.com|^BV[1-9a-zA-Z]{10}$)",
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
                    reg: "(h5app.kuwo.cn)",
                    fnc: "bodianMusic",
                },
                {
                    reg: "(kuaishou.com|ixigua.com|h5.pipix.com|h5.pipigx.com|s.xsj.qq.com|m.okjike.com)",
                    fnc: "general",
                },
                {
                    reg: "(youtube.com|youtu.be|music.youtube.com)",
                    fnc: "sy2b"
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
                    reg: "(weishi.qq.com)",
                    fnc: "weishi"
                },
                {
                    reg: "share.xiaochuankeji.cn",
                    fnc: "zuiyou"
                },
                {
                    reg: "(music.apple.com|open.spotify.com)",
                    fnc: "freyr"
                },
                {
                    reg: "(^#总结一下(http|https):\/\/.*|mp.weixin|arxiv.org|sspai.com|chinadaily.com.cn|zhihu.com)",
                    fnc: "linkShareSummary"
                },
                {
                    reg: "(y.qq.com)",
                    fnc: "qqMusic"
                },
                {
                    reg: "(qishui.douyin.com)",
                    fnc: "qishuiMusic"
                },
                {
                    reg: "https:\\/\\/t\\.me\\/(?:c\\/\\d+\\/\\d+\\/\\d+|c\\/\\d+\\/\\d+|\\w+\\/\\d+\\/\\d+|\\w+\\/\\d+\\?\\w+=\\d+|\\w+\\/\\d+)",
                    fnc: "aircraft"
                },
                {
                    reg: "tieba.baidu.com",
                    fnc: "tieba"
                },
                {
                    reg: '^#验车(.*?)',
                    fnc: 'yc'
                }
            ],
        });
        // 配置文件
        this.toolsConfig = config.getConfig("tools");
        // 视频保存路径
        this.defaultPath = this.toolsConfig.defaultPath;
        // 视频限制大小
        this.videoSizeLimit = this.toolsConfig.videoSizeLimit;
        // 魔法接口
        this.proxyAddr = this.toolsConfig.proxyAddr;
        this.proxyPort = this.toolsConfig.proxyPort;
        this.myProxy = `http://${ this.proxyAddr }:${ this.proxyPort }`;
        // 加载识别前缀
        this.identifyPrefix = this.toolsConfig.identifyPrefix;
        // 加载哔哩哔哩配置
        this.biliSessData = this.toolsConfig.biliSessData;
        // 加载哔哩哔哩的限制时长
        this.biliDuration = this.toolsConfig.biliDuration;
        // 加载是否显示哔哩哔哩的封面
        this.biliDisplayCover = this.toolsConfig.biliDisplayCover;
        // 加载是否显示哔哩哔哩的视频信息
        this.biliDisplayInfo = this.toolsConfig.biliDisplayInfo;
        // 加载是否显示哔哩哔哩的简介
        this.biliDisplayIntro = this.toolsConfig.biliDisplayIntro;
        // 加载是否显示哔哩哔哩的在线人数
        this.biliDisplayOnline = this.toolsConfig.biliDisplayOnline;
        // 加载是否显示哔哩哔哩的总结
        this.biliDisplaySummary = this.toolsConfig.biliDisplaySummary;
        // 加载哔哩哔哩是否使用BBDown
        this.biliUseBBDown = this.toolsConfig.biliUseBBDown;
        // 加载 BBDown 的CDN配置
        this.biliCDN = this.toolsConfig.biliCDN;
        // 加载哔哩哔哩是否使用Aria2
        this.biliDownloadMethod = this.toolsConfig.biliDownloadMethod;
        // 加载哔哩哔哩最高分辨率
        this.biliResolution = this.toolsConfig.biliResolution;
        // 加载抖音Cookie
        this.douyinCookie = this.toolsConfig.douyinCookie;
        // 加载抖音是否压缩
        this.douyinCompression = this.toolsConfig.douyinCompression;
        // 加载抖音是否开启评论
        this.douyinComments = this.toolsConfig.douyinComments;
        // 加载小红书Cookie
        this.xiaohongshuCookie = this.toolsConfig.xiaohongshuCookie;
        // 翻译引擎
        this.translateEngine = new Translate({
            deeplApiUrls: this.toolsConfig.deeplApiUrls,
            proxy: this.myProxy,
        });
        // 并发队列
        this.queue = new PQueue({ concurrency: Number(this.toolsConfig.queueConcurrency) });
        // 视频下载的并发数量
        this.videoDownloadConcurrency = this.toolsConfig.videoDownloadConcurrency;
        // ai接口
        this.aiBaseURL = this.toolsConfig.aiBaseURL;
        // ai api key
        this.aiApiKey = this.toolsConfig.aiApiKey;
        // ai模型
        this.aiModel = this.toolsConfig.aiModel;
    }

    // 翻译插件
    async trans(e) {
        const languageReg = /翻(.)/s;
        let msg = e.msg.trim();
        const language = languageReg.exec(msg);
        if (!(language[1] in transMap)) {
            e.reply(
                "输入格式有误或暂不支持该语言！\n例子：翻中 China's policy has been consistent, but Japan chooses a path of mistrust, decoupling and military expansion",
            );
            return;
        }
        let place = msg.slice(1 + language[1].length)
        if (_.isEmpty(place)) {
            const reply = await e?.getReply();
            if (reply !== undefined) {
                place = reply.message.find(item => item.text !== undefined).text;
            } else {
                return;
            }
        }
        // 如果没有百度那就Google
        const translateResult = await this.translateEngine.translate(place, language[1]);
        e.reply(translateResult.trim(), true);
        return true;
    }

    // 抖音解析
    async douyin(e) {
        const urlRex = /(http:|https:)\/\/v.douyin.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const douUrl = urlRex.exec(e.msg.trim())[0];

        const res = await this.douyinRequest(douUrl);
        // 当前版本需要填入cookie
        if (_.isEmpty(this.douyinCookie)) {
            e.reply(`检测到没有Cookie，无法解析抖音${ HELP_DOC }`);
            return;
        }
        const douId = /note\/(\d+)/g.exec(res)?.[1] || /video\/(\d+)/g.exec(res)?.[1];
        // 以下是更新了很多次的抖音API历史，且用且珍惜
        // const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${ douId }`;
        // const url = `https://www.iesdouyin.com/aweme/v1/web/aweme/detail/?aweme_id=${ douId }&aid=1128&version_name=23.5.0&device_platform=android&os_version=2333`;
        // 感谢 Evil0ctal（https://github.com/Evil0ctal）提供的header 和 B1gM8c（https://github.com/B1gM8c）的逆向算法X-Bogus
        const headers = {
            "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
            "User-Agent": COMMON_USER_AGENT,
            Referer: "https://www.douyin.com/",
            cookie: this.douyinCookie,
        };
        const dyApi = DY_INFO.replace("{}", douId);
        // a-bogus参数
        const abParam = aBogus.generate_a_bogus(
            new URLSearchParams(new URL(dyApi).search).toString(),
            headers["User-Agent"],
        );
        // const param = resp.data.result[0].paramsencode;
        const resDyApi = `${ dyApi }&a_bogus=${ abParam }`;
        headers['Referer'] = `https://www.douyin.com/video/${ douId }`
        // 定义一个dy请求
        const dyResponse = () => axios.get(resDyApi, {
            headers,
        });
        // 如果失败进行3次重试
        try {
            const data = await retryAxiosReq(dyResponse)
            // logger.info(data)
            const item = await data.aweme_detail;
            // await saveJsonToFile(item);
            // 如果为null则退出
            if (item == null) {
                e.reply("R插件无法识别到当前抖音内容，请换一个试试！");
                return;
            }
            const urlTypeCode = item.aweme_type;
            const urlType = douyinTypeMap[urlTypeCode];
            // 核心内容
            if (urlType === "video") {
                // logger.info(item.video);
                // 多位面选择：play_addr、play_addr_265、play_addr_h264
                const { play_addr: { uri: videoAddrURI }, duration, cover } = item.video;
                // 进行时间判断，如果超过时间阈值就不发送
                const dyDuration = Math.trunc(duration / 1000);
                const durationThreshold = this.biliDuration;
                // 一些共同发送内容
                let dySendContent = `${ this.identifyPrefix } 识别：抖音，${ item.author.nickname }\n📝 简介：${ item.desc }`;
                if (dyDuration >= durationThreshold) {
                    // 超过阈值，不发送的情况
                    // 封面
                    const dyCover = cover.url_list?.pop();
                    // logger.info(cover.url_list);
                    dySendContent += `\n
                    ${ DIVIDING_LINE.replace('{}', '限制说明') }\n当前视频时长约：${ Math.trunc(dyDuration / 60) }分钟，\n大于管理员设置的最大时长 ${ durationThreshold / 60 } 分钟！`;
                    e.reply([segment.image(dyCover), dySendContent]);
                    // 如果开启评论的就调用
                    await this.douyinComment(e, douId, headers);
                    return;
                }
                e.reply(`${ dySendContent }`);
                // 分辨率判断是否压缩
                const resolution = this.douyinCompression ? "720p" : "1080p";
                // 使用今日头条 CDN 进一步加快解析速度
                const resUrl = DY_TOUTIAO_INFO.replace("1080p", resolution).replace("{}", videoAddrURI);

                // ⚠️ 暂时废弃代码
                /*if (this.douyinCompression) {
                    // H.265压缩率更高、流量省一半. 相对于H.264
                    // 265 和 264 随机均衡负载
                    const videoAddrList = Math.random() > 0.5 ? play_addr_265.url_list : play_addr_h264.url_list;
                    resUrl = videoAddrList[videoAddrList.length - 1] || videoAddrList[0];
                } else {
                    // 原始格式，ps. videoAddrList这里[0]、[1]是 http，[最后一个]是 https
                    const videoAddrList = play_addr.url_list;
                    resUrl = videoAddrList[videoAddrList.length - 1] || videoAddrList[0];
                }*/

                // logger.info(resUrl);
                const path = `${ this.getCurDownloadPath(e) }/temp.mp4`;
                // 加入队列
                await this.downloadVideo(resUrl).then(() => {
                    this.sendVideoToUpload(e, path)
                });
            } else if (urlType === "image") {
                // 发送描述
                e.reply(`${ this.identifyPrefix } 识别：抖音, ${ item.desc }`);
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
                await e.reply(await Bot.makeForwardMsg(no_watermark_image_list));
            }
            // 如果开启评论的就调用
            await this.douyinComment(e, douId, headers);
        } catch (err) {
            logger.error(err);
            logger.mark(`Cookie 过期或者 Cookie 没有填写，请参考\n${ HELP_DOC }\n尝试无效后可以到官方QQ群[575663150]提出 bug 等待解决`)
        }
        return true;
    }

    /**
     * 获取 DY 评论
     * @param e
     * @param douId
     * @param headers
     */
    async douyinComment(e, douId, headers) {
        if (!this.douyinComments) {
            return;
        }
        const dyCommentUrl = DY_COMMENT.replace("{}", douId);
        const abParam = aBogus.generate_a_bogus(
            new URLSearchParams(new URL(dyCommentUrl).search).toString(),
            headers["User-Agent"],
        );
        const commentsResp = await axios.get(`${ dyCommentUrl }&a_bogus=${ abParam }`, {
            headers
        })
        // logger.info(headers)
        // saveJsonToFile(commentsResp.data, "data.json", _);
        const comments = commentsResp.data.comments;
        const replyComments = comments.map(item => {
            return {
                message: item.text,
                nickname: this.e.sender.card || this.e.user_id,
                user_id: this.e.user_id,
            }
        })
        e.reply(await Bot.makeForwardMsg(replyComments));
    }

    // tiktok解析
    async tiktok(e) {
        // 判断海外
        const isOversea = await this.isOverseasServer();
        // 如果不是海外用户且没有梯子直接返回
        if (!isOversea && !(await testProxy(this.proxyAddr, this.proxyPort))) {
            e.reply("检测到没有梯子，无法解析TikTok");
            return false;
        }
        // 处理链接
        let url = e.msg.trim();
        // 去除多余参数
        const parsedUrl = new URL(url);
        parsedUrl.search = '';
        const cleanedTiktokUrl = parsedUrl.toString();
        // 下载逻辑
        const path = this.getCurDownloadPath(e);
        await checkAndRemoveFile(path + "/temp.mp4");
        const title = ytDlpGetTilt(url, isOversea, this.myProxy);
        e.reply(`${ this.identifyPrefix } 识别：TikTok，视频下载中请耐心等待 \n${ title }`);
        await ytDlpHelper(path, cleanedTiktokUrl, isOversea, this.myProxy);
        await this.sendVideoToUpload(e, `${ path }/temp.mp4`);
        return true;
    }


    // 哔哩哔哩扫码登录
    async biliScan(e) {
        e.reply('R插件开源免责声明:\n您将通过扫码完成获取哔哩哔哩refresh_token以及ck。\n本Bot将不会保存您的登录状态。\n我方仅提供视频解析及相关B站内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码 ~', { recallMsg: 180 });
        // 图片发送钩子
        const imgSendHook = function (e, path) {
            e.reply([segment.image(path), segment.at(e.user_id), '请扫码以完成获取'], { recallMsg: 180 })
        };
        // 检查路径是否存在文件夹
        await mkdirIfNotExists(this.defaultPath);
        // 发送请求
        const saveCodePath = `${ this.defaultPath }qrcode.png`;

        const { SESSDATA, refresh_token } = await getScanCodeData(saveCodePath, 8, () => imgSendHook(e, saveCodePath))

        // 更新到配置文件
        config.updateField("tools", "biliSessData", SESSDATA);
        e.reply('登录成功！相关信息已保存至配置文件', true)
        return true;
    }

    // B 站解析
    async bili(e) {
        const urlRex = /(?:https?:\/\/)?www\.bilibili\.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const bShortRex = /(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim().replaceAll("\\", "");
        // 直接发送BV号的处理
        if (/^BV[1-9a-zA-Z]{10}$/.exec(url)?.[0]) {
            url = `https://www.bilibili.com/video/${ url }`;
            logger.info(url)
        }
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
        // 直播间分享
        // logger.info(url)
        if (url.includes("live")) {
            // 提取直播间id
            const idPattern = /\/(\d+)$/;
            const parsedUrl = new URL(url);
            const streamId = parsedUrl.pathname.match(idPattern)?.[1];
            // logger.info(streamId)
            // 提取相关信息
            const liveData = await this.getBiliStream(streamId);
            // logger.info(liveData);
            const { title, user_cover, keyframe, description, tags } = liveData.data.data;
            e.reply([
                segment.image(user_cover),
                segment.image(keyframe),
                `${ this.identifyPrefix } 识别：哔哩哔哩直播，${ title }${ description ? `\n\n简述：${ description }\n` : '' }${ tags ? `标签：${ tags }\n` : '' }`
            ]);
            return true;
        }
        // 处理专栏
        if (e.msg !== undefined && e.msg.includes("read\/cv")) {
            this.linkShareSummary(e);
            return true;
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
        // 创建文件，如果不存在，
        const path = `${ this.getCurDownloadPath(e) }/`;
        await mkdirIfNotExists(path);
        // 处理番剧
        if (url.includes("play\/ep") || url.includes("play\/ss")) {
            const ep = await this.biliEpInfo(url, e);
            // 如果使用了BBDown && 没有填写session 就放开下载
            if (this.biliUseBBDown) {
                // 下载文件
                await this.biliDownloadStrategy(e, `https://www.bilibili.com/bangumi/play/ep${ ep }`, path);
            }
            return true;
        }
        // 视频信息获取例子：http://api.bilibili.com/x/web-interface/view?bvid=BV1hY411m7cB
        // 请求视频信息
        const videoInfo = await getVideoInfo(url);
        const { duration, bvid, cid, owner, pages } = videoInfo;
        // 限制时长 & 考虑分页视频情况
        const query = querystring.parse(url);
        const curPage = query?.p || 0;
        const curDuration = pages?.[curPage]?.duration || duration;
        const isLimitDuration = curDuration > this.biliDuration
        // 动态构造哔哩哔哩信息
        let biliInfo = await this.constructBiliInfo(videoInfo);
        // 总结
        if (this.biliDisplaySummary) {
            const summary = await this.getBiliSummary(bvid, cid, owner.mid);
            // 封装总结
            summary && e.reply(await Bot.makeForwardMsg(textArrayToMakeForward(e, [`「R插件 x bilibili」联合为您总结内容：`, summary])));
        }
        // 限制视频解析
        if (isLimitDuration) {
            const durationInMinutes = (curDuration / 60).toFixed(0);
            biliInfo.push(`${ DIVIDING_LINE.replace('{}', '限制说明') }\n当前视频时长约：${ durationInMinutes }分钟，\n大于管理员设置的最大时长 ${ this.biliDuration / 60 } 分钟！`);
            e.reply(biliInfo);
            return true;
        } else {
            e.reply(biliInfo);
        }
        // 只提取音乐处理
        if (e.msg !== undefined && e.msg.startsWith("音乐")) {
            return await this.biliMusic(e, url);
        }
        // 下载文件
        await this.biliDownloadStrategy(e, url, path);
        return true;
    }

    /**
     * 构造哔哩哔哩信息
     * @param videoInfo
     * @returns {Promise<(string|string)[]>}
     */
    async constructBiliInfo(videoInfo) {
        const { title, desc, bvid, cid, pic } = videoInfo;
        // 视频信息
        const { view, danmaku, reply, favorite, coin, share, like } = videoInfo.stat;
        // 格式化数据
        let combineContent = "";
        // 是否显示信息
        if (this.biliDisplayInfo) {
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
            combineContent += `\n${ formatBiliInfo(dataProcessMap) }`;
        }
        // 是否显示简介
        if (this.biliDisplayIntro) {
            // 过滤简介中的一些链接
            const filteredDesc = await filterBiliDescLink(desc);
            combineContent += `\n📝 简介：${ truncateString(filteredDesc, this.toolsConfig.biliIntroLenLimit || BILI_DEFAULT_INTRO_LEN_LIMIT) }`;
        }
        // 是否显示在线人数
        if (this.biliDisplayOnline) {
            // 拼接在线人数
            const onlineTotal = await this.biliOnlineTotal(bvid, cid);
            combineContent += `\n🏄‍♂️️ 当前视频有 ${ onlineTotal.total } 人在观看，其中 ${ onlineTotal.count } 人在网页端观看`;
        }
        let biliInfo = [`${ this.identifyPrefix } 识别：哔哩哔哩：${ title }`, combineContent]
        // 是否显示封面
        if (this.biliDisplayCover) {
            // 加入图片
            biliInfo.unshift(segment.image(pic));
        }
        return biliInfo;
    }

    /**
     * 获取哔哩哔哩番剧信息
     * @param url
     * @param e
     * @returns {Promise<void>}
     */
    async biliEpInfo(url, e) {
        let ep;
        // 处理ssid
        if (url.includes("play\/ss")) {
            const ssid = url.match(/\/ss(\d+)/)?.[1];
            let resp = await (await fetch(BILI_SSID_INFO.replace("{}", ssid), {
                headers: BILI_HEADER
            })).json()
            ep = (resp.result.main_section.episodes[0].share_url).replace("https://www.bilibili.com/bangumi/play/ep", "")
        }
        // 处理普通情况，上述情况无法处理的
        if (_.isEmpty(ep)) {
            ep = url.match(/\/ep(\d+)/)?.[1];
        }
        const resp = await (await fetch(BILI_EP_INFO.replace("{}", ep), {
            headers: BILI_HEADER
        })).json();
        const result = resp.result;
        const { views, danmakus, likes, coins, favorites, favorite } = result.stat;
        // 封装成可以format的数据
        const dataProcessMap = {
            "播放": views,
            "弹幕": danmakus,
            "点赞": likes,
            "分享": coins,
            "追番": favorites,
            "收藏": favorite,
        };
        // 截断标题，查看Redis中是否存在，避免频繁走网络连接
        const title = result.title;
        e.reply([
            segment.image(resp.result.cover),
            `${ this.identifyPrefix }识别：哔哩哔哩番剧，${ title }\n🎯 评分: ${ result?.rating?.score ?? '-' } / ${ result?.rating?.count ?? '-' }\n📺 ${ result.new_ep.desc }, ${ result.seasons[0].new_ep.index_show }\n`,
            `${ formatBiliInfo(dataProcessMap) }`,
            `\n\n🪶 在线观看： ${ await urlTransformShortLink(ANIME_SERIES_SEARCH_LINK + title) }`,
            `\n🌸 在线观看： ${ await urlTransformShortLink(ANIME_SERIES_SEARCH_LINK2 + title) }`
        ], true);
        return ep;
    }

    /**
     * 哔哩哔哩下载策略
     * @param e     事件
     * @param url   链接
     * @param path  保存路径
     * @returns {Promise<void>}
     */
    async biliDownloadStrategy(e, url, path) {
        return this.queue.add(async () => {
            // =================以下是调用BBDown的逻辑=====================
            // 下载视频和音频
            const tempPath = `${ path }temp`;
            // 检测是否开启BBDown
            if (this.biliUseBBDown) {
                // 检测环境的 BBDown
                const isExistBBDown = await checkToolInCurEnv("BBDown");
                // 存在 BBDown
                if (isExistBBDown) {
                    // 删除之前的文件
                    await checkAndRemoveFile(`${ tempPath }.mp4`);
                    // 下载视频
                    await startBBDown(url, path, {
                        biliSessData: this.biliSessData,
                        biliUseAria2: this.biliDownloadMethod === 1,
                        biliCDN: BILI_CDN_SELECT_LIST.find(item => item.value === this.biliCDN)?.sign,
                        biliResolution: this.biliResolution,
                    });
                    // 发送视频
                    return this.sendVideoToUpload(e, `${ tempPath }.mp4`);
                }
                e.reply("🚧 R插件提醒你：开启但未检测到当前环境有【BBDown】，即将使用默认下载方式 ( ◡̀_◡́)ᕤ");
            }
            // =================默认下载方式=====================
            try {
                // 获取下载链接
                const data = await getDownloadUrl(url, this.biliSessData);

                await this.downBili(tempPath, data.videoUrl, data.audioUrl);

                // 上传视频
                return this.sendVideoToUpload(e, `${ tempPath }.mp4`);
            } catch (err) {
                // 错误处理
                logger.error('[R插件][哔哩哔哩视频发送]下载错误，具体原因为:', err);
                e.reply("解析失败，请重试一下");
            }
        })
    }

    /**
     * 获取在线人数
     * @param bvid
     * @param cid
     * @returns {Promise<{total: *, count: *}>}
     */
    async biliOnlineTotal(bvid, cid) {
        const onlineResp = await axios.get(BILI_ONLINE.replace("{0}", bvid).replace("{1}", cid));
        const online = onlineResp.data.data;
        return {
            total: online.total,
            count: online.count
        }
    }

    // 下载哔哩哔哩音乐
    async biliMusic(e, url) {
        const videoId = /video\/[^\?\/ ]+/.exec(url)[0].split("/")[1];
        this.queue.add(() => {
            getBiliAudio(videoId, "").then(async audioUrl => {
                const path = this.getCurDownloadPath(e);
                const biliMusicPath = await m4sToMp3(audioUrl, path)
                // 发送语音
                e.reply(segment.record(biliMusicPath));
                // 上传群文件
                await this.uploadGroupFile(e, biliMusicPath);
            })
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
                e.reply(`${ this.identifyPrefix } 识别：哔哩哔哩动态, ${ resp.dynamicDesc }`);
                let dynamicSrcMsg = [];
                resp.dynamicSrc.forEach(item => {
                    dynamicSrcMsg.push({
                        message: segment.image(item),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    });
                });
                await e.reply(await Bot.makeForwardMsg(dynamicSrcMsg));
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
     * @return {Promise<string>}
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

    /**
     * 获取直播间信息
     * @param liveId
     * @returns {Promise<*>}
     */
    async getBiliStream(liveId) {
        return axios.get(`${ BILI_STREAM_INFO }?room_id=${ liveId }`, {
            headers: {
                'User-Agent': COMMON_USER_AGENT,
            }
        });
    }

    /**
     * @deprecated Use newFunction instead.
     */
    async twitter(e) {
        console.warn('警告: 函数已弃用，将在未来版本中移除');
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
            agent: !isOversea ? '' : new HttpsProxyAgent(this.myProxy),
        }).then(async resp => {
            logger.info(resp)
            e.reply(`${ this.identifyPrefix } 识别：小蓝鸟学习版，${ resp.data.text }`);
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
        if (!(await this.isTrustUser(e.user_id))) {
            e.reply("你没有权限使用此命令");
            return;
        }
        // 配置参数及解析
        const reg = /https:\/\/x\.com\/[\w]+\/status\/\d+(\/photo\/\d+)?/;
        const twitterUrl = reg.exec(e.msg)[0];
        // 检测
        const isOversea = await this.isOverseasServer();
        if (!isOversea && !(await testProxy(this.proxyAddr, this.proxyPort))) {
            e.reply("检测到没有梯子，无法解析小蓝鸟");
            return false;
        }
        // 提取视频
        let videoUrl = GENERAL_REQ_LINK.link.replace("{}", twitterUrl);
        e.reply(`${ this.identifyPrefix } 识别：小蓝鸟学习版`);
        const config = {
            headers: {
                'Accept': 'ext/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Host': '47.99.158.118',
                'Proxy-Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': COMMON_USER_AGENT,
            },
            timeout: 10000 // 设置超时时间
        }

        let resp = await axios.get(videoUrl, config);
        if (resp.data.data == null) {
            videoUrl += '/photo/1';
            logger.info(videoUrl);
            resp = await axios.get(videoUrl, config);
        }
        const url = resp.data.data?.url;
        if (url && (url.endsWith(".jpg") || url.endsWith(".png"))) {
            if (isOversea) {
                // 海外直接下载
                e.reply(segment.image(url));
            } else {
                // 非海外使用🪜下载
                const localPath = this.getCurDownloadPath(e);
                const xImgPath = await downloadImg({
                    img: url,
                    dir: localPath,
                    isProxy: !isOversea,
                    proxyInfo: {
                        proxyAddr: this.proxyAddr,
                        proxyPort: this.proxyPort
                    },
                    downloadMethod: this.biliDownloadMethod,
                })
                e.reply(segment.image(xImgPath));
            }
        } else {
            this.downloadVideo(url, !isOversea).then(path => {
                e.reply(segment.video(path + "/temp.mp4"));
            });
        }
        return true;
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
            e.reply(`${ this.identifyPrefix } 识别：猴山，${ res.videoName }`);
            parseM3u8(res.urlM3u8s[res.urlM3u8s.length - 1]).then(res2 => {
                downloadM3u8Videos(res2.m3u8FullUrls, path).then(_ => {
                    mergeAcFileToMp4(res2.tsNames, path, `${ path }out.mp4`).then(_ => {
                        this.sendVideoToUpload(e, `${ path }out.mp4`)
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
            || /(http:|https:)\/\/www\.xiaohongshu\.com\/discovery\/item\/(\w+)/.exec(
                e.msg,
            )?.[0]
        // 注入ck
        XHS_NO_WATERMARK_HEADER.cookie = this.xiaohongshuCookie;
        // 解析短号
        let id;
        if (msgUrl.includes("xhslink")) {
            await fetch(msgUrl, {
                headers: XHS_NO_WATERMARK_HEADER,
                redirect: "follow",
            }).then(resp => {
                const uri = decodeURIComponent(resp.url);
                // 如果出现了网页验证uri:https://www.xiaohongshu.com/website-login/captcha?redirectPath=https://www.xiaohongshu.com/discovery/item/63c93ac3000000002203b28a?app_platform=android&app_version=8.23.1&author_share=1&ignoreEngage=true&share_from_user_hidden=true&type=normal&xhsshare=CopyLink&appuid=62c58b90000000000303dc54&apptime=1706149572&exSource=&verifyUuid=a5f32b62-453e-426b-98fe-2cfe0c16776d&verifyType=102&verifyBiz=461
                const verify = uri.match(/\/item\/([0-9a-fA-F]+)/);
                // 一般情况下不会出现问题就使用这个正则
                id = /noteId=(\w+)/.exec(uri)?.[1] ?? verify?.[1];
            });
        } else {
            id = /explore\/(\w+)/.exec(msgUrl)?.[1] || /discovery\/item\/(\w+)/.exec(msgUrl)?.[1];
        }
        const downloadPath = `${ this.getCurDownloadPath(e) }`;
        // 检测没有 cookie 则退出
        if (_.isEmpty(this.xiaohongshuCookie)) {
            e.reply(`2024-8-2后反馈必须使用ck，不然无法解析请填写相关ck\n${ HELP_DOC }`);
            return;
        }
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
            if (type === "video") {
                // 封面
                const cover = noteData.imageList?.[0].urlDefault;
                e.reply([segment.image(cover), `${ this.identifyPrefix } 识别：小红书, ${ title }\n${ desc }`]);
                // ⚠️ （暂时废弃）构造xhs视频链接（有水印）
                const xhsVideoUrl = noteData.video.media.stream.h264?.[0]?.masterUrl;

                // 构造无水印
                // const xhsVideoUrl = `http://sns-video-bd.xhscdn.com/${ noteData.video.consumer.originVideoKey }`
                // 下载视频
                this.downloadVideo(xhsVideoUrl).then(path => {
                    if (path === undefined) {
                        // 创建文件，如果不存在
                        path = `${ this.getCurDownloadPath(e) }/`;
                    }
                    this.sendVideoToUpload(e, `${ path }/temp.mp4`)
                });
                return true;
            } else if (type === "normal") {
                e.reply(`${ this.identifyPrefix } 识别：小红书, ${ title }\n${ desc }`);
                const imagePromises = [];
                // 使用 for..of 循环处理异步下载操作
                for (let [index, item] of noteData.imageList.entries()) {
                    imagePromises.push(downloadImg({
                        img: item.urlDefault,
                        dir: downloadPath,
                        fileName: `${ index }.png`,
                        downloadMethod: this.biliDownloadMethod,
                    }));
                }
                // 等待所有图片下载完成
                const paths = await Promise.all(imagePromises);

                // 直接构造 imagesData 数组
                const imagesData = await Promise.all(paths.map(async (item) => {
                    return {
                        message: segment.image(await fs.promises.readFile(item)),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    };
                }));

                // 回复带有转发消息的图片数据
                e.reply(await Bot.makeForwardMsg(imagesData));

                // 批量删除下载的文件
                await Promise.all(paths.map(item => fs.promises.rm(item, { force: true })));
            }
        });
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
            `${ this.identifyPrefix } 识别：波点音乐，${ name }-${ album }-${ artist }\n标签：${ categorys
                .map(item => item.name)
                .join(" | ") }`,
            segment.image(albumPic120),
        ]);
        if (e.msg.includes("musicId")) {
            const path = `${ this.getCurDownloadPath(e) }`;
            await getBodianAudio(id, path, `${ name }-${ artist }`).then(sendPath => {
                // 发送语音
                e.reply(segment.record(sendPath));
                // 上传群文件
                this.uploadGroupFile(e, sendPath);
                // 删除文件
                checkAndRemoveFile(sendPath);
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
        // 处理短号，此时会变成y.music.163.com
        if (message.includes("163cn.tv")) {
            message = /(http:|https:)\/\/163cn\.tv\/([a-zA-Z0-9]+)/.exec(message)?.[0]
            // logger.info(message)
            message = await axios.head(message).then((resp) => {
                return resp.request.res.responseUrl;
            });
        }
        // 处理网页链接
        const musicUrlReg = /(http:|https:)\/\/music.163.com\/song\/media\/outer\/url\?id=(\d+)/;
        const musicUrlReg2 = /(http:|https:)\/\/y.music.163.com\/m\/song\?(.*)&id=(\d+)/;
        const id =
            musicUrlReg2.exec(message)?.[3] ||
            musicUrlReg.exec(message)?.[2] ||
            /id=(\d+)/.exec(message)[1];
        // 如果没有下载地址跳出if
        if (_.isEmpty(id)) {
            e.reply(`识别：网易云音乐，解析失败！`);
            logger.error("[R插件][网易云解析] 没有找到id，无法进行下一步！")
            return
        }
        // 判断海外
        const isOversea = await this.isOverseasServer();
        // 自动选择 API
        const autoSelectNeteaseApi = isOversea ? NETEASE_SONG_DOWNLOAD : NETEASE_API_CN;
        // mv截断
        if (message.includes("mv")) {
            const AUTO_NETEASE_MV_DETAIL = autoSelectNeteaseApi + "/mv/detail?mvid={}";
            const AUTO_NETEASE_MV_URL = autoSelectNeteaseApi + "/mv/url?id={}";
            // logger.info(AUTO_NETEASE_MV_DETAIL.replace("{}", id));
            // logger.info(AUTO_NETEASE_MV_URL.replace("{}", id));
            const [mvDetailData, mvUrlData] = await Promise.all([
                axios.get(AUTO_NETEASE_MV_DETAIL.replace("{}", id), {
                    headers: {
                        "User-Agent": COMMON_USER_AGENT,
                    }
                }),
                axios.get(AUTO_NETEASE_MV_URL.replace("{}", id), {
                    headers: {
                        "User-Agent": COMMON_USER_AGENT,
                    }
                })
            ]);
            const { name: mvName, artistName: mvArtist, cover: mvCover } = mvDetailData.data?.data;
            e.reply([segment.image(mvCover), `${ this.identifyPrefix } 识别：网易云MV，${ mvName } - ${ mvArtist }`]);
            // logger.info(mvUrlData.data)
            const { url: mvUrl } = mvUrlData.data?.data;
            this.downloadVideo(mvUrl).then(path => {
                this.sendVideoToUpload(e, `${ path }/temp.mp4`)
            });
            return;
        }
        // 国内解决方案，替换为国内API (其中，NETEASE_API_CN是国内基址)
        const AUTO_NETEASE_SONG_DOWNLOAD = autoSelectNeteaseApi + "/song/url?id={}";
        const AUTO_NETEASE_SONG_DETAIL = autoSelectNeteaseApi + "/song/detail?ids={}";
        // logger.info(AUTO_NETEASE_SONG_DOWNLOAD.replace("{}", id));
        // 请求netease数据
        axios.get(AUTO_NETEASE_SONG_DOWNLOAD.replace("{}", id), {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
            },
        }).then(async resp => {
            // 国内解决方案，替换API后这里也需要修改
            let url = await resp.data.data?.[0]?.url || null;
            // 获取歌曲信息
            let title = await axios.get(AUTO_NETEASE_SONG_DETAIL.replace("{}", id)).then(res => {
                const song = res.data.songs[0];
                return cleanFilename(`${ song?.name }-${ song?.ar?.[0].name }`);
            });
            // 一般这个情况是VIP歌曲 (如果没有url或者是国内, 国内全走临时接口，后续如果不要删除逻辑'!isOversea ||')
            if (!isOversea || url == null) {
                url = await this.musicTempApi(e, title, "网易云音乐");
            } else {
                // 不是VIP歌曲，直接识别完就下一步
                e.reply(`${ this.identifyPrefix } 识别：网易云音乐，${ title }`);
            }
            // 动态判断后缀名
            const extensionPattern = /\.([a-zA-Z0-9]+)$/;
            const musicExt = url.match(extensionPattern)?.[0].replace("\.", "");
            // 下载音乐
            downloadAudio(url, this.getCurDownloadPath(e), title, 'follow', musicExt).then(async path => {
                // 发送语音
                await e.reply(segment.record(path));
                // 上传群文件
                await this.uploadGroupFile(e, path);
                // 删除文件
                await checkAndRemoveFile(path);
            }).catch(err => {
                logger.error(`下载音乐失败，错误信息为: ${ err.message }`);
            });
        });
        return true;
    }

    // 临时接口
    async musicTempApi(e, title, musicType) {
        let musicReqApi = NETEASE_TEMP_API;
        if (musicType === "QQ音乐") {
            musicReqApi = QQ_MUSIC_TEMP_API;
        } else if (musicType === "汽水音乐") {
            musicReqApi = QISHUI_MUSIC_TEMP_API;
        }
        // 临时接口，title经过变换后搜索到的音乐质量提升
        const vipMusicData = await axios.get(musicReqApi.replace("{}", title.replace("-", " ")), {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
            },
        });
        const messageTitle = title + "\nR插件检测到当前为VIP音乐，正在转换...";
        // ??后的内容是适配`QQ_MUSIC_TEMP_API`、最后是汽水
        const url = vipMusicData.data?.music_url ?? vipMusicData.data?.data?.music_url ?? vipMusicData.data?.music;
        const cover = vipMusicData.data?.cover ?? vipMusicData.data?.data?.cover ?? vipMusicData.data?.cover;
        await e.reply([segment.image(cover), `${ this.identifyPrefix } 识别：${ musicType }，${ messageTitle }`]);
        return url;
    }

    // 微博解析
    async weibo(e) {
        let weiboId;
        const weiboUrl = e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim().replaceAll("\\", "");
        // 对已知情况进行判断
        if (weiboUrl.includes("m.weibo.cn")) {
            // https://m.weibo.cn/detail/4976424138313924
            weiboId = /(?<=detail\/)[A-Za-z\d]+/.exec(weiboUrl)?.[0] || /(?<=m.weibo.cn\/)[A-Za-z\d]+\/[A-Za-z\d]+/.exec(weiboUrl)?.[0];
        } else if (weiboUrl.includes("weibo.com\/tv\/show") && weiboUrl.includes("mid=")) {
            // https://weibo.com/tv/show/1034:5007449447661594?mid=5007452630158934
            weiboId = /(?<=mid=)[A-Za-z\d]+/.exec(weiboUrl)?.[0];
            weiboId = mid2id(weiboId);
        } else if (weiboUrl.includes("weibo.com")) {
            // https://weibo.com/1707895270/5006106478773472
            weiboId = /(?<=weibo.com\/)[A-Za-z\d]+\/[A-Za-z\d]+/.exec(weiboUrl)?.[0];
        }
        // 无法获取id就结束
        if (!weiboId) {
            e.reply("解析失败：无法获取到wb的id");
            return;
        }
        const id = weiboId.split("/")[1] || weiboId;

        axios.get(WEIBO_SINGLE_INFO.replace("{}", id), {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "cookie": "_T_WM=40835919903; WEIBOCN_FROM=1110006030; MLOGIN=0; XSRF-TOKEN=4399c8",
                "Referer": `https://m.weibo.cn/detail/${ id }`,
            }
        })
            .then(async resp => {
                const wbData = resp.data.data;
                const { text, status_title, source, region_name, pics, page_info } = wbData;
                e.reply(`${ this.identifyPrefix } 识别：微博，${ text.replace(/<[^>]+>/g, '') }\n${ status_title }\n${ source }\t${ region_name ?? '' }`);
                if (pics) {
                    // 下载图片并格式化消息
                    const imagesPromise = pics.map(item => {
                        return downloadImg({
                            img: item?.large.url || item.url,
                            dir: this.getCurDownloadPath(e),
                            headersExt: {
                                "Referer": "http://blog.sina.com.cn/",
                            },
                            downloadMethod: this.biliDownloadMethod,
                        }).then(async (filePath) => {
                            // 格式化为消息对象
                            return {
                                message: segment.image(await fs.promises.readFile(filePath)),
                                nickname: e.sender.card || e.user_id,
                                user_id: e.user_id,
                                // 返回路径以便后续删除
                                filePath
                            };
                        });
                    });

                    // 等待所有图片处理完
                    const images = await Promise.all(imagesPromise);

                    // 回复合并的消息
                    await e.reply(await Bot.makeForwardMsg(images));

                    // 并行删除文件
                    await Promise.all(images.map(({ filePath }) => checkAndRemoveFile(filePath)));
                }
                if (page_info) {
                    // 视频
                    const videoUrl = page_info.urls?.mp4_720p_mp4 || page_info.urls?.mp4_hd_mp4;
                    // 文章
                    if (!videoUrl) return true
                    try {
                        // wb 视频只能强制使用 1，由群友@非酋提出
                        this.downloadVideo(videoUrl, false, {
                            "User-Agent": COMMON_USER_AGENT,
                            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                            "referer": "https://weibo.com/",
                        }, 1).then(path => {
                            this.sendVideoToUpload(e, `${ path }/temp.mp4`)
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
            e.reply(`${ this.identifyPrefix } 识别：${ adapter.name }${ adapter.desc ? `, ${ adapter.desc }` : '' }`);
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
                    logger.info(path);
                    this.sendVideoToUpload(e, `${ path }/temp.mp4`)
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

    // 油管解析
    async sy2b(e) {
        const isOversea = await this.isOverseasServer();
        if (!isOversea && !(await testProxy(this.proxyAddr, this.proxyPort))) {
            e.reply("检测到没有梯子，无法解析油管");
            return false;
        }
        try {
            const urlRex = /(?:https?:\/\/)?(www\.|music\.)?youtube\.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
            const url2Rex = /(?:https?:\/\/)?youtu\.be\/[A-Za-z\d._?%&+\-=\/#]*/g;
             // 检测操作系统平台
            const isWindows = process.platform === 'win32';

            // 匹配并转义 URL 中的 & 符号（仅对 Windows 进行转义）
            let url = urlRex.exec(e.msg)?.[0]?.replace(/&/g, isWindows ? '^&' : '&') ||
                url2Rex.exec(e.msg)?.[0]?.replace(/&/g, isWindows ? '^&' : '&');
            // 适配 YouTube Music
            if (url.includes("music")) {
                // https://music.youtube.com/watch?v=F4sRtMoIgUs&si=7ZYrHjlI3fHAha0F
                url = url.replace("music", "www");
            }
            const path = this.getCurDownloadPath(e);
            await checkAndRemoveFile(path + "/temp.mp4")
            const title = await ytDlpGetTilt(url, isOversea, this.myProxy);
            e.reply(`${ this.identifyPrefix } 识别：油管，视频下载中请耐心等待 \n${ title }`);
            await ytDlpHelper(path, url, isOversea, this.myProxy, true);
            this.sendVideoToUpload(e, `${ path }/temp.mp4`);
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
            const normalMsg = `${ this.identifyPrefix } 识别：米游社，${ subject }\n${ realContent?.describe || "" }`;
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
                            this.sendVideoToUpload(e, `${ path }/temp.mp4`)
                        });
                        break;
                    }
                }
            }
        })
    }

    // 微视
    async weishi(e) {
        let url = e.msg;
        const urlRegex = /https?:\/\/video\.weishi\.qq\.com\/\S+/g;
        // 执行匹配
        url = url.match(urlRegex)[0];
        // 消除短链接
        await fetch(url, {
            method: "HEAD"
        }).then(resp => {
            url = resp.url;
        });

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
                    "User-Agent": COMMON_USER_AGENT,
                }
            });

            const weishiResponse = response.data;
            const firstFeed = weishiResponse.data.feeds[0];
            // 标题、封面、视频链接
            const title = firstFeed.feed_desc;
            const cover = firstFeed.images[0].url;
            const noWatermarkDownloadUrl = firstFeed.video_url;

            e.reply([segment.image(cover), `${ this.identifyPrefix } 识别：微视，${ title }`]);

            this.downloadVideo(noWatermarkDownloadUrl).then(path => {
                this.sendVideoToUpload(e, `${ path }/temp.mp4`)
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
                    "User-Agent": COMMON_USER_AGENT,
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

            const images = imgSrcs.filter(item => item.includes("\/img\/view\/id"))

            // Construct the response object
            const shortVideoInfo = {
                authorName: videoAuthorMatch ? videoAuthorMatch[1] : '',
                title: videoTitleMatch ? videoTitleMatch[1] : '',
                cover: videoCoverMatch ? videoCoverMatch[1] : '' || images[0],
                noWatermarkDownloadUrl: videoUrlMatch ? videoUrlMatch[1] : '',
                images,
            };

            e.reply(`${ this.identifyPrefix } 识别：最右，${ shortVideoInfo.authorName }\n${ shortVideoInfo.title }`)

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
                    this.sendVideoToUpload(e, `${ path }/temp.mp4`)
                });
            }
        } catch (error) {
            console.error(error);
            throw error; // Rethrow the error so it can be handled by the caller
        }
    }

    async freyr(e) {
        // https://music.apple.com/cn/album/hectopascal-from-yagate-kimi-ni-naru-piano-arrangement/1468323115?i=1468323724
        // 过滤参数
        const message = e.msg.replace("&ls", "");
        // 匹配名字
        const freyrName = message.includes("spotify") ? "Spotify" : "Apple Music";
        // 找到R插件保存目录
        const currentWorkingDirectory = path.resolve(this.getCurDownloadPath(e));
        // 如果没有文件夹就创建一个
        await mkdirIfNotExists(currentWorkingDirectory + "/am")
        // 检测是否存在框架
        const isExistFreyr = await checkToolInCurEnv("freyr");
        if (!isExistFreyr) {
            e.reply(`检测到没有${ freyrName }需要的环境，无法解析！${ HELP_DOC }`);
            return;
        }
        // 执行命令
        const result = await execSync(`freyr -d ${ currentWorkingDirectory + "/am/" } get ${ message }`);
        logger.info(result.toString());
        // 获取信息
        let { title, album, artist } = await this.parseFreyrLog(result.toString());
        // 兜底策略
        if (freyrName === "Apple Music" && (title === "N/A" || album === "N/A" || artist === "N/A")) {
            const data = await axios.get(`https://api.fabdl.com/apple-music/get?url=${ message }`, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT,
                    "Referer": "https://apple-music-downloader.com/",
                    "Origin": "https://apple-music-downloader.com",
                    "Accept": "application/json, text/plain, */*",
                },
            })
            const { name, artists } = data.data.result;
            title = name;
            artist = artists;
        }
        // 判断是否是海外服务器
        const isOversea = await this.isOverseasServer();
        // 国内服务器解决方案
        if (!isOversea) {
            // 临时接口
            const url = await this.musicTempApi(e, `${ title } ${ artist }`, freyrName);
            // 下载音乐
            downloadAudio(url, this.getCurDownloadPath(e), title, 'follow').then(async path => {
                // 发送语音
                await e.reply(segment.record(path));
                // 判断是不是icqq
                await this.uploadGroupFile(e, path);
                await checkAndRemoveFile(path);
            }).catch(err => {
                logger.error(`下载音乐失败，错误信息为: ${ err.message }`);
            });
        } else {
            // freyr 逻辑
            e.reply(`${ this.identifyPrefix } 识别：${ freyrName }，${ title }--${ artist }`);
            // 检查目录是否存在
            const musicPath = currentWorkingDirectory + "/am/" + artist + "/" + album;
            // 找到音频文件
            const mediaFiles = await getMediaFilesAndOthers(musicPath);
            for (let other of mediaFiles.others) {
                await this.uploadGroupFile(e, `${ musicPath }/${ other }`);
            }
        }
        // 计数
        tools.#amCount += 1;
        logger.info(`当前${ freyrName }已经下载了：${ tools.#amCount }次`);
        // 定时清理
        if (tools.#amCount >= 5) {
            await deleteFolderRecursive(currentWorkingDirectory + "/am");
            // 重置
            tools.#amCount = 0;
        }
        return true;
    }

    /**
     * 用于Apple Music抓取部分信息的函数
     * @link {applemusic}
     * @param log
     * @returns {Promise<{artist: (*|string), album: (*|string), title: (*|string)}>}
     */
    async parseFreyrLog(log) {
        const titleMatch = log.match(/Title: (.*)/);
        const albumMatch = log.match(/Album: (.*)/);
        const artistMatch = log.match(/Artist: (.*)/);

        const title = titleMatch ? titleMatch[1] : 'N/A';
        const album = albumMatch ? albumMatch[1] : 'N/A';
        const artist = artistMatch ? artistMatch[1] : 'N/A';

        return { title, album, artist };
    }

    // 链接总结
    async linkShareSummary(e) {
        let name, summaryLink;

        if (e.msg.startsWith("#总结一下")) {
            name = "网页总结";
            summaryLink = e.msg.replace("#总结一下", ""); // 如果需要进一步处理 summaryLink，可以在这里添加相关逻辑
        } else {
            ({ name: name, summaryLink: summaryLink } = contentEstimator(e.msg));
        }

        // 判断是否有总结的条件
        if (_.isEmpty(this.aiApiKey) || _.isEmpty(this.aiApiKey)) {
            // e.reply(`没有配置 Kimi，无法为您总结！${ HELP_DOC }`)
            await this.tempSummary(name, summaryLink, e);
            return true;
        }
        const builder = await new OpenaiBuilder()
            .setBaseURL(this.aiBaseURL)
            .setApiKey(this.aiApiKey)
            .setModel(this.aiModel)
            .setPrompt(SUMMARY_PROMPT)
            .build();
        e.reply(`${ this.identifyPrefix } 识别：${ name }，正在为您总结，请稍等...`, true, { recallMsg: MESSAGE_RECALL_TIME });
        const { ans: kimiAns, model } = await builder.kimi(summaryLink);
        // 计算阅读时间
        const stats = estimateReadingTime(kimiAns);
        const titleMatch = kimiAns.match(/(Title|标题)([:：])\s*(.*?)\n/)?.[3];
        e.reply(`《${ titleMatch }》 预计阅读时间: ${ stats.minutes } 分钟，总字数: ${ stats.words }`)
        const Msg = await Bot.makeForwardMsg(textArrayToMakeForward(e, [`「R插件 x ${ model }」联合为您总结内容：`, kimiAns]));
        await e.reply(Msg);
        return true;
    }

    /**
     * 临时AI接口
     * @param name
     * @param summaryLink
     * @param e
     * @returns {Promise<void>}
     */
    async tempSummary(name, summaryLink, e) {
        const content = await llmRead(summaryLink);
        const titleMatch = content.match(/Title:\s*(.*?)\n/)?.[1];
        e.reply(`${ this.identifyPrefix } 识别：${ name } - ${ titleMatch }，正在为您总结，请稍等...`, true);
        const summary = await deepSeekChat(content, SUMMARY_PROMPT);
        const Msg = await Bot.makeForwardMsg(textArrayToMakeForward(e, [`「R插件 x DeepSeek」联合为您总结内容：`, summary]));
        await e.reply(Msg);
    }

    // q q m u s i c 解析
    async qqMusic(e) {
        // case1:　Taylor Swift/Bleachers《Anti-Hero (Feat. Bleachers) (Explicit)》 https://c6.y.qq.com/base/fcgi-bin/u?__=lg19lFgQerbo @QQ音乐
        /** case 2:
         * {"app":"com.tencent.structmsg","config":{"ctime":1722497864,"forward":1,"token":"987908ab4a1c566d3645ef0ca52a162a","type":"normal"},"extra":{"app_type":1,"appid":100497308,"uin":542716863},"meta":{"news":{"action":"","android_pkg_name":"","app_type":1,"appid":100497308,"ctime":1722497864,"desc":"Taylor Swift/Bleachers","jumpUrl":"https://i.y.qq.com/v8/playsong.html?hosteuin=7KvA7i6sNeCi&sharefrom=gedan&from_id=1674373010&from_idtype=10014&from_name=(7rpl)&songid=382775503&songmid=&type=0&platform=1&appsongtype=1&_wv=1&source=qq&appshare=iphone&media_mid=000dKYJS3KCzpu&ADTAG=qfshare","preview":"https://pic.ugcimg.cn/1070bf5a6962b75263eee1404953c9b2/jpg1","source_icon":"https://p.qpic.cn/qqconnect/0/app_100497308_1626060999/100?max-age=2592000&t=0","source_url":"","tag":"QQ音乐","title":"Anti-Hero (Feat. Bleachers) (E…","uin":542716863}},"prompt":"[分享]Anti-Hero (Feat. Bleachers) (E…","ver":"0.0.0.1","view":"news"}
         */
        let musicInfo;
        // applet判定
        if (e.msg.includes(`"app":"com.tencent.structmsg"`)) {
            logger.info("[R插件][qqMusic] 识别为小程序分享");
            const musicInfoJson = JSON.parse(e.msg);
            // 歌手和歌名
            const prompt = musicInfoJson.meta?.news?.title ?? musicInfoJson.meta?.music?.title;
            const desc = musicInfoJson.meta?.news?.desc ?? musicInfoJson.meta?.music?.desc;
            // 必要性拼接
            musicInfo = prompt + "-" + desc;
            // 空判定
            if (musicInfo.trim() === "-" || prompt === undefined || desc === undefined) {
                logger.info(`没有识别到QQ音乐小程序，帮助文档如下：${ HELP_DOC }`)
                return true;
            }
        } else {
            // 连接判定
            const normalRegex = /^(.*?)\s*https?:\/\//;
            musicInfo = normalRegex.exec(e.msg)?.[1].trim();
        }
        // 删除特殊字符
        musicInfo = cleanFilename(musicInfo);
        logger.info(`[R插件][qqMusic] 识别音乐为：${ musicInfo }`);
        // 使用临时接口下载
        const url = await this.musicTempApi(e, musicInfo, "QQ音乐");
        // 下载音乐
        await downloadAudio(url, this.getCurDownloadPath(e), musicInfo, 'follow').then(async path => {
            // 发送语音
            await e.reply(segment.record(path));
            // 判断是不是icqq
            await this.uploadGroupFile(e, path);
            await checkAndRemoveFile(path);
        }).catch(err => {
            logger.error(`下载音乐失败，错误信息为: ${ err.message }`);
        });
        return true;
    }

    // 汽水音乐
    async qishuiMusic(e) {
        const normalRegex = /^(.*?)\s*https?:\/\//;
        const musicInfo = normalRegex.exec(e.msg)?.[1].trim().replace("@汽水音乐", "");
        logger.info(`[R插件][qishuiMusic] 识别音乐为：${ musicInfo }`);
        // 使用临时接口下载
        const url = await this.musicTempApi(e, musicInfo, "汽水音乐");
        // 下载音乐
        await downloadAudio(url, this.getCurDownloadPath(e), musicInfo, 'follow').then(async path => {
            // 发送语音
            await e.reply(segment.record(path));
            // 判断是不是icqq
            await this.uploadGroupFile(e, path);
            await checkAndRemoveFile(path);
        }).catch(err => {
            logger.error(`下载音乐失败，错误信息为: ${ err.message }`);
        });
        return true;
    }

    // 小飞机下载
    async aircraft(e) {
        if (!(await this.isTrustUser(e.user_id))) {
            e.reply("你没有权限使用此命令");
            return;
        }
        const isOversea = await this.isOverseasServer();
        if (!isOversea && !(await testProxy(this.proxyAddr, this.proxyPort))) {
            e.reply("检测到没有梯子，无法解析小飞机");
            return false;
        }
        const urlRex = /(?:https?:\/\/)?t\.me\/[A-Za-z\d._?%&+\-=\/#]*/g;
        // 检查当前环境
        const isExistTdl = await checkToolInCurEnv("tdl");
        if (!isExistTdl) {
            e.reply(`未检测到必要的环境，无法解析小飞机${ HELP_DOC }`);
            return;
        }
        const url = urlRex.exec(e.msg)[0];
        if (e.msg.startsWith("保存")) {
            // 发送文件到 SaveMessages
            await saveTDL(url, isOversea, this.myProxy);
            e.reply("文件已保存到 Save Messages！");
            return true;
        }
        e.reply(`${ this.identifyPrefix } 识别：小飞机（学习版）`);
        const tgSavePath = `${ this.getCurDownloadPath(e) }/tg`;
        // 如果没有文件夹则创建
        await mkdirIfNotExists(tgSavePath);
        // 删除之前的文件
        await deleteFolderRecursive(tgSavePath);
        await startTDL(url, tgSavePath, isOversea, this.myProxy, this.videoDownloadConcurrency);
        // 过滤当前文件
        const mediaFiles = await getMediaFilesAndOthers(tgSavePath);
        if (mediaFiles.images.length > 0) {
            const imagesData = mediaFiles.images.map(item => {
                const fileContent = fs.readFileSync(`${ tgSavePath }/${ item }`);
                return {
                    message: segment.image(fileContent),
                    nickname: e.sender.card || e.user_id,
                    user_id: e.user_id,
                };
            })
            e.reply(await Bot.makeForwardMsg(imagesData), true, { recallMsg: MESSAGE_RECALL_TIME });
        } else if (mediaFiles.videos.length > 0) {
            for (const item of mediaFiles.videos) {
                await this.sendVideoToUpload(e, `${ tgSavePath }/${ item }`);
            }
        } else {
            for (let other of mediaFiles.others) {
                await this.uploadGroupFile(e, `${ tgSavePath }/${ other }`);
            }
        }
        return true;
    }

    // 贴吧
    async tieba(e) {
        // 提取链接和ID
        const msg = /https:\/\/tieba\.baidu\.com\/p\/[A-Za-z0-9]+/.exec(e.msg)?.[0];
        const id = /\/p\/([A-Za-z0-9]+)/.exec(msg)?.[1];
        // 获取帖子详情
        const hibi = HIBI_API_SERVICE + `/tieba/post_detail?tid=${ id }`;
        const hibiResp = await fetch(hibi, {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
            }
        });
        const postList = (await hibiResp.json()).post_list;
        // 获取楼主的消息
        const top = postList[0];
        // 提取标题和内容
        const { title, content } = top;
        let sendContent = `${ this.identifyPrefix }识别：贴吧，${ title }`
        let extractImages = [];
        // 如果内容中有图片、文本或视频，它会将它们添加到 sendContent 消息中
        if (content && content.length > 0) {
            sendContent = [sendContent]
            for (const { cdn_src, text, link } of content) {
                logger.info({ cdn_src, text, link }); // 可以一次性输出多个属性

                // 处理图片
                if (cdn_src) extractImages.push(segment.image(cdn_src));

                // 处理文本
                if (text) sendContent.push(`\n\n📝 简介：${ text }`);

                // 处理视频
                if (link) {
                    const filePath = await this.downloadVideo(link);
                    this.sendVideoToUpload(e, `${ filePath }/temp.mp4`);
                }
            }
        }
        e.reply(sendContent, true);
        extractImages && e.reply(Bot.makeForwardMsg(extractImages.map(item => ({
            message: item,
            nickname: e.sender.card || e.user_id,
            user_id: e.user_id,
        }))));
        // 切除楼主的消息
        const others = postList.slice(1);
        // 贴吧楼层的消息处理：如果响应中有其他帖子，代码创建一条转发消息，包含其他帖子的内容，并回复原始消息
        const reply = others.flatMap(item => {
            if (!item.content || item.content.length === 0) return [];

            return item.content.map(floor => {
                const commonData = {
                    nickname: e.sender.card || e.user_id,
                    user_id: e.user_id,
                };

                if (floor?.cdn_src) {
                    return {
                        ...commonData,
                        message: segment.image(floor.cdn_src)
                    };
                } else if (floor?.text) {
                    return {
                        ...commonData,
                        message: { type: 'text', text: floor.text || '-' }
                    };
                }

                return null;
            }).filter(Boolean); // 过滤掉 null 的值
        });

        e.reply(await Bot.makeForwardMsg(reply));
        return true;
    }

    async yc(e) {
        if (!(await this.isTrustUser(e.user_id))) {
            e.reply("你没有权限使用此命令");
            return;
        }

        const tag = e.msg.replace(/#验车/g, "");

        const reqUrl = `https://whatslink.info/api/v1/link?url=${ tag }`;
        const resp = await axios.get(reqUrl, {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
            }
        });
        if (!resp.data) {
            e.reply("没有找到相关磁力");
            return;
        }
        await e.reply(`🧲 [R插件 x Mix] 联合为您验车：\n${ resp.data.name }`, false, { recallMsg: MESSAGE_RECALL_TIME });
        if (resp.data?.screenshots === null) {
            e.reply("没有找到相关媒体");
            return;
        }
        const screenshots = resp.data.screenshots.map(item => {
            const screenshot = item.screenshot;
            return {
                message: segment.image(screenshot),
                nickname: this.e.sender.card || this.e.user_id,
                user_id: this.e.user_id,
            }
        });
        e.reply(Bot.makeForwardMsg(screenshots), false, { recallMsg: MESSAGE_RECALL_TIME });
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
                this.biliDownloadMethod,
                this.videoDownloadConcurrency
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
                this.biliDownloadMethod,
                this.videoDownloadConcurrency
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
                "User-Agent": COMMON_USER_AGENT,
            },
            timeout: 10000,
        };
        try {
            const resp = await axios.head(url, params);
            const location = resp.request.res.responseUrl;
            return new Promise((resolve, reject) => {
                if (location != null) {
                    return resolve(location);
                } else {
                    return reject("获取失败");
                }
            });
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
     * 工具：根据URL多线程下载视频 / 音频
     * @param url
     * @param isProxy
     * @param headers
     * @param numThreads
     * @returns {Promise<string>}
     */
    async downloadVideo(url, isProxy = false, headers = null, numThreads = this.videoDownloadConcurrency) {
        // 构造群信息参数
        const { groupPath, target } = this.getGroupPathAndTarget.call(this);
        await mkdirIfNotExists(groupPath);
        // 构造header部分内容
        const userAgent = "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36";

        // 构造代理参数
        const proxyOption = {
            ...(isProxy && {
                httpAgent: new HttpsProxyAgent(`http://${ this.proxyAddr }:${ this.proxyPort }`),
            }),
        }

        /**
         * 构造下载视频参数
         * 构造信息：链接、头信息、userAgent、代理信息、下载位置、返回的路径
         * @type {{headers: null, userAgent: string, groupPath: string, url, proxyOption: {}, target: string}}
         */
        const downloadVideoParams = {
            url,
            headers,
            userAgent,
            proxyOption,
            target,
            groupPath,
        }
        logger.info(`[R插件][视频下载]：当前队列长度为 ${ this.queue.size + 1 }`);
        return await this.queue.add(async () => {
            // 如果是用户设置了单线程，则不分片下载
            if (numThreads === 1) {
                return this.downloadVideoWithSingleThread(downloadVideoParams);
            } else if (numThreads !== 1 && this.biliDownloadMethod === 1) {
                return this.downloadVideoWithAria2(downloadVideoParams, numThreads);
            } else if (numThreads !== 1 && this.biliDownloadMethod === 2) {
                return this.downloadVideoUseAxel(downloadVideoParams, numThreads);
            } else {
                return this.downloadVideoWithMultiThread(downloadVideoParams, numThreads);
            }
        });
    }

    /**
     * 多线程下载视频
     * @link {downloadVideo}
     * @param downloadVideoParams
     * @param numThreads
     * @returns {Promise<*>}
     */
    async downloadVideoWithMultiThread(downloadVideoParams, numThreads) {
        const { url, headers, userAgent, proxyOption, target, groupPath } = downloadVideoParams;
        try {
            // Step 1: 请求视频资源获取 Content-Length
            const headRes = await axios.head(url, {
                headers: headers || { "User-Agent": userAgent },
                ...proxyOption
            });
            const contentLength = headRes.headers['content-length'];
            if (!contentLength) {
                throw new Error("无法获取视频大小");
            }

            // Step 2: 计算每个线程应该下载的文件部分
            const partSize = Math.ceil(contentLength / numThreads);
            let promises = [];

            for (let i = 0; i < numThreads; i++) {
                const start = i * partSize;
                let end = start + partSize - 1;
                if (i === numThreads - 1) {
                    end = contentLength - 1; // 确保最后一部分可以下载完整
                }

                // Step 3: 并发下载文件的不同部分
                const partAxiosConfig = {
                    headers: {
                        "User-Agent": userAgent,
                        "Range": `bytes=${ start }-${ end }`
                    },
                    responseType: "stream",
                    ...proxyOption
                };

                promises.push(axios.get(url, partAxiosConfig).then(res => {
                    return new Promise((resolve, reject) => {
                        const partPath = `${ target }.part${ i }`;
                        logger.mark(`[R插件][视频下载引擎] 正在下载 part${ i }`)
                        const writer = fs.createWriteStream(partPath);
                        res.data.pipe(writer);
                        writer.on("finish", () => {
                            logger.mark(`[R插件][视频下载引擎] part${ i + 1 } 下载完成`); // 记录线程下载完成
                            resolve(partPath);
                        });
                        writer.on("error", reject);
                    });
                }));
            }

            // 等待所有部分都下载完毕
            const parts = await Promise.all(promises);

            // Step 4: 合并下载的文件部分
            await checkAndRemoveFile(target); // 确保目标文件不存在
            const writer = fs.createWriteStream(target, { flags: 'a' });
            for (const partPath of parts) {
                await new Promise((resolve, reject) => {
                    const reader = fs.createReadStream(partPath);
                    reader.pipe(writer, { end: false });
                    reader.on('end', () => {
                        fs.unlinkSync(partPath); // 删除部分文件
                        resolve();
                    });
                    reader.on('error', reject);
                });
            }

            writer.close();

            return groupPath;
        } catch (err) {
            logger.error(`下载视频发生错误！\ninfo:${ err }`);
        }
    }

    /**
     * 使用Aria2进行多线程下载
     * @param downloadVideoParams
     * @param numThreads
     * @returns {Promise<unknown>}
     */
    async downloadVideoWithAria2(downloadVideoParams, numThreads) {
        const { url, headers, userAgent, proxyOption, target, groupPath } = downloadVideoParams;

        // 构造aria2c命令参数
        const aria2cArgs = [
            `"${ url }"`,
            `--out="temp.mp4"`,
            `--dir="${ groupPath }"`,
            `--user-agent="${ userAgent }"`,
            `--max-connection-per-server=${ numThreads }`, // 每个服务器的最大连接数
            `--split=${ numThreads }`,               // 分成 6 个部分进行下载
        ];

        // 如果有自定义头信息
        if (headers) {
            for (const [key, value] of Object.entries(headers)) {
                aria2cArgs.push(`--header="${ key }: ${ value }"`);
            }
        }

        // 如果使用代理
        if (proxyOption && proxyOption.httpAgent) {
            const proxyUrl = proxyOption.httpAgent.proxy.href;
            aria2cArgs.push(`--all-proxy="${ proxyUrl }"`);
        }

        try {
            await checkAndRemoveFile(target);
            logger.mark(`开始下载: ${ url }`);

            // 执行aria2c命令
            const command = `aria2c ${ aria2cArgs.join(' ') }`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`下载视频发生错误！\ninfo:${ stderr }`);
                    throw error;
                } else {
                    logger.mark(`下载完成: ${ url }`);
                }
            });

            // 监听文件生成完成
            let count = 0;
            return new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    logger.info(logger.red(`[R插件][Aria2] 没有检测到文件！重试第${ count + 1 }次`));
                    count += 1;
                    if (fs.existsSync(target)) {
                        logger.info("[R插件][Aria2] 检测到文件！");
                        clearInterval(checkInterval);
                        resolve(groupPath);
                    }
                    if (count === 6) {
                        logger.error(`[R插件][Aria2] 下载视频发生错误！`);
                        clearInterval(checkInterval);
                        reject();
                    }
                }, DOWNLOAD_WAIT_DETECT_FILE_TIME);
            });
        } catch (err) {
            logger.error(`下载视频发生错误！\ninfo:${ err }`);
            throw err;
        }
    }

    /**
     * 使用Axel进行多线程下载
     * @param downloadVideoParams
     * @param numThreads
     * @returns {Promise<unknown>}
     */
    async downloadVideoUseAxel(downloadVideoParams, numThreads) {
        const { url, headers, userAgent, proxyOption, target, groupPath } = downloadVideoParams;

        // 构造axel命令参数
        const axelArgs = [
            `-n ${ numThreads }`,
            `-o "${ target }"`,
            `-U "${ userAgent }"`,
            url
        ];

        // 如果有自定义头信息
        if (headers) {
            for (const [key, value] of Object.entries(headers)) {
                axelArgs.push(`-H "${ key }: ${ value }"`);
            }
        }

        // 如果使用代理
        if (proxyOption && proxyOption.httpAgent) {
            const proxyUrl = proxyOption.httpAgent.proxy.href;
            axelArgs.push(`--proxy="${ proxyUrl }"`);
        }

        try {
            await checkAndRemoveFile(target);
            logger.mark(`开始下载: ${ url }`);


            // 执行axel命令
            const command = `axel ${ axelArgs.join(' ') }`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`下载视频发生错误！\ninfo:${ stderr }`);
                    throw error;
                } else {
                    logger.mark(`下载完成: ${ url }`);
                }
            });

            let count = 0;
            // 监听文件生成完成
            return new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    logger.info(logger.red(`[R插件][Aria2] 没有检测到文件！重试第${ count + 1 }次`));
                    count += 1;
                    if (fs.existsSync(target)) {
                        logger.info("[R插件][Axel] 检测到文件！");
                        clearInterval(checkInterval);
                        logger.info(`[R插件][Axel] 下载到${ groupPath }`);
                        resolve(groupPath);
                    }
                    if (count === 6) {
                        logger.error(`[R插件][Axel] 下载视频发生错误！`);
                        clearInterval(checkInterval);
                        reject();
                    }
                }, DOWNLOAD_WAIT_DETECT_FILE_TIME);
            });
        } catch (err) {
            logger.error(`下载视频发生错误！\ninfo:${ err }`);
            throw err;
        }
    }

    /**
     * 单线程下载视频
     * @link {downloadVideo}
     * @returns {Promise<unknown>}
     * @param downloadVideoParams
     */
    async downloadVideoWithSingleThread(downloadVideoParams) {
        const { url, headers, userAgent, proxyOption, target, groupPath } = downloadVideoParams;
        const axiosConfig = {
            headers: headers || { "User-Agent": userAgent },
            responseType: "stream",
            ...proxyOption
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
     * 判断是否是海外服务器
     * @return {Promise<Boolean>}
     */
    async isOverseasServer() {
        // 如果第一次使用没有值就设置
        if (!(await redisExistKey(REDIS_YUNZAI_ISOVERSEA))) {
            await redisSetKey(REDIS_YUNZAI_ISOVERSEA, {
                os: false,
            })
            return true;
        }
        // 如果有就取出来
        return (await redisGetKey(REDIS_YUNZAI_ISOVERSEA)).os;
    }

    /**
     * 判断是否是拉格朗日驱动
     * @returns {Promise<Boolean>}
     */
    async isLagRangeDriver() {
        // 如果第一次使用没有值就设置
        if (!(await redisExistKey(REDIS_YUNZAI_LAGRANGE))) {
            await redisSetKey(REDIS_YUNZAI_LAGRANGE, {
                driver: 0,
            });
            return true;
        }
        // 如果有就取出来
        return (await redisGetKey(REDIS_YUNZAI_LAGRANGE)).driver;
    }

    /**
     * 判断当前用户是否是信任用户
     * @param userId
     * @returns {Promise<boolean>}
     */
    async isTrustUser(userId) {
        // 如果不存在则返回
        if (!(await redisExistKey(REDIS_YUNZAI_WHITELIST))) {
            return false;
        }
        const whiteList = await redisGetKey(REDIS_YUNZAI_WHITELIST);
        return whiteList.includes(userId.toString()) || whiteList.includes(userId);
    }

    /**
     * 发送转上传视频
     * @param e              交互事件
     * @param path           视频所在路径
     * @param videoSizeLimit 发送转上传视频的大小限制，默认70MB
     */
    async sendVideoToUpload(e, path, videoSizeLimit = this.videoSizeLimit) {
        try {
            // logger.info(videoSizeLimit);
            const isLag = await this.isLagRangeDriver();
            // 判断是否是拉格朗日
            if (isLag === 1) {
                // 构造拉格朗日适配器
                const lagrange = new LagrangeAdapter(this.toolsConfig.lagrangeForwardWebSocket);
                // 上传群文件
                await lagrange.uploadGroupFile(e.user_id || e.sender.card, e.group_id, path);
                // 上传完直接返回
                return;
            }
            // 判断文件是否存在
            if (!fs.existsSync(path)) {
                return e.reply('视频不存在');
            }
            const stats = fs.statSync(path);
            const videoSize = Math.floor(stats.size / (1024 * 1024));
            // 预览视频逻辑
            if (e.msg.startsWith("预览视频")) {
                const keyframesPath = this.getCurDownloadPath(e) + "keyframes";
                await mkdirIfNotExists(keyframesPath);
                await extractKeyframes(path, keyframesPath);
                const keyframes = await readCurrentDir(keyframesPath);
                // logger.info(keyframes);
                e.reply(Bot.makeForwardMsg(keyframes.map(keyframe => {
                    return {
                        message: segment.image(keyframesPath + "/" + keyframe),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    };
                })))
                return;
            }
            // 正常发送视频
            if (videoSize > videoSizeLimit) {
                e.reply(`当前视频大小：${ videoSize }MB，\n大于设置的最大限制：${ videoSizeLimit }MB，\n改为上传群文件`);
                await this.uploadGroupFile(e, path);
            } else {
                e.reply(segment.video(path));
            }
        } catch (err) {
            logger.error(`[R插件][发送视频判断是否需要上传] 发生错误:\n ${ err }`);
            // logger.info(logger.yellow(`上传发生错误，R插件正在为你采用备用策略，请稍等，如果发不出来请再次尝试！`));
            // e.reply(segment.video(path));
        }
    }

    /**
     * 上传到群文件
     * @param e             交互事件
     * @param path          上传的文件所在路径
     * @return {Promise<void>}
     */
    async uploadGroupFile(e, path) {
        // 判断是否是ICQQ
        if (e.bot?.sendUni) {
            await e.group.fs.upload(path);
        } else {
            await e.group.sendFile(path);
        }
    }
}
