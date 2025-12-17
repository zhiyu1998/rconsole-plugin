import axios from "axios";
import { exec, execSync } from "child_process";
import { HttpsProxyAgent } from 'https-proxy-agent';
import _ from "lodash";
import fetch from "node-fetch";
import { Buffer } from 'node:buffer';
import fs from "node:fs";
import PQueue from 'p-queue';
import path from "path";
import qrcode from "qrcode";
import querystring from "querystring";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import { replyWithRetry } from "../utils/retry.js";
import {
    BILI_CDN_SELECT_LIST,
    BILI_DEFAULT_INTRO_LEN_LIMIT,
    BILI_RESOLUTION_LIST,
    COMMON_USER_AGENT,
    DIVIDING_LINE,
    douyinTypeMap,
    DOWNLOAD_WAIT_DETECT_FILE_TIME,
    HELP_DOC,
    MESSAGE_RECALL_TIME,
    REDIS_YUNZAI_ISOVERSEA,
    REDIS_YUNZAI_WHITELIST,
    SUMMARY_PROMPT,
    transMap,
    TWITTER_BEARER_TOKEN,
    XHS_NO_WATERMARK_HEADER
} from "../constants/constant.js";
import { REDIS_YUNZAI_RESOLVE_CONTROLLER, RESOLVE_CONTROLLER_NAME_ENUM } from "../constants/resolve.js";
import {
    ANIME_SERIES_SEARCH_LINK,
    ANIME_SERIES_SEARCH_LINK2,
    BILI_ARTICLE_INFO,
    BILI_EP_INFO,
    BILI_NAV,
    BILI_NAV_STAT,
    BILI_ONLINE,
    BILI_SSID_INFO,
    BILI_STREAM_FLV,
    BILI_STREAM_INFO,
    BILI_SUMMARY,
    DY_COMMENT,
    DY_INFO,
    DY_LIVE_INFO,
    DY_LIVE_INFO_2,
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
    XHS_REQ_LINK,
    CRAWL_TOOL,
    XHH_BBS_LINK,
    XHH_GAME_LINK,
    XHH_CONSOLE_LINK,
    XHH_MOBILE_LINK
} from "../constants/tools.js";
import BiliInfoModel from "../model/bili-info.js";
import config from "../model/config.js";
import NeteaseModel from "../model/netease.js";
import NeteaseMusicInfo from '../model/neteaseMusicInfo.js';
import * as aBogus from "../utils/a-bogus.cjs";
import { downloadM3u8Videos, mergeAcFileToMp4, parseM3u8, parseUrl } from "../utils/acfun.js";
import { startBBDown } from "../utils/bbdown-util.js";
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
import { convertFlvToMp4 } from "../utils/ffmpeg-util.js";
import { checkAndRemoveFile, deleteFolderRecursive, getMediaFilesAndOthers, mkdirIfNotExists } from "../utils/file.js";
import GeneralLinkAdapter from "../utils/general-link-adapter.js";
import { contentEstimator } from "../utils/link-share-summary-util.js";
import { deepSeekChat, llmRead } from "../utils/llm-util.js";
import { getDS } from "../utils/mihoyo.js";
import { OpenaiBuilder } from "../utils/openai-builder.js";
import { redisExistAndGetKey, redisExistKey, redisGetKey, redisSetKey } from "../utils/redis-util.js";
import { saveTDL, startTDL } from "../utils/tdl-util.js";
import { genVerifyFp } from "../utils/tiktok.js";
import Translate from "../utils/trans-strategy.js";
import { mid2id } from "../utils/weibo.js";
import { convertToSeconds, removeParams, ytbFormatTime } from "../utils/youtube.js";
import { ytDlpGetDuration, ytDlpGetThumbnail, ytDlpGetThumbnailUrl, ytDlpGetTilt, ytDlpHelper } from "../utils/yt-dlp-util.js";
import { textArrayToMakeForward, downloadImagesAndMakeForward, cleanupTempFiles } from "../utils/yunzai-util.js";
import { getApiParams } from "../utils/xiaoheihe.js";

/**
 * fetch重试函数
 * @param {string} url - 请求URL
 * @param {object} options - fetch选项
 * @param {number} retries - 重试次数，默认3次
 * @param {number} delay - 重试延迟（毫秒），默认1000ms
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && i < retries) {
                logger.warn(`[R插件][Fetch重试] 请求失败 (${i + 1}/${retries + 1}): ${url}, 状态码: ${response.status}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            return response;
        } catch (error) {
            if (i < retries) {
                logger.warn(`[R插件][Fetch重试] 请求失败 (${i + 1}/${retries + 1}): ${url}, 错误: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                logger.error(`[R插件][Fetch重试] 请求最终失败: ${url}, 错误: ${error.message}`);
                throw error;
            }
        }
    }
}


export class tools extends plugin {
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
                    reg: `^(翻|trans)[${tools.Constants.existsTransKey}]`,
                    fnc: "trans",
                },
                {
                    reg: "(v.douyin.com|live.douyin.com)",
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
                    reg: "^#(RBS|rbs)$",
                    fnc: "biliState",
                    permission: 'master',
                },
                {
                    reg: "(bilibili.com|b23.tv|bili2233.cn|m.bilibili.com|t.bilibili.com|^BV[1-9a-zA-Z]{10}$)",
                    fnc: "bili",
                },
                {
                    reg: "https?:\\/\\/x.com\\/[0-9-a-zA-Z_]{1,20}\\/status\\/([0-9]*)",
                    fnc: "twitter_x",
                },
                {
                    reg: "(acfun.cn|^ac[0-9]{8}$)",
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
                    reg: "(chenzhongtech.com|kuaishou.com|ixigua.com|h5.pipix.com|h5.pipigx.com|s.xsj.qq.com|m.okjike.com)",
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
                    reg: "(^#总结一下\s*(http|https):\/\/.*|mp.weixin.qq.com|arxiv.org|sspai.com|chinadaily.com.cn|zhihu.com|github.com)",
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
                    reg: "xiaoheihe.cn",
                    fnc: "xiaoheihe"
                },
                {
                    reg: "^#(网易云状态|rns|RNS|网易云云盘状态|rncs|RNCS)$",
                    fnc: "neteaseStatus",
                    permission: 'master',
                },
                {
                    reg: "^#(rnq|RNQ|rncq|RNCQ)$",
                    fnc: 'netease_scan',
                    permission: 'master',
                },

            ],
        });
        // 配置文件
        this.toolsConfig = config.getConfig("tools");
        // 视频保存路径
        this.defaultPath = this.toolsConfig.defaultPath;
        // 视频限制大小
        this.videoSizeLimit = this.toolsConfig.videoSizeLimit;
        // 获取全局禁用的解析
        this.globalBlackList = this.toolsConfig.globalBlackList;
        // 魔法接口
        this.proxyAddr = this.toolsConfig.proxyAddr;
        this.proxyPort = this.toolsConfig.proxyPort;
        this.myProxy = `http://${this.proxyAddr}:${this.proxyPort}`;
        // 加载识别前缀
        this.identifyPrefix = this.toolsConfig.identifyPrefix;
        // 加载直播录制时长
        this.streamDuration = this.toolsConfig.streamDuration;
        // 加载直播是否开启兼容模式
        this.streamCompatibility = this.toolsConfig.streamCompatibility;
        // 加载哔哩哔哩配置
        this.biliSessData = this.toolsConfig.biliSessData;
        // 加载哔哩哔哩的限制时长
        this.biliDuration = this.toolsConfig.biliDuration;
        // 加载番剧的限制时长
        this.biliBangumiDuration = this.toolsConfig.biliBangumiDuration || 1800;
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
        // 加载网易云Cookie
        this.neteaseCookie = this.toolsConfig.neteaseCookie;
        this.neteaseCloudCookie = this.toolsConfig.neteaseCloudCookie;
        // 加载是否转化群语音
        this.isSendVocal = this.toolsConfig.isSendVocal;
        // 加载是否自建服务器
        this.useLocalNeteaseAPI = this.toolsConfig.useLocalNeteaseAPI;
        // 加载自建服务器API
        this.neteaseCloudAPIServer = this.toolsConfig.neteaseCloudAPIServer;
        // 加载网易云解析最高音质
        this.neteaseCloudAudioQuality = this.toolsConfig.neteaseCloudAudioQuality;
        // 加载哔哩哔哩是否使用Aria2
        this.biliDownloadMethod = this.toolsConfig.biliDownloadMethod;
        // 加载哔哩哔哩最高分辨率
        this.biliResolution = this.toolsConfig.biliResolution;
        // 加载番剧直接解析开关
        this.biliBangumiDirect = this.toolsConfig.biliBangumiDirect;
        // 加载番剧独立画质设置
        this.biliBangumiResolution = this.toolsConfig.biliBangumiResolution;
        // 加载智能分辨率开关
        this.biliSmartResolution = this.toolsConfig.biliSmartResolution;
        // 加载文件大小限制
        this.biliFileSizeLimit = this.toolsConfig.biliFileSizeLimit || 100;
        // 加载youtube的截取时长
        this.youtubeClipTime = this.toolsConfig.youtubeClipTime;
        // 加载youtube的解析时长
        this.youtubeDuration = this.toolsConfig.youtubeDuration;
        // 加载油管下载画质选项
        this.youtubeGraphicsOptions = this.toolsConfig.youtubeGraphicsOptions;
        // 加载youtube的Cookie
        this.youtubeCookiePath = this.toolsConfig.youtubeCookiePath;
        // 加载抖音Cookie
        this.douyinCookie = this.toolsConfig.douyinCookie;
        // 加载抖音是否压缩
        this.douyinCompression = this.toolsConfig.douyinCompression;
        // 加载抖音是否开启评论
        this.douyinComments = this.toolsConfig.douyinComments;
        // 加载抖音图片分批阈值
        this.douyinImageBatchThreshold = this.toolsConfig.douyinImageBatchThreshold || 50;
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
        // 强制使用海外服务器
        this.forceOverseasServer = this.toolsConfig.forceOverseasServer;
        // 解析图片是否合并转发
        this.globalImageLimit = this.toolsConfig.globalImageLimit;
        // 加载微博Cookie
        this.weiboCookie = this.toolsConfig.weiboCookie;
        // 加载小黑盒Cookie
        this.xiaoheiheCookie = this.toolsConfig.xiaoheiheCookie;
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
        let place = msg.slice(1 + language[1].length);
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
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.douyin))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.douyin} 已拦截`);
            return false;
        }
        const urlRex = /(http:\/\/|https:\/\/)(v|live).douyin.com\/[A-Za-z\d._?%&+\-=\/#]*/;
        // 检测无效链接，例如：v.douyin.com
        if (!urlRex.test(e.msg)) {
            e.reply(`检测到这是一个无效链接，无法解析抖音${HELP_DOC}`);
            return;
        }
        // 获取链接
        let douUrl = urlRex.exec(e.msg.trim())[0];
        let ttwid = '';
        if (douUrl.includes("v.douyin.com")) {
            const { location, ttwidValue } = await this.douyinRequest(douUrl);
            ttwid = ttwidValue;
            douUrl = location;
        }
        // TODO 如果有新的好解决方案可以删除，如果遇到https://www.iesdouyin.com/share/slides，这类动图暂时交付给其他API解析，感谢群u:"Error: Cannot find id"提供的服务器
        if (douUrl.includes("share/slides")) {
            const detailIdMatch = douUrl.match(/\/slides\/(\d+)/);
            const detailId = detailIdMatch[1];
            const apiUrl = 'http://tk.xigua.wiki:5555/douyin/detail';
            const postData = {
                cookie: "",
                proxy: "",
                source: false,
                detail_id: detailId
            };
            // 用于存储下载的文件路径
            const downloadedFilePaths = [];
            try {
                const apiResponse = await axios.post(apiUrl, postData, {
                    headers: {
                        'Content-Type': 'application/json',
                        'accept': 'application/json'
                    },
                    timeout: 15000
                });
                if (apiResponse.status !== 200 || !apiResponse.data || !apiResponse.data.data) {
                    logger.error(`[R插件][抖音解析] API返回异常状态码或数据结构错误: ${apiResponse.status}, ${JSON.stringify(apiResponse.data)}`);
                    e.reply("解析抖音动图失败，请稍后再试！");
                    return true;
                }
                const apiData = apiResponse.data.data;
                const downloads = apiData.downloads;
                const desc = apiData.desc || "无简介";
                const authorNickname = apiData.nickname || "未知作者";

                const replyMessages = [];
                replyMessages.push(`${this.identifyPrefix}识别：抖音动图，作者：${authorNickname}\n📝 简介：${desc}`);

                const messageSegments = [];
                const downloadPath = this.getCurDownloadPath(e);
                await mkdirIfNotExists(downloadPath);
                await e.reply(replyMessages.join('\n'));
                for (const [index, downloadUrl] of downloads.entries()) {
                    let filePath;
                    let fileName;

                    try {
                        if (downloadUrl.includes(".mp4") || downloadUrl.includes("video_id")) {
                            fileName = `douyin_gif${index > 0 ? index : ''}.mp4`;
                            filePath = `${downloadPath}/${fileName}`;
                            logger.info(`[R插件][抖音动图] 下载视频: ${downloadUrl}`);
                            const response = await axios({
                                method: 'get',
                                url: downloadUrl,
                                responseType: 'stream'
                            });
                            const writer = fs.createWriteStream(filePath);
                            response.data.pipe(writer);
                            await new Promise((resolve, reject) => {
                                writer.on('finish', resolve);
                                writer.on('error', reject);
                            });
                            logger.info(`[R插件][抖音动图] 视频下载完成: ${filePath}`);
                            messageSegments.push({
                                message: segment.video(filePath),
                                nickname: e.sender.card || e.user_id,
                                user_id: e.user_id,
                            });
                            downloadedFilePaths.push(filePath);

                        } else {
                            fileName = `douyin_gif${index > 0 ? index : ''}.png`;
                            filePath = `${downloadPath}/${fileName}`;
                            logger.info(`[R插件][抖音动图] 下载图片: ${downloadUrl}`);
                            const response = await axios({
                                method: 'get',
                                url: downloadUrl,
                                responseType: 'stream'
                            });
                            const writer = fs.createWriteStream(filePath);
                            response.data.pipe(writer);
                            await new Promise((resolve, reject) => {
                                writer.on('finish', resolve);
                                writer.on('error', reject);
                            });
                            logger.info(`[R插件][抖音动图] 图片下载完成: ${filePath}`);
                            messageSegments.push({
                                message: segment.image(filePath),
                                nickname: e.sender.card || e.user_id,
                                user_id: e.user_id,
                            });
                            downloadedFilePaths.push(filePath);
                        }
                    } catch (downloadError) {
                        logger.error(`[R插件][抖音动图] 下载文件失败: ${downloadUrl}, 错误: ${downloadError.message}`);
                        messageSegments.push({
                            message: { type: "text", text: `下载文件失败: ${downloadUrl}` },
                            nickname: e.sender.card || e.user_id,
                            user_id: e.user_id,
                        });
                    }
                }
                if (messageSegments.length > 0) {
                    const forwardMsg = await Bot.makeForwardMsg(messageSegments);
                    await e.reply(forwardMsg);

                    // 删除文件
                    for (const filePath of downloadedFilePaths) {
                        await checkAndRemoveFile(filePath);
                    }
                }
                const headers = {
                    "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
                    "User-Agent": COMMON_USER_AGENT,
                    Referer: "https://www.douyin.com/",
                    cookie: this.douyinCookie,
                };
                await this.douyinComment(e, detailId, headers);

            } catch (error) {
                logger.error(`[R插件][抖音动图] 调用API或处理下载时发生错误: ${error.message}`);
            }
            return true;
        }
        // 获取 ID
        const douId = /note\/(\d+)/g.exec(douUrl)?.[1] ||
            /video\/(\d+)/g.exec(douUrl)?.[1] ||
            /live.douyin.com\/(\d+)/.exec(douUrl)?.[1] ||
            /live\/(\d+)/.exec(douUrl)?.[1] ||
            /webcast.amemv.com\/douyin\/webcast\/reflow\/(\d+)/.exec(douUrl)?.[1];
        // 当前版本需要填入cookie
        if (_.isEmpty(this.douyinCookie) || _.isEmpty(douId)) {
            e.reply(`检测到没有Cookie 或者 这是一个无效链接，无法解析抖音${HELP_DOC}`);
            return;
        }
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
        let dyApi;
        if (douUrl.includes("live.douyin.com")) {
            // 第一类直播类型
            dyApi = DY_LIVE_INFO.replaceAll("{}", douId);
        } else if (douUrl.includes("webcast.amemv.com")) {
            // 第二类直播类型，这里必须使用客户端的 fetch 请求
            dyApi = DY_LIVE_INFO_2.replace("{}", douId) + `&verifyFp=${genVerifyFp()}` + `&msToken=${ttwid}`;
            const webcastResp = await fetch(dyApi);
            const webcastData = await webcastResp.json();
            const item = webcastData.data.room;
            const { title, cover, user_count, stream_url } = item;
            const dySendContent = `${this.identifyPrefix}识别：抖音直播，${title}`;
            await replyWithRetry(e, Bot, [segment.image(cover?.url_list?.[0]), dySendContent, `\n🏄‍♂️在线人数：${user_count}人正在观看`]);
            // 下载10s的直播流
            await this.sendStreamSegment(e, stream_url?.flv_pull_url?.HD1 || stream_url?.flv_pull_url?.FULL_HD1 || stream_url?.flv_pull_url?.SD1 || stream_url?.flv_pull_url?.SD2);
            return;
        } else {
            // 普通类型
            dyApi = DY_INFO.replace("{}", douId);
        }
        // a-bogus参数
        const abParam = aBogus.generate_a_bogus(
            new URLSearchParams(new URL(dyApi).search).toString(),
            headers["User-Agent"],
        );
        // const param = resp.data.result[0].paramsencode;
        const resDyApi = `${dyApi}&a_bogus=${abParam}`;
        headers['Referer'] = `https://www.douyin.com/`;
        // 定义一个dy请求
        const dyResponse = () => axios.get(resDyApi, {
            headers,
        });
        // 如果失败进行3次重试
        try {
            const data = await retryAxiosReq(dyResponse);
            // saveJsonToFile(data);
            // 直播数据逻辑
            if (douUrl.includes("live")) {
                const item = await data.data.data?.[0];
                const { title, cover, user_count_str, stream_url } = item;
                const dySendContent = `${this.identifyPrefix}识别：抖音直播，${title}`;
                await replyWithRetry(e, Bot, [segment.image(cover?.url_list?.[0]), dySendContent, `\n🏄‍♂️在线人数：${user_count_str}人正在观看`]);
                // 下载10s的直播流
                await this.sendStreamSegment(e, stream_url?.flv_pull_url?.HD1 || stream_url?.flv_pull_url?.FULL_HD1 || stream_url?.flv_pull_url?.SD1 || stream_url?.flv_pull_url?.SD2);
                return;
            }
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
                let dySendContent = `${this.identifyPrefix}识别：抖音，${item.author.nickname}\n📝 简介：${item.desc}`;
                if (dyDuration >= durationThreshold) {
                    // 超过阈值，不发送的情况
                    // 封面
                    const dyCover = cover.url_list?.pop();
                    // logger.info(cover.url_list);
                    dySendContent += `\n
                    ${DIVIDING_LINE.replace('{}', '限制说明')}\n当前视频时长约：${(dyDuration / 60).toFixed(2).replace(/\.00$/, '')} 分钟，\n大于管理员设置的最大时长 ${(durationThreshold / 60).toFixed(2).replace(/\.00$/, '')} 分钟！`;
                    await replyWithRetry(e, Bot, [segment.image(dyCover), dySendContent]);
                    // 如果开启评论的就调用
                    await this.douyinComment(e, douId, headers);
                    return;
                }
                e.reply(`${dySendContent}`);
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
                // 加入队列
                await this.downloadVideo(resUrl, false, null, this.videoDownloadConcurrency, 'douyin.mp4').then((videoPath) => {
                    this.sendVideoToUpload(e, videoPath);
                });
            } else if (urlType === "image") {
                // 发送描述
                e.reply(`${this.identifyPrefix}识别：抖音, ${item.desc}`);

                // 提取无水印图片URL列表
                const imageUrls = item.images.map(i => i.url_list[0]);

                // 先尝试用远程URL直接发送
                const remoteImageList = imageUrls.map(url => ({
                    message: segment.image(url),
                    nickname: this.e.sender.card || this.e.user_id,
                    user_id: this.e.user_id,
                }));

                let result;
                if (imageUrls.length <= this.douyinImageBatchThreshold) {
                    // 小于等于阈值一次发送
                    const forwardMsg = await Bot.makeForwardMsg(remoteImageList);
                    result = await e.reply(forwardMsg);
                } else {
                    // 超过阈值分批发送
                    const BATCH_SIZE = this.douyinImageBatchThreshold;
                    let allSuccess = true;

                    for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
                        const batch = remoteImageList.slice(i, i + BATCH_SIZE);
                        const forwardMsg = await Bot.makeForwardMsg(batch);
                        const batchResult = await e.reply(forwardMsg);

                        if (!batchResult || !batchResult.message_id) {
                            allSuccess = false;
                            break;
                        }
                    }

                    result = allSuccess ? { message_id: true } : null;
                }

                // 检测发送结果，如果失败则下载到本地添加随机字节后重试
                if (!result || !result.message_id) {
                    logger.warn(`[R插件][抖音图片] 远程URL发送失败，下载到本地添加随机字节后重试`);

                    const downloadPath = this.getCurDownloadPath(e);
                    await mkdirIfNotExists(downloadPath);
                    const messageSegments = [];
                    const downloadedFilePaths = [];

                    logger.info(`[R插件][抖音图片] 开始并发下载 ${imageUrls.length} 张图片...`);

                    // 并发下载所有图片并添加随机字节
                    const downloadPromises = imageUrls.map(async (imageUrl, index) => {
                        try {
                            const fileName = `douyin_img_${index}.jpg`;
                            const filePath = `${downloadPath}/${fileName}`;

                            // 使用 arraybuffer 下载以便添加随机字节
                            const response = await axios({
                                method: 'get',
                                url: imageUrl,
                                responseType: 'arraybuffer',
                                timeout: 30000
                            });

                            // 添加随机字节到图片末尾，绕过QQ的图片hash检测（风控）
                            const imageBuffer = Buffer.from(response.data);
                            const randomBytes = Buffer.from([
                                Math.floor(Math.random() * 256),
                                Math.floor(Math.random() * 256),
                                Math.floor(Math.random() * 256),
                                index % 256,  // 使用index确保每张图片不同
                                Date.now() % 256
                            ]);
                            const modifiedBuffer = Buffer.concat([imageBuffer, randomBytes]);

                            // 写入文件
                            await fs.promises.writeFile(filePath, modifiedBuffer);

                            return {
                                filePath,
                                segment: {
                                    message: segment.image(filePath),
                                    nickname: this.e.sender.card || this.e.user_id,
                                    user_id: this.e.user_id,
                                }
                            };
                        } catch (error) {
                            logger.error(`[R插件][抖音图片] 图片${index}下载失败: ${error.message}`);
                            return null;
                        }
                    });

                    const results = await Promise.all(downloadPromises);
                    const successResults = results.filter(r => r !== null);

                    successResults.forEach(r => {
                        messageSegments.push(r.segment);
                        downloadedFilePaths.push(r.filePath);
                    });

                    logger.info(`[R插件][抖音图片] 下载完成: ${downloadedFilePaths.length}/${imageUrls.length} 张`);

                    // 发送下载后的图片
                    if (messageSegments.length > 0) {
                        if (messageSegments.length <= this.douyinImageBatchThreshold) {
                            const forwardMsg = await Bot.makeForwardMsg(messageSegments);
                            await e.reply(forwardMsg);
                            logger.info(`[R插件][抖音图片] 发送${messageSegments.length}张图片（已添加随机字节）`);
                        } else {
                            const BATCH_SIZE = this.douyinImageBatchThreshold;
                            const batches = [];

                            for (let i = 0; i < messageSegments.length; i += BATCH_SIZE) {
                                batches.push(messageSegments.slice(i, i + BATCH_SIZE));
                            }

                            for (let i = 0; i < batches.length; i++) {
                                const batch = batches[i];
                                const forwardMsg = await Bot.makeForwardMsg(batch);
                                await e.reply(forwardMsg);
                            }
                            logger.info(`[R插件][抖音图片] 分${batches.length}批发送${messageSegments.length}张图片（已添加随机字节）`);
                        }

                        // 删除临时文件（静默删除）
                        await Promise.all(downloadedFilePaths.map(async (fp) => {
                            try {
                                await fs.promises.unlink(fp);
                            } catch (err) {
                                // 忽略删除错误
                            }
                        }));
                        logger.info(`[R插件][抖音图片] 已清理${downloadedFilePaths.length}张临时文件`);
                    }
                } else {
                    logger.info(`[R插件][抖音图片] 成功发送${imageUrls.length}张图片（远程URL）`);
                }
            }
            // 如果开启评论的就调用
            await this.douyinComment(e, douId, headers);
        } catch (err) {
            logger.error(err);
            logger.mark(`Cookie 过期或者 Cookie 没有填写，请参考\n${HELP_DOC}\n尝试无效后可以到官方QQ群[575663150]提出 bug 等待解决`);
        }
        return true;
    }

    /**
     * 下载直播片段
     * @param e
     * @param stream_url
     * @param second
     */
    async sendStreamSegment(e, stream_url, second = this.streamDuration) {
        let outputFilePath = `${this.getCurDownloadPath(e)}/stream_${second}s.flv`;
        // 删除临时文件
        if (this.streamCompatibility) {
            await checkAndRemoveFile(outputFilePath.replace("flv", "mp4"));
        } else {
            await checkAndRemoveFile(outputFilePath);
        }

        // 创建一个取消令牌
        const CancelToken = axios.CancelToken;
        const source = CancelToken.source();

        try {
            const response = await axios.get(stream_url, {
                responseType: 'stream',
                cancelToken: source.token,
            });
            logger.info("[R插件][发送直播流] 正在下载直播流...");

            const file = fs.createWriteStream(outputFilePath);
            response.data.pipe(file);

            // 设置 streamDuration 秒后停止下载
            setTimeout(async () => {
                logger.info(`[R插件][发送直播流] 直播下载 ${second} 秒钟到，停止下载！`);
                // 取消请求
                source.cancel('[R插件][发送直播流] 下载时间到，停止请求');
                response.data.unpipe(file); // 取消管道连接
                file.end(); // 结束写入
                // 这里判断是否开启兼容模式
                if (this.streamCompatibility) {
                    logger.info(`[R插件][发送直播流] 开启兼容模式，开始转换mp4格式...`);
                    const resolvedOutputPath = await convertFlvToMp4(outputFilePath, outputFilePath.replace(".flv", ".mp4"));
                    fs.unlinkSync(outputFilePath);
                    outputFilePath = resolvedOutputPath;
                    logger.info(`[R插件][发送直播流] 转换完成，开始发送视频...`);
                }
                await this.sendVideoToUpload(e, outputFilePath);
            }, second * 1000);

            // 监听请求被取消的情况
            response.data.on('error', (err) => {
                if (axios.isCancel(err)) {
                    logger.info('请求已取消:', err.message);
                } else {
                    logger.error('下载过程中发生错误:', err.message);
                }
            });
        } catch (error) {
            if (axios.isCancel(error)) {
                logger.info('请求已取消:', error.message);
            } else {
                logger.error(`下载失败: ${error.message}`);
            }
            await fs.promises.unlink(outputFilePath); // 下载失败时删除文件
        }
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
        const commentsResp = await axios.get(`${dyCommentUrl}&a_bogus=${abParam}`, {
            headers
        });
        // logger.info(headers)
        // saveJsonToFile(commentsResp.data, "data.json", _);
        const comments = commentsResp.data.comments;
        const replyComments = comments.map(item => {
            return {
                message: item.text,
                nickname: this.e.sender.card || this.e.user_id,
                user_id: this.e.user_id,
            };
        });
        e.reply(await Bot.makeForwardMsg(replyComments));
    }

    // tiktok解析
    async tiktok(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.tiktok))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.tiktok} 已拦截`);
            return false;
        }
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
        const rawTitle = (await ytDlpGetTilt(url, isOversea, this.myProxy)).toString().replace(/\n/g, '');
        // 清理文件名并截断到10个字符
        const safeTitlePrefix = cleanFilename(rawTitle).substring(0, 10);
        const videoFilename = `${safeTitlePrefix}.mp4`;

        // 清理可能存在的旧文件或同名文件
        await checkAndRemoveFile(`${path}/${videoFilename}`);
        // 清理旧的 temp 文件
        await checkAndRemoveFile(`${path}/temp.mp4`);


        e.reply(`${this.identifyPrefix}识别：TikTok，视频下载中请耐心等待 \n${rawTitle}`);
        // 注意：ytDlpHelper 的 outputFilename 参数位置在 maxThreads 之后
        await ytDlpHelper(path, cleanedTiktokUrl, isOversea, this.myProxy, this.videoDownloadConcurrency, safeTitlePrefix);
        await this.sendVideoToUpload(e, `${path}/${videoFilename}`);
        return true;
    }


    // 哔哩哔哩扫码登录
    async biliScan(e) {
        e.reply('R插件开源免责声明:\n您将通过扫码完成获取哔哩哔哩refresh_token以及ck。\n本Bot将不会保存您的登录状态。\n我方仅提供视频解析及相关B站内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码 ~', { recallMsg: 180 });
        // 图片发送钩子
        const imgSendHook = function (e, path) {
            e.reply([segment.image(path), segment.at(e.user_id), '请扫码以完成获取'], { recallMsg: 180 });
        };
        // 检查路径是否存在文件夹
        await mkdirIfNotExists(this.defaultPath);
        // 发送请求
        const saveCodePath = `${this.defaultPath}qrcode.png`;

        const { SESSDATA, refresh_token } = await getScanCodeData(saveCodePath, 8, () => imgSendHook(e, saveCodePath));

        // 更新到配置文件
        config.updateField("tools", "biliSessData", SESSDATA);
        e.reply('登录成功！相关信息已保存至配置文件', true);
        return true;
    }

    // B站状态
    async biliState(e) {
        if (!this.biliSessData) {
            e.reply("未检测到 B 站登录信息，请填写 SessData");
            return;
        }

        // 封装 fetch 请求为函数
        const fetchData = async (url) => {
            try {
                const res = await fetch(url, {
                    headers: {
                        Cookie: `SESSDATA=${this.biliSessData}`
                    }
                });
                const data = await res.json();
                return data.data;
            } catch (error) {
                e.reply("请求失败，请稍后重试");
                throw error; // 确保错误传播
            }
        };

        // 并行请求用户基本信息和状态信息
        const [biliData, biliStat] = await Promise.all([fetchData(BILI_NAV), fetchData(BILI_NAV_STAT)]);

        // 解构所需的字段
        const { face, uname, level_info, money, wallet, vipStatus } = biliData;
        const {
            following = 0,  // 默认值为 0
            follower = 0,   // 默认值为 0
            dynamic_count = 0 // 默认值为 0
        } = biliStat || {};  // 如果 biliStat 为 undefined，使用空对象解构

        // 获取屏幕截图所需的数据
        const screenData = await new BiliInfoModel(e).getData({
            face,
            uname,
            level_info,
            money,
            wallet,
            vipStatus,
            following,
            follower,
            dynamic_count
        });

        // 使用 puppeteer 生成截图
        try {
            let img = await puppeteer.screenshot("bili-info", screenData);
            e.reply(img, true);
        } catch (error) {
            e.reply("截图生成失败，请稍后重试");
        }
    }

    // B站解析
    async bili(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.bili))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.bili} 已拦截`);
            return false;
        }
        const urlRex = /(?:https?:\/\/)?www\.bilibili\.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
        const bShortRex = /(http:|https:)\/\/(b23.tv|bili2233.cn)\/[A-Za-z\d._?%&+\-=\/#]*/g;
        let url = e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim().replaceAll("\\", "");
        // 直接发送BV号的处理
        if (/^BV[1-9a-zA-Z]{10}$/.exec(url)?.[0]) {
            url = `https://www.bilibili.com/video/${url}`;
            logger.info(url);
        }
        // 短号处理
        if (url.includes("b23.tv") || url.includes("bili2233.cn")) {
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
        // 直播间分享
        // logger.info(url)
        if (url.includes("live.bilibili.com")) {
            // 提取直播间id
            const idPattern = /\/(\d+)$/;
            const parsedUrl = new URL(url);
            const streamId = parsedUrl.pathname.match(idPattern)?.[1];
            // logger.info(streamId)
            // 提取相关信息
            const liveData = await this.getBiliStreamInfo(streamId);
            // saveJsonToFile(liveData.data);
            const {
                title,
                user_cover,
                keyframe,
                description,
                tags,
                live_time,
                parent_area_name,
                area_name
            } = liveData.data.data;
            await replyWithRetry(e, Bot, [
                segment.image(user_cover),
                segment.image(keyframe),
                [`${this.identifyPrefix}识别：哔哩哔哩直播，${title}`,
                `${description ? `📝 简述：${description.replace(`&lt;p&gt;`, '').replace(`&lt;/p&gt;`, '')}` : ''}`,
                `${tags ? `🔖 标签：${tags}` : ''}`,
                `📍 分区：${parent_area_name ? `${parent_area_name}` : ''}${area_name ? `-${area_name}` : ''}`,
                `${live_time ? `⏰ 直播时间：${live_time}` : ''}`,
                `📺 独立播放器: https://www.bilibili.com/blackboard/live/live-activity-player.html?enterTheRoom=0&cid=${streamId}`
                ].filter(item => item.trim() !== "").join("\n")
            ]);
            const streamData = await this.getBiliStream(streamId);
            const { url: streamUrl } = streamData.data.data.durl[0];
            await this.sendStreamSegment(e, streamUrl);
            return true;
        }
        // 处理专栏
        if (e.msg !== undefined && url.includes("read\/cv") || url.includes("read\/mobile")) {
            await this.biliArticle(e, url);
            return true;
        }
        // 动态处理
        if (url.includes("t.bilibili.com") || url.includes("bilibili.com\/opus") || url.includes("bilibili.com\/dynamic")) {
            if (_.isEmpty(this.biliSessData)) {
                e.reply("检测到没有填写biliSessData，无法解析动态");
                return true;
            }
            url = this.biliDynamic(e, url, this.biliSessData);
            return true;
        }
        // 创建文件，如果不存在，
        const path = `${this.getCurDownloadPath(e)}/`;
        await mkdirIfNotExists(path);
        // 处理番剧
        if (url.includes("play\/ep") || url.includes("play\/ss")) {
            const bangumiInfo = await this.biliEpInfo(url, e);

            // 如果超过时长限制，直接返回，不下载
            if (bangumiInfo.isOverLimit) {
                logger.warn(`[R插件][番剧下载] 番剧时长超限，跳过下载`);
                return true;
            }

            // 生成番剧文件名：标题+集数+话（如：凡人修仙传173话）
            const bangumiFilename = `${bangumiInfo.title}${bangumiInfo.episodeNumber}话`;
            logger.info(`[R插件][番剧下载] 文件名: ${bangumiFilename}`);

            // 判断是否开启番剧直接解析
            if (this.biliBangumiDirect) {
                // 开启番剧直接解析，使用正常视频解析流程，复用画质设置（使用番剧独立画质）
                logger.info(`[R插件][番剧直接解析] 开启番剧直接解析，使用独立画质设置: ${this.biliBangumiResolution}`);
                // 传递番剧时长限制参数
                await this.biliDownloadStrategy(e, `https://www.bilibili.com/bangumi/play/ep${bangumiInfo.ep}`, path, this.biliBangumiResolution, 0, bangumiFilename, true);
            } else if (this.biliUseBBDown) {
                // 关闭番剧直接解析但开启了BBDown，使用BBDown下载
                await this.biliDownloadStrategy(e, `https://www.bilibili.com/bangumi/play/ep${bangumiInfo.ep}`, path, null, 0, bangumiFilename, true);
            }
            // 如果都没开启，仅显示信息不下载（保持现有逻辑）
            return true;
        }
        // 视频信息获取例子：http://api.bilibili.com/x/web-interface/view?bvid=BV1hY411m7cB
        // 请求视频信息
        const videoInfo = await getVideoInfo(url);
        // 打印获取到的视频信息，用于调试时长问题
        logger.debug(`[R插件][Bili Debug] Video Info for ${url}: duration=${videoInfo.duration}, pages=${JSON.stringify(videoInfo.pages)}`);
        const { duration, bvid, cid, owner, pages } = videoInfo;

        let durationForCheck;
        let displayTitle = videoInfo.title; // 始终使用总标题
        let partTitle = null; // 用于存储分P标题
        let targetPageInfo = null; // 用于后续下载决策

        const urlParts = url.split('?');
        const queryParams = urlParts.length > 1 ? querystring.parse(urlParts[1]) : {};
        const pParam = queryParams.p ? parseInt(queryParams.p, 10) : null;

        // 只有当分P数量大于1时才认为是多P，并处理分P标题
        if (pages && pages.length > 1) {
            if (pParam && pages.length >= pParam && pParam > 0) {
                // 如果URL指定了有效的p参数
                targetPageInfo = pages[pParam - 1];
                durationForCheck = targetPageInfo.duration;
                partTitle = targetPageInfo.part; // 存储分P标题
                logger.info(`[R插件][Bili Duration] 分析到合集 P${pParam} (分P标题: ${partTitle}), 时长: ${durationForCheck}s`);
            } else {
                // 否则，默认检查第一个分P
                targetPageInfo = pages[0];
                durationForCheck = targetPageInfo.duration;
                // 在多P情况下，即使用户没有指定p，也显示第一个分p的标题
                partTitle = targetPageInfo.part;
                logger.info(`[R插件][Bili Duration] 分析到合集 P1 (分P标题: ${partTitle}), 时长: ${durationForCheck}s`);
            }
        } else {
            // 单P或无分P信息
            durationForCheck = duration;
            // 对于单P视频，我们不设置 partTitle，以避免混淆
            logger.info(`[R插件][Bili Duration] Using total duration (Title: ${displayTitle}): ${durationForCheck}s`);
        }

        const isLimitDuration = durationForCheck > this.biliDuration;
        // 动态构造哔哩哔哩信息
        let biliInfo = await this.constructBiliInfo(videoInfo, displayTitle, partTitle, pParam || (pages && pages.length > 1 ? 1 : null));
        // 总结
        if (this.biliDisplaySummary) {
            const summary = await this.getBiliSummary(bvid, cid, owner.mid);
            // 封装总结
            summary && e.reply(await Bot.makeForwardMsg(textArrayToMakeForward(e, [`「R插件 x bilibili」联合为您总结内容：`, summary])));
        }
        // 限制视频解析
        if (isLimitDuration) {
            const durationInMinutes = (durationForCheck / 60).toFixed(0); // 使用 durationForCheck
            biliInfo.push(`${DIVIDING_LINE.replace('{}', '限制说明')}\n当前视频时长约：${durationInMinutes}分钟，\n大于管理员设置的最大时长 ${(this.biliDuration / 60).toFixed(2).replace(/\.00$/, '')} 分钟！`);
            await replyWithRetry(e, Bot, biliInfo);
            return true;
        } else {
            await replyWithRetry(e, Bot, biliInfo);
        }
        // 只提取音乐处理
        if (e.msg !== undefined && e.msg.startsWith("音乐")) {
            return await this.biliMusic(e, url);
        }
        // 下载文件
        await this.biliDownloadStrategy(e, url, path, null, durationForCheck, bvid);
        return true;
    }

    /**
     * 提取哔哩哔哩专栏
     * @param e
     * @param url
     * @returns {Promise<void>}
     */
    async biliArticle(e, url) {
        const cvid = url.match(/read\/cv(\d+)/)?.[1] || url.match(/read\/mobile\?id=(\d+)/)?.[1];
        const articleResp = await fetchWithRetry(BILI_ARTICLE_INFO.replace("{}", cvid), {
            headers: {
                ...BILI_HEADER
            }
        });
        const articleData = (await articleResp.json()).data;
        const { title, author_name, origin_image_urls } = articleData;
        if (origin_image_urls) {
            const titleMsg = {
                message: { type: "text", text: `标题：${title}\n作者：${author_name}` },
                nickname: e.sender.card || e.user_id,
                user_id: e.user_id,
            };
            const imageMessages = origin_image_urls.map(item => {
                return {
                    message: segment.image(item),
                    nickname: e.sender.card || e.user_id,
                    user_id: e.user_id,
                };
            }).concat(titleMsg);

            await replyWithRetry(e, Bot, Bot.makeForwardMsg(imageMessages));
        }
    }

    /**
     * 构造哔哩哔哩信息
     * @param videoInfo
     * @param displayTitle
     * @param partTitle
     * @param pParam
     * @returns {Promise<(string|string|*)[]>}
     */
    async constructBiliInfo(videoInfo, displayTitle, partTitle, pParam) { // 增加 partTitle 和 pParam 参数
        const { desc, bvid, cid, pic } = videoInfo;
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
            combineContent += `\n${formatBiliInfo(dataProcessMap)}`;
        }
        // 是否显示简介
        if (this.biliDisplayIntro) {
            // 过滤简介中的一些链接
            const filteredDesc = await filterBiliDescLink(desc);
            combineContent += `\n📝 简介：${truncateString(filteredDesc, this.toolsConfig.biliIntroLenLimit || BILI_DEFAULT_INTRO_LEN_LIMIT)}`;
        }
        // 是否显示在线人数
        if (this.biliDisplayOnline) {
            // 拼接在线人数
            const onlineTotal = await this.biliOnlineTotal(bvid, cid);
            combineContent += `\n🏄‍♂️️ 当前视频有 ${onlineTotal.total} 人在观看，其中 ${onlineTotal.count} 人在网页端观看`;
        }

        let finalTitle = `${this.identifyPrefix}识别：哔哩哔哩，${displayTitle}`;
        // 如果有多P标题，并且它和主标题不一样，则添加
        if (partTitle && partTitle !== displayTitle) {
            finalTitle += `|${pParam}P: ${partTitle}`;
        }

        let biliInfo = [finalTitle, combineContent];
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
            let resp = await (await fetchWithRetry(BILI_SSID_INFO.replace("{}", ssid), {
                headers: BILI_HEADER
            })).json();
            ep = (resp.result.main_section.episodes[0].share_url).replace("https://www.bilibili.com/bangumi/play/ep", "");
        }
        // 处理普通情况，上述情况无法处理的
        if (_.isEmpty(ep)) {
            ep = url.match(/\/ep(\d+)/)?.[1];
        }
        const resp = await (await fetchWithRetry(BILI_EP_INFO.replace("{}", ep), {
            headers: BILI_HEADER
        })).json();
        const result = resp.result;

        // 调试：输出番剧信息结构，用于确认集数信息
        logger.info(`[R插件][番剧信息调试] 番剧标题: ${result.title}`);
        logger.info(`[R插件][番剧信息调试] 番剧类型: ${result.type_name || '未知'}`);
        logger.info(`[R插件][番剧信息调试] 集数描述: ${result.new_ep?.desc || '无'}`);
        logger.info(`[R插件][番剧信息调试] index_show: ${result.seasons?.[0]?.new_ep?.index_show || '无'}`);
        logger.info(`[R插件][番剧信息调试] episodes是否存在: ${result.episodes ? '是' : '否'}`);

        // 尝试从episodes中查找当前ep的信息
        const currentEpisode = result.episodes?.find(item => item.ep_id == ep);
        if (currentEpisode) {
            logger.info(`[R插件][番剧信息调试] 当前集标题: ${currentEpisode.title || '无'}`);
            logger.info(`[R插件][番剧信息调试] 当前集长标题: ${currentEpisode.long_title || '无'}`);
            logger.info(`[R插件][番剧信息调试] 当前集标题显示: ${currentEpisode.title_display || '无'}`);
        } else {
            logger.warn(`[R插件][番剧信息调试] 未找到当前集信息，ep=${ep}`);
        }

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

        // 识别类型：番剧/综艺/纪录片等
        const typeName = result.type_name || '番剧';
        const displayType = typeName === '综艺' ? 'bilibili综艺' : `哔哩哔哩${typeName}`;

        // 检查时长限制
        let durationSeconds = 0;
        if (currentEpisode?.duration) {
            durationSeconds = currentEpisode.duration / 1000; // 毫秒转秒
        }
        logger.info(`[R插件][番剧时长] 当前集时长: ${durationSeconds}秒`);

        const isOverLimit = durationSeconds > 0 && durationSeconds > this.biliBangumiDuration;

        // 构建识别消息
        let replyContent = [
            segment.image(resp.result.cover),
            `${this.identifyPrefix}识别：${displayType}，${title}\n🎯 评分: ${result?.rating?.score ?? '-'} / ${result?.rating?.count ?? '-'}\n📺 ${result?.new_ep?.desc ?? '更新中'}, ${result?.seasons?.[0]?.new_ep?.index_show ?? '第1集'}\n`,
            `${formatBiliInfo(dataProcessMap)}`,
            `\n\n🪶 在线观看： ${await urlTransformShortLink(ANIME_SERIES_SEARCH_LINK + title)}`,
            `\n🌸 在线观看： ${await urlTransformShortLink(ANIME_SERIES_SEARCH_LINK2 + title)}`
        ];

        // 如果超时，添加限制说明
        if (isOverLimit) {
            const durationMinutes = (durationSeconds / 60).toFixed(0);
            const limitMinutes = (this.biliBangumiDuration / 60).toFixed(2).replace(/\.00$/, '');
            replyContent.push(`${DIVIDING_LINE.replace('{}', '限制说明')}\n当前${typeName}时长约：${durationMinutes}分钟，\n大于管理员设置的最大时长 ${limitMinutes} 分钟！`);
        }

        await replyWithRetry(e, Bot, replyContent);

        // 返回ep和番剧信息，用于文件命名，以及是否超限
        return {
            ep,
            title: result.title,
            episodeNumber: currentEpisode?.title || ep.toString(),
            isOverLimit  // 新增：是否超过时长限制
        };
    }

    /**
     * 哔哩哔哩下载策略
     * @param e          事件
     * @param url        链接
     * @param path       保存路径
     * @param resolution 可选的分辨率参数，不传则使用默认配置
     * @param duration   视频时长（秒），用于文件大小估算
     * @param filename   可选的文件名（不含扩展名），用于番剧等特殊命名
     * @returns {Promise<void>}
     */
    async biliDownloadStrategy(e, url, path, resolution = null, duration = 0, filename = null) {
        // 使用传入的分辨率或默认分辨率
        const useResolution = resolution !== null ? resolution : this.biliResolution;
        // 使用传入的文件名或默认的temp
        const tempFilename = filename || 'temp';
        return this.queue.add(async () => {
            // =================以下是调用BBDown的逻辑=====================
            // 下载视频和音频
            const tempPath = `${path}${tempFilename}`;
            // 检测是否开启BBDown
            if (this.biliUseBBDown) {
                // 检测环境的 BBDown
                const isExistBBDown = await checkToolInCurEnv("BBDown");
                // 存在 BBDown
                if (isExistBBDown) {
                    // 删除之前的文件
                    await checkAndRemoveFile(`${tempPath}.mp4`);
                    // 下载视频
                    await startBBDown(url, path, {
                        biliSessData: this.biliSessData,
                        biliUseAria2: this.biliDownloadMethod === 1,
                        biliCDN: BILI_CDN_SELECT_LIST.find(item => item.value === this.biliCDN)?.sign,
                        biliResolution: useResolution,
                    });
                    // 发送视频
                    return this.sendVideoToUpload(e, `${tempPath}.mp4`);
                }
                e.reply("🚧 R插件提醒你：开启但未检测到当前环境有【BBDown】，即将使用默认下载方式 ( ◡̀_◡́)ᕤ");
            }
            // =================默认下载方式=====================
            try {
                // 获取分辨率参数 QN，如果没有默认使用 480p --> 32
                const resolutionItem = BILI_RESOLUTION_LIST.find(item => item.value === useResolution);
                const qn = resolutionItem?.qn || 32;
                logger.info(`[R插件][BILI下载] 使用分辨率: ${resolutionItem?.label || '默认480P'}, QN: ${qn}, useResolution值: ${useResolution}`);
                // 获取下载链接，传入duration用于文件大小估算，传入智能分辨率配置
                const data = await getDownloadUrl(url, this.biliSessData, qn, duration, this.biliSmartResolution, this.biliFileSizeLimit);

                if (data.audioUrl != null) {
                    await this.downBili(tempPath, data.videoUrl, data.audioUrl);
                } else {
                    // 处理无音频的情况
                    await downloadBFile(data.videoUrl, `${tempPath}.mp4`, _.throttle(
                        value =>
                            logger.mark("视频下载进度", {
                                data: value,
                            }),
                        1000,
                    ));
                }

                // 上传视频
                return this.sendVideoToUpload(e, `${tempPath}.mp4`);
            } catch (err) {
                // 错误处理
                logger.error('[R插件][哔哩哔哩视频发送]下载错误，具体原因为:', err);
                e.reply("解析失败，请重试一下");
            }
        });
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
        };
    }

    // 下载哔哩哔哩音乐
    async biliMusic(e, url) {
        const videoId = /video\/[^\?\/ ]+/.exec(url)[0].split("/")[1];
        this.queue.add(() => {
            getBiliAudio(videoId, "").then(async audioUrl => {
                const path = this.getCurDownloadPath(e);
                const biliMusicPath = await m4sToMp3(audioUrl, path);
                // 发送语音
                e.reply(segment.record(biliMusicPath));
                // 上传群文件
                await this.uploadGroupFile(e, biliMusicPath);
            });
        });
        return true;
    }

    // 发送哔哩哔哩动态的算法
    biliDynamic(e, url, session) {
        // 去除多余参数
        if (url.includes("?")) {
            url = url.substring(0, url.indexOf("?"));
        }
        const dynamicId = /[^/]+(?!.*\/)/.exec(url)[0];
        getDynamic(dynamicId, session).then(async resp => {
            if (resp.dynamicSrc.length > 0 || resp.dynamicDesc) {
                // 先发送动态描述文本
                if (resp.dynamicDesc) {
                    e.reply(`${this.identifyPrefix}识别：哔哩哔哩动态\n${resp.dynamicDesc}`);
                }

                // 处理图片消息
                if (resp.dynamicSrc.length > 0) {
                    if (resp.dynamicSrc.length > this.globalImageLimit) {
                        const dynamicSrcMsg = resp.dynamicSrc.map(item => ({
                            message: segment.image(item),
                            nickname: e.sender.card || e.user_id,
                            user_id: e.user_id,
                        }));
                        await replyWithRetry(e, Bot, await Bot.makeForwardMsg(dynamicSrcMsg));
                    } else {
                        const images = resp.dynamicSrc.map(item => segment.image(item));
                        await e.reply(images);
                    }
                }
            } else {
                await e.reply(`${this.identifyPrefix}识别：哔哩哔哩动态, 但是失败！`);
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
        let wbi = "wts=1701546363&w_rid=1073871926b3ccd99bd790f0162af634";
        if (!_.isEmpty(this.biliSessData)) {
            wbi = await getWbi({ bvid, cid, up_mid }, this.biliSessData);
        }
        // 构造API
        const summaryUrl = `${BILI_SUMMARY}?${wbi}`;
        logger.info(summaryUrl);
        // 构造结果：https://api.bilibili.com/x/web-interface/view/conclusion/get?bvid=BV1L94y1H7CV&cid=1335073288&up_mid=297242063&wts=1701546363&w_rid=1073871926b3ccd99bd790f0162af634
        return axios.get(summaryUrl, {
            headers: {
                Cookie: `SESSDATA=${this.biliSessData}`
            }
        })
            .then(resp => {
                logger.debug(resp)
                const data = resp.data.data?.model_result;
                logger.debug(data)
                const summary = data?.summary;
                const outline = data?.outline;
                let resReply = "";
                // 总体总结
                if (summary) {
                    resReply = `\n摘要：${summary}\n`;
                }
                // 分段总结
                if (outline) {
                    const specificTimeSummary = outline.map(item => {
                        const smallTitle = item.title;
                        const keyPoint = item?.part_outline;
                        // 时间点的总结
                        const specificContent = keyPoint.map(point => {
                            const { timestamp, content } = point;
                            const specificTime = secondsToTime(timestamp);
                            return `${specificTime}  ${content}\n`;
                        }).join("");
                        return `- ${smallTitle}\n${specificContent}\n`;
                    });
                    resReply += specificTimeSummary.join("");
                }
                return resReply;
            });
    }

    /**
     * 获取直播间信息
     * @param liveId
     * @returns {Promise<*>}
     */
    async getBiliStreamInfo(liveId) {
        return axios.get(`${BILI_STREAM_INFO}?room_id=${liveId}`, {
            headers: {
                'User-Agent': COMMON_USER_AGENT,
            }
        });
    }

    /**
     * 获取直播流
     * @param liveId
     * @returns {Promise<*>}
     */
    async getBiliStream(liveId) {
        return axios.get(`${BILI_STREAM_FLV}?cid=${liveId}`, {
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
        };
        await fetch(TWITTER_TWEET_INFO.replace("{}", id), {
            headers: {
                "User-Agent": "v2TweetLookupJS",
                "authorization": `Bearer ${Buffer.from(TWITTER_BEARER_TOKEN, "base64").toString()}`
            },
            ...params,
            agent: !isOversea ? '' : new HttpsProxyAgent(this.myProxy),
        }).then(async resp => {
            logger.info(resp);
            e.reply(`${this.identifyPrefix}识别：小蓝鸟学习版，${resp.data.text}`);
            const downloadPath = `${this.getCurDownloadPath(e)}`;
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
                    await this.downloadVideo(resp.includes.media[0].variants[0].url, true, null, this.videoDownloadConcurrency, 'twitter.mp4').then(
                        videoPath => {
                            e.reply(segment.video(videoPath));
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
            await replyWithRetry(e, Bot, await Bot.makeForwardMsg(images));

            // 清理文件
            path.forEach(item => {
                fs.unlinkSync(item);
            });
        });
        return true;
    }

    // 使用现有api解析小蓝鸟
    async twitter_x(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.twitter_x))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.twitter_x} 已拦截`);
            return false;
        }
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
        e.reply(`${this.identifyPrefix}识别：小蓝鸟学习版`);
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
        };

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
                });
                e.reply(segment.image(xImgPath));
            }
        } else {
            this.downloadVideo(url, !isOversea, null, this.videoDownloadConcurrency, 'twitter.mp4').then(videoPath => {
                e.reply(segment.video(videoPath));
            });
        }
        return true;
    }

    // acfun解析
    async acfun(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.acfun))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.acfun} 已拦截`);
            return false;
        }
        const path = `${this.getCurDownloadPath(e)}/temp/`;
        await mkdirIfNotExists(path);

        let inputMsg = e.msg;
        // 适配手机分享：https://m.acfun.cn/v/?ac=32838812&sid=d2b0991bd6ad9c09
        if (inputMsg.includes("m.acfun.cn")) {
            inputMsg = `https://www.acfun.cn/v/ac${/ac=([^&?]*)/.exec(inputMsg)[1]}`;
        } else if (inputMsg.includes("ac")) {
            // 如果是
            inputMsg = "https://www.acfun.cn/v/" + /ac\d+/.exec(inputMsg)[0];
        }

        parseUrl(inputMsg).then(res => {
            e.reply(`${this.identifyPrefix}识别：猴山，${res.videoName}`);
            parseM3u8(res.urlM3u8s[res.urlM3u8s.length - 1]).then(res2 => {
                downloadM3u8Videos(res2.m3u8FullUrls, path).then(_ => {
                    mergeAcFileToMp4(res2.tsNames, path, `${path}out.mp4`).then(_ => {
                        this.sendVideoToUpload(e, `${path}out.mp4`);
                    });
                });
            });
        });
        return true;
    }

    // 小红书解析
    async xhs(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.xhs))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.xhs} 已拦截`);
            return false;
        }
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
            )?.[0];
        // 注入ck
        XHS_NO_WATERMARK_HEADER.cookie = this.xiaohongshuCookie;
        // 解析短号
        let id, xsecToken, xsecSource;
        if (msgUrl.includes("xhslink")) {
            await fetch(msgUrl, {
                headers: XHS_NO_WATERMARK_HEADER,
                redirect: "follow",
            }).then(resp => {
                const uri = decodeURIComponent(resp.url);
                const parsedUrl = new URL(resp.url);
                // 如果出现了网页验证uri:https://www.xiaohongshu.com/website-login/captcha?redirectPath=https://www.xiaohongshu.com/discovery/item/63c93ac3000000002203b28a?app_platform=android&app_version=8.23.1&author_share=1&ignoreEngage=true&share_from_user_hidden=true&type=normal&xhsshare=CopyLink&appuid=62c58b90000000000303dc54&apptime=1706149572&exSource=&verifyUuid=a5f32b62-453e-426b-98fe-2cfe0c16776d&verifyType=102&verifyBiz=461
                const verify = uri.match(/\/item\/([0-9a-fA-F]+)/);
                // 一般情况下不会出现问题就使用这个正则
                id = /noteId=(\w+)/.exec(uri)?.[1] ?? verify?.[1];
                // 提取 xsec_source 和 xsec_token 参数
                xsecSource = parsedUrl.searchParams.get("xsec_source") || "pc_feed";
                xsecToken = parsedUrl.searchParams.get("xsec_token");
            });
        } else {
            // 新版 xhs 这里必须是e.msg.trim()，因为要匹配参数：xsec_source 和 xsec_token
            const xhsUrlMatch = e.msg.trim().replace("amp;", "").match(/(http|https)?:\/\/(www\.)?xiaohongshu\.com[^\s]+/);
            if (!xhsUrlMatch) {
                logger.info("[R插件][xhs] 无法匹配到链接");
                return;
            }
            const parsedUrl = new URL(xhsUrlMatch[0]);
            id = /explore\/(\w+)/.exec(msgUrl)?.[1] || /discovery\/item\/(\w+)/.exec(msgUrl)?.[1];
            // 提取 xsec_source 和 xsec_token 参数
            xsecSource = parsedUrl.searchParams.get("xsec_source") || "pc_feed";
            xsecToken = parsedUrl.searchParams.get("xsec_token");
        }
        const downloadPath = `${this.getCurDownloadPath(e)}`;
        // 检测没有 cookie 则退出
        if (_.isEmpty(this.xiaohongshuCookie) || _.isEmpty(id) || _.isEmpty(xsecToken) || _.isEmpty(xsecSource)) {
            e.reply(`请检查以下问题：\n1. 是否填写 Cookie\n2. 链接是否有id\n3. 链接是否有 xsec_token 和 xsec_source\n${HELP_DOC}`);
            return;
        }
        // 获取信息
        const resp = await fetch(`${XHS_REQ_LINK}${id}?xsec_token=${xsecToken}&xsec_source=${xsecSource}`, {
            headers: XHS_NO_WATERMARK_HEADER,
        });
        // 从网页获取数据
        const xhsHtml = await resp.text();
        const reg = /window\.__INITIAL_STATE__=(.*?)<\/script>/;
        const res = xhsHtml.match(reg)[1].replace(/undefined/g, "null");
        const resJson = JSON.parse(res);
        // saveJsonToFile(resJson);
        // 检测无效 Cookie
        if (resJson?.note === undefined || resJson?.note?.noteDetailMap?.[id]?.note === undefined) {
            e.reply(`检测到无效的小红书 Cookie，可以尝试清除缓存和cookie 或者 换一个浏览器进行获取\n${HELP_DOC}`);
            return;
        }
        // 提取出数据
        const noteData = resJson?.note?.noteDetailMap?.[id]?.note;
        const { title, desc, type } = noteData;
        if (type === "video") {
            // 封面
            const cover = noteData.imageList?.[0].urlDefault;
            await replyWithRetry(e, Bot, [segment.image(cover), `${this.identifyPrefix}识别：小红书, ${title}\n${desc}`]);
            // ⚠️ （暂时废弃）构造xhs视频链接（有水印）
            const xhsVideoUrl = noteData.video.media.stream.h264?.[0]?.masterUrl;

            // 构造无水印
            // const xhsVideoUrl = `http://sns-video-bd.xhscdn.com/${ noteData.video.consumer.originVideoKey }`
            // 下载视频
            this.downloadVideo(xhsVideoUrl, false, null, this.videoDownloadConcurrency, 'xiaohongshu.mp4').then(videoPath => {
                if (videoPath === undefined) {
                    return;
                }
                this.sendVideoToUpload(e, videoPath);
            });
            return true;
        } else if (type === "normal") {
            e.reply(`${this.identifyPrefix}识别：小红书, ${title}\n${desc}`);
            const imagePromises = [];
            // 使用 for..of 循环处理异步下载操作
            for (let [index, item] of noteData.imageList.entries()) {
                imagePromises.push(downloadImg({
                    img: item.urlDefault,
                    dir: downloadPath,
                    fileName: `${index}.png`,
                    downloadMethod: this.biliDownloadMethod,
                }));
            }
            // 等待所有图片下载完成
            const paths = await Promise.all(imagePromises);


            if (paths.length > this.globalImageLimit) {
                // 直接构造 imagesData 数组
                const imagesData = await Promise.all(paths.map(async (item) => {
                    return {
                        message: segment.image(await fs.promises.readFile(item)),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    };
                }));

                // 回复带有转发消息的图片数据
                await replyWithRetry(e, Bot, await Bot.makeForwardMsg(imagesData));
            } else {
                // 如果图片数量小于限制，直接发送图片
                const images = await Promise.all(paths.map(async (item) => segment.image(await fs.promises.readFile(item))));
                await e.reply(images);
            }

            // 批量删除下载的文件
            await Promise.all(paths.map(item => fs.promises.rm(item, { force: true })));
        }
        return true;
    }

    // 波点音乐解析
    async bodianMusic(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.bodianMusic))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.bodianMusic} 已拦截`);
            return false;
        }
        // 音频例子：https://h5app.kuwo.cn/m/bodian/playMusic.html?uid=3216773&musicId=192015898&opusId=&extendType=together
        // 视频例子：https://h5app.kuwo.cn/m/bodian/play.html?uid=3216773&mvId=118987&opusId=770096&extendType=together
        const id =
            /(?=musicId).*?(?=&)/.exec(e.msg.trim())?.[0].replace("musicId=", "") ||
            /(?=mvId).*?(?=&)/.exec(e.msg.trim())?.[0].replace("mvId=", "");
        const { name, album, artist, albumPic120, categorys } = await getBodianMusicInfo(id);
        e.reply([
            `${this.identifyPrefix}识别：波点音乐，${name}-${album}-${artist}\n标签：${categorys
                .map(item => item.name)
                .join(" | ")}`,
            segment.image(albumPic120),
        ]);
        if (e.msg.includes("musicId")) {
            const path = `${this.getCurDownloadPath(e)}`;
            await getBodianAudio(id, path, `${name}-${artist}`).then(sendPath => {
                // 发送语音
                e.reply(segment.record(sendPath));
                // Upload group file
                this.uploadGroupFile(e, sendPath);
                // Delete file
                checkAndRemoveFile(sendPath);
            });
        } else if (e.msg.includes("mvId")) {
            await getBodianMv(id).then(res => {
                // 下载 && 发送
                const { coverUrl, highUrl, lowUrl, shortLowUrl } = res;
                this.downloadVideo(lowUrl, false, null, this.videoDownloadConcurrency, 'bodian.mp4').then(videoPath => {
                    e.reply(segment.video(videoPath));
                });
            });
        }
        return true;
    }

    // 网易云登录状态
    async neteaseStatus(e, reck) {
        const isCloud = /云盘状态|rncs|RNCS/i.test(e.msg);
        const cookie = reck ? reck : (isCloud ? this.neteaseCloudCookie : this.neteaseCookie);
        const cookieName = isCloud ? "网易云云盘" : "网易云";

        // 优先判断是否使用自建 API
        let autoSelectNeteaseApi = this.useLocalNeteaseAPI ? this.neteaseCloudAPIServer : (await this.isOverseasServer() ? NETEASE_SONG_DOWNLOAD : NETEASE_API_CN);
        const statusUrl = `${autoSelectNeteaseApi}/login/status`;

        try {
            const statusResponse = await axios.get(statusUrl, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT,
                    "Cookie": cookie,
                },
            });
            const userInfo = statusResponse.data?.data?.profile;
            if (!userInfo) {
                e.reply(`暂未登录${cookieName}，请发 ${isCloud ? '#rncq' : '#rnq'} 进行登陆绑定ck`);
                return;
            }

            const vipResponse = await axios.get(`${autoSelectNeteaseApi}/vip/info?uid=${userInfo.userId}`, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT,
                    "Cookie": cookie,
                },
            });
            const vipInfo = vipResponse.data?.data;

            const checkVipStatus = async (vipLevel, expireTime, nickname, avatarUrl) => {
                const expireDate = new Date(expireTime);
                if (expireDate > Date.now()) {
                    const vipLevelData = vipLevel.split("\n");
                    const neteaseData = await new NeteaseModel(e).getData({
                        avatarUrl: `${avatarUrl}?param=170y170`,
                        nickname,
                        vipLevel: vipLevelData[0],
                        musicQuality: vipLevelData[2],
                        expireDate: expireDate.toLocaleString(),
                        cookieName: cookieName,
                    });
                    let img = await puppeteer.screenshot("netease", neteaseData);
                    e.reply(img, true);
                    return true;
                }
                return false;
            };

            if (vipInfo.redplus.vipCode !== 0 && await checkVipStatus(`SVIP${vipInfo.redplus.vipLevel}\n最高解析音质:\n jymaster(超清母带)`, vipInfo.redplus.expireTime, userInfo.nickname, userInfo.avatarUrl)) {
                return;
            }
            if (vipInfo.associator.vipCode !== 0 && await checkVipStatus(`VIP${vipInfo.associator.vipLevel}\n最高解析音质:\n jyeffect(高清环绕音)`, vipInfo.associator.expireTime, userInfo.nickname, userInfo.avatarUrl)) {
                return;
            }

            // 如果都已过期，发送 VIP 已过期信息
            const neteaseData = await new NeteaseModel(e).getData({
                avatarUrl: `${userInfo.avatarUrl}?param=170y170`,
                nickname: userInfo.nickname,
                vipLevel: vipInfo.redplus.vipCode !== 0 ? `SVIP${vipInfo.redplus.vipLevel}(已过期)` : vipInfo.associator.vipCode !== 0 ? `VIP${vipInfo.associator.vipLevel}(已过期)` : '未开通',
                musicQuality: 'standard(标准)',
                expireDate: '未开通',
                cookieName: cookieName,
            });
            let img = await puppeteer.screenshot("netease", neteaseData);
            e.reply(img, true);
        } catch (error) {
            logger.error(`获取${cookieName}状态时出错:`, error);
            e.reply(`获取${cookieName}状态时出错，请稍后再试`);
        }
    }

    // 轮询网易云状态
    async pollLoginStatus(autoSelectNeteaseApi, unikey, e, isCloud) {
        let pollCount = 0;
        const maxPolls = 8;
        const intervalTime = 5000;
        const cookieName = isCloud ? "网易云云盘" : "网易云";

        const pollRequest = async () => {
            try {
                const pollUrl = `${autoSelectNeteaseApi}/login/qr/check?key=${unikey}&timestamp=${Date.now()}`;
                const res = await axios.get(pollUrl, { headers: { "User-Agent": COMMON_USER_AGENT } });

                if (res.data.code == '800') {
                    e.reply("二维码过期，请重新获取");
                    clearInterval(intervalId);
                    return;
                }

                if (res.data.code == '803') {
                    const regex = /music_u=([^;]+)/i;
                    const match = res.data.cookie.match(regex);
                    if (match) {
                        try {
                            const ck = `${match[0]}; os=pc`;
                            const fieldToUpdate = isCloud ? "neteaseCloudCookie" : "neteaseCookie";
                            await config.updateField("tools", fieldToUpdate, ck);
                            this.neteaseStatus(e, ck);
                            e.reply(`扫码登录${cookieName}成功，ck已自动保存`);
                        } catch (error) {
                            logger.error(`更新${cookieName} ck时出错:`, error);
                            e.reply(`更新${cookieName} ck时出错，请稍后重试`);
                        }
                    }
                    clearInterval(intervalId);
                    return;
                }

                pollCount++;
                if (pollCount > maxPolls) {
                    clearInterval(intervalId);
                    logger.info('超时轮询已停止');
                    e.reply('扫码超时，请重新获取');
                }
            } catch (error) {
                logger.error('轮询过程中出错:', error);
                clearInterval(intervalId);
                e.reply('轮询过程中发生错误，请稍后再试');
            }
        };

        const intervalId = setInterval(pollRequest, intervalTime);
    }

    // 网易云扫码登录
    async netease_scan(e) {
        const isCloud = /rncq|RNCQ/i.test(e.msg);
        const cookieName = isCloud ? "网易云云盘" : "网易云";
        try {
            // 优先判断是否使用自建 API
            const isOversea = await this.isOverseasServer();
            let autoSelectNeteaseApi;
            if (this.useLocalNeteaseAPI) {
                autoSelectNeteaseApi = this.neteaseCloudAPIServer;
            } else {
                autoSelectNeteaseApi = (isOversea ? NETEASE_SONG_DOWNLOAD : NETEASE_API_CN);
                await e.reply('未使用自建服务器，高概率#rnq失败');
            }
            // 获取登录key
            const keyUrl = `${autoSelectNeteaseApi}/login/qr/key`;
            const keyResponse = await axios.get(keyUrl, { headers: { "User-Agent": COMMON_USER_AGENT } });
            const unikey = keyResponse.data.data.unikey;

            // 获取登录二维码
            const qrUrl = `${autoSelectNeteaseApi}/login/qr/create?key=${unikey}&qrimg=true`;
            const qrResponse = await axios.get(qrUrl, { headers: { "User-Agent": COMMON_USER_AGENT } });

            await mkdirIfNotExists(this.defaultPath);
            const saveCodePath = `${this.defaultPath}NeteaseQrcode.png`;
            await qrcode.toFile(saveCodePath, qrResponse.data.data.qrurl);
            e.reply([segment.image(saveCodePath), '请在40秒内使用网易云APP进行扫码']);

            // 轮询检查登录状态
            await this.pollLoginStatus(autoSelectNeteaseApi, unikey, e, isCloud);
        } catch (error) {
            if (error.code == 'ERR_INVALID_URL') {
                logger.error(`执行${cookieName}扫码登录时出错:非法地址，请检查API服务地址`, error);
                e.reply(`执行${cookieName}扫码登录时出错${error.code}请检查API服务器地址`);
            } else if (error.code == 'ECONNRESET') {
                logger.error(`执行${cookieName}扫码登录时出错:API请求错误，请检查API服务状态`, error);
                e.reply(`执行${cookieName}扫码登录时发生错误${error.code}请检查API服务状态`);
            } else {
                logger.error(`执行${cookieName}扫码登录时出错:`, error);
                e.reply(`执行${cookieName}扫码登录时发生错误，请稍后再试`);
            }
        }
    }

    // 网易云解析
    async netease(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.netease))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.netease} 已拦截`);
            return false;
        }
        let message =
            e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim();
        // 处理短号，此时会变成y.music.163.com
        if (message.includes("163cn.tv")) {
            message = /(http:|https:)\/\/163cn\.tv\/([a-zA-Z0-9]+)/.exec(message)?.[0];
            // logger.info(message)
            message = await axios.head(message).then((resp) => {
                return resp.request.res.responseUrl;
            });
        }
        // 处理网页链接
        const musicUrlReg = /(http:|https:)\/\/music.163.com\/song\/media\/outer\/url\?id=(\d+)/;
        const musicUrlReg2 = /(http:|https:)\/\/y.music.163.com\/m\/song\?(.*)&id=(\d+)/;
        const musicUrlReg3 = /(http:|https:)\/\/music.163.com\/m\/song\/(\d+)/;
        const programUrlReg = /program\?id=(\d+)/;
        const djUrlReg = /dj\?id=(\d+)/;
        const id = programUrlReg.exec(message)?.[1] ||
            djUrlReg.exec(message)?.[1] ||
            musicUrlReg2.exec(message)?.[3] ||
            musicUrlReg.exec(message)?.[2] ||
            musicUrlReg3.exec(message)?.[2] ||
            /(?<!user)id=(\d+)/.exec(message)?.[1];
        // 如果没有下载地址跳出if
        if (_.isEmpty(id)) {
            e.reply(`识别：网易云音乐，解析失败！`);
            logger.error("[R插件][网易云解析] 没有找到id，无法进行下一步！");
            return;
        }
        // 优先判断是否使用自建 API
        let autoSelectNeteaseApi;
        // 判断海外
        const isOversea = await this.isOverseasServer();
        if (this.useLocalNeteaseAPI) {
            // 使用自建 API
            autoSelectNeteaseApi = this.neteaseCloudAPIServer;
        } else {
            // 自动选择 API
            autoSelectNeteaseApi = isOversea ? NETEASE_SONG_DOWNLOAD : NETEASE_API_CN;
        }
        // 检测ck可用性
        const statusUrl = autoSelectNeteaseApi + '/login/status';
        const isCkExpired = await axios.get(statusUrl, {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
                "Cookie": this.neteaseCookie
            },
        }).then(res => {
            const userInfo = res.data.data.profile;
            if (userInfo) {
                logger.info('[R插件][netease]ck活着，使用ck进行高音质下载');
                return true;
            } else {
                logger.info('[R插件][netease]ck失效，将启用临时接口下载');
                return false;
            }
        });
        // mv截断
        if (/mv\?/.test(message)) {
            const AUTO_NETEASE_MV_DETAIL = autoSelectNeteaseApi + "/mv/detail?mvid={}";
            const AUTO_NETEASE_MV_URL = autoSelectNeteaseApi + "/mv/url?id={}";

            // logger.info(AUTO_NETEASE_MV_DETAIL.replace("{}", id));
            // logger.info(AUTO_NETEASE_MV_URL.replace("{}", id));
            const [mvDetailData, mvUrlData] = await Promise.all([
                axios.get(AUTO_NETEASE_MV_DETAIL.replace("{}", id), {
                    headers: {
                        "User-Agent": COMMON_USER_AGENT,
                        "Cookie": this.neteaseCookie
                    }
                }),
                axios.get(AUTO_NETEASE_MV_URL.replace("{}", id), {
                    headers: {
                        "User-Agent": COMMON_USER_AGENT,
                        "Cookie": this.neteaseCookie
                    }
                })
            ]);
            const { name: mvName, artistName: mvArtist, cover: mvCover } = mvDetailData.data?.data;
            e.reply([segment.image(mvCover), `${this.identifyPrefix}识别：网易云MV，${mvName} - ${mvArtist}`]);
            // logger.info(mvUrlData.data)
            const { url: mvUrl } = mvUrlData.data?.data;
            this.downloadVideo(mvUrl, false, null, this.videoDownloadConcurrency, 'netease_mv.mp4').then(videoPath => {
                this.sendVideoToUpload(e, videoPath);
            });
            return;
        }
        // 播客截断
        if (/\/program\?|\/dj\?/.test(message)) {
            const AUTO_NETEASE_PROGRAM_DETAIL = autoSelectNeteaseApi + "/dj/program/detail?id={}";
            const programDetail = await axios.get(AUTO_NETEASE_PROGRAM_DETAIL.replace("{}", id), {
                headers: {
                    "User-Agent": COMMON_USER_AGENT,
                    "Cookie": this.neteaseCookie
                }
            }).then(res => res.data.program);
            if (!programDetail) {
                e.reply(`识别：网易云播客，解析失败！`);
                logger.error("[R插件][网易云解析] 没有找到id，无法进行下一步！");
                return true;
            }
            const { mainSong, dj, coverUrl, name } = programDetail;
            const songId = mainSong.id;
            const AUTO_NETEASE_SONG_DOWNLOAD = autoSelectNeteaseApi + "/song/url/v1?id={}&level=" + this.neteaseCloudAudioQuality;
            const downloadUrl = AUTO_NETEASE_SONG_DOWNLOAD.replace("{}", songId);
            const resp = await axios.get(downloadUrl, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT,
                    "Cookie": this.neteaseCookie
                },
            });
            let url = resp.data.data?.[0]?.url || null;
            const title = `${dj.nickname} - ${name}`;
            const AudioSize = (resp.data.data?.[0]?.size / (1024 * 1024)).toFixed(2);
            const typelist = [programDetail.category, programDetail.secondCategory, '播客'];
            // 获取歌曲信息
            let musicInfo = {
                'cover': coverUrl,
                'songName': name,
                'singerName': dj.nickname,
                'size': AudioSize + " MB",
                'musicType': typelist
            };
            const data = await new NeteaseMusicInfo(e).getData(musicInfo);
            let img = await puppeteer.screenshot("neteaseMusicInfo", data);
            await e.reply(img);
            // 动态判断后缀名
            let musicExt = resp.data.data?.[0]?.type;
            // 下载音乐
            downloadAudio(url, this.getCurDownloadPath(e), title, 'follow', musicExt).then(async path => {
                // 发送群文件
                await this.uploadGroupFile(e, path);
                // 发送语音
                if (musicExt != 'mp4' && this.isSendVocal) {
                    await e.reply(segment.record(path));
                }
                // 删除文件
                await checkAndRemoveFile(path);
            }).catch(err => {
                logger.error(`下载音乐失败，错误信息为: ${err}`);
            });
            return true;
        }
        const songWikiUrl = autoSelectNeteaseApi + '/song/wiki/summary?id=' + id;
        // 国内解决方案，替换为国内API (其中，NETEASE_API_CN是国内基址)
        const AUTO_NETEASE_SONG_DOWNLOAD = autoSelectNeteaseApi + "/song/url/v1?id={}&level=" + this.neteaseCloudAudioQuality;
        const AUTO_NETEASE_SONG_DETAIL = autoSelectNeteaseApi + "/song/detail?ids={}";
        // logger.info(AUTO_NETEASE_SONG_DOWNLOAD.replace("{}", id));
        const downloadUrl = AUTO_NETEASE_SONG_DOWNLOAD.replace("{}", id);
        const detailUrl = AUTO_NETEASE_SONG_DETAIL.replace("{}", id);
        // 请求netease数据
        axios.get(downloadUrl, {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
                "Cookie": this.neteaseCookie
            },
        }).then(async resp => {
            // 国内解决方案，替换API后这里也需要修改

            // 英转中字典匹配
            const translationDict = {
                'standard': '标准',
                'higher': '较高',
                'exhigh': '极高',
                'lossless': '无损',
                'hires': 'Hi-Res',
                'jyeffect': '高清环绕声',
                'sky': '沉浸环绕声',
                'dolby': '杜比全景声',
                'jymaster': '超清母带'
            };

            // 英转中
            function translateToChinese(word) {
                return translationDict[word] || word;  // 如果找不到对应翻译，返回原词
            }

            // 字节转MB
            function bytesToMB(sizeInBytes) {
                const sizeInMB = sizeInBytes / (1024 * 1024);  // 1 MB = 1024 * 1024 bytes
                return sizeInMB.toFixed(2);  // 保留两位小数
            }

            let url = await resp.data.data?.[0]?.url || null;
            const AudioLevel = translateToChinese(resp.data.data?.[0]?.level);
            const AudioSize = bytesToMB(resp.data.data?.[0]?.size);
            // 获取歌曲信息
            let { songName, artistName } = await axios.get(detailUrl).then(res => {
                const song = res.data.songs[0];
                return {
                    songName: cleanFilename(song?.name),
                    artistName: cleanFilename(song?.ar?.[0].name)
                };
            });
            let title = artistName + '-' + songName;
            // 获取歌曲封面
            let coverUrl = await axios.get(detailUrl).then(res => {
                const song = res.data.songs[0];
                return song?.al?.picUrl;
            });
            let typelist = [];
            // 歌曲百科API
            await axios.get(songWikiUrl, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT,
                    // "Cookie": this.neteaseCookie
                },
            }).then(res => {
                const wikiData = res.data.data.blocks[1].creatives;
                try {
                    typelist.push(wikiData[0].resources[0]?.uiElement?.mainTitle?.title || "");
                    // 防止数据过深出错
                    const recTags = wikiData[1];
                    if (recTags?.resources[0]) {
                        for (let i = 0; i < Math.min(3, recTags.resources.length); i++) {
                            if (recTags.resources[i] && recTags.resources[i].uiElement && recTags.resources[i].uiElement.mainTitle.title) {
                                typelist.push(recTags.resources[i].uiElement.mainTitle.title);
                            }
                        }
                    } else {
                        if (recTags.uiElement.textLinks[0].text) typelist.push(recTags.uiElement.textLinks[0].text);
                    }
                    if (wikiData[2].uiElement.mainTitle.title == 'BPM') {
                        typelist.push('BPM ' + wikiData[2].uiElement.textLinks[0].text);
                    } else {
                        typelist.push(wikiData[2].uiElement.textLinks[0].text || '');
                    }
                } catch (error) {
                    logger.error('获取标签报错：', error);
                }
                typelist.push(AudioLevel);
            });
            let musicInfo = {
                'cover': coverUrl,
                'songName': songName,
                'singerName': artistName,
                'size': AudioSize + " MB",
                'musicType': typelist
            };
            // 一般这个情况是VIP歌曲 (如果没有url或者是国内,公用接口暂时不可用，必须自建并且ck可用状态才能进行高质量解析)
            if (!isCkExpired || url == null) {
                url = await this.musicTempApi(e, title, "网易云音乐", musicInfo);
            } else {
                // 拥有ck，并且有效，直接进行解析
                let audioInfo = AudioLevel;
                if (AudioLevel == '杜比全景声') {
                    audioInfo += '\n(杜比下载文件为MP4，编码格式为AC-4，需要设备支持才可播放)';
                }
                const data = await new NeteaseMusicInfo(e).getData(musicInfo);
                let img = await puppeteer.screenshot("neteaseMusicInfo", data);
                await e.reply(img);
                // e.reply([segment.image(coverUrl), `${this.identifyPrefix}识别：网易云音乐，${title}\n当前下载音质: ${audioInfo}\n预估大小: ${AudioSize}MB`]);
            }
            // 动态判断后缀名
            let musicExt = resp.data.data?.[0]?.type;
            // 下载音乐
            downloadAudio(url, this.getCurDownloadPath(e), title, 'follow', musicExt).then(async path => {
                // 发送群文件
                await this.uploadGroupFile(e, path);
                // 发送语音
                if (musicExt != 'mp4' && this.isSendVocal) {
                    await e.reply(segment.record(path));
                }
                // 删除文件
                await checkAndRemoveFile(path);
            }).catch(err => {
                logger.error(`下载音乐失败，错误信息为: ${err}`);
            });
        });
        return true;
    }

    // 临时接口
    async musicTempApi(e, title, musicType, musicInfo = {}) {
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
        // const messageTitle = title + "\nR插件检测到当前为VIP音乐，正在转换...";
        // ??后的内容是适配`QQ_MUSIC_TEMP_API`、最后是汽水
        const url = vipMusicData.data?.music_url ?? vipMusicData.data?.data?.music_url ?? vipMusicData.data?.music;
        const cover = vipMusicData.data?.cover ?? vipMusicData.data?.data?.cover ?? vipMusicData.data?.cover;
        const name = vipMusicData.data?.title ?? vipMusicData.data?.data?.song_name ?? vipMusicData.data?.title;
        const singer = vipMusicData.data?.singer ?? vipMusicData.data?.data?.song_singer ?? vipMusicData.data?.singer;
        const id = vipMusicData.data?.id ?? vipMusicData.data?.data?.quality ?? vipMusicData.data?.pay;
        if (musicType === "网易云音乐") {
            musicInfo.size = id;
            musicInfo.musicType = musicInfo.musicType.slice(0, -1);
            const data = await new NeteaseMusicInfo(e).getData(musicInfo);
            let img = await puppeteer.screenshot("neteaseMusicInfo", data);
            await e.reply(img);
        } else {
            musicInfo = {
                'cover': cover,
                'songName': name,
                'singerName': singer,
                'size': id,
                'musicType': ""
            };
            const data = await new NeteaseMusicInfo(e).getData(musicInfo);
            let img = await puppeteer.screenshot("neteaseMusicInfo", data);
            await e.reply(img);
        }
        // await e.reply([segment.image(cover), `${this.identifyPrefix}识别：${musicType}，${messageTitle}`]);
        return url;
    }

    // 微博解析
    async weibo(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.weibo))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.weibo} 已拦截`);
            return false;
        }
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

        // 检测是否填写微博Cookie
        if (_.isEmpty(this.weiboCookie)) {
            e.reply(`检测到没有填写微博Cookie，无法解析微博${HELP_DOC}`);
            return;
        }

        axios.get(WEIBO_SINGLE_INFO.replace("{}", id), {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.9",
                "cookie": this.weiboCookie,
                "Referer": `https://m.weibo.cn/detail/${id}`,
            }
        })
            .then(async resp => {
                const wbData = resp.data.data;
                const { text, status_title, source, region_name, pics, page_info } = wbData;
                e.reply(`${this.identifyPrefix}识别：微博，${text.replace(/<[^>]+>/g, '')}\n${status_title}\n${source}\t${region_name ?? ''}`);
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


                    // 大于判定数量则回复合并的消息
                    if (images.length > this.globalImageLimit) {
                        await replyWithRetry(e, Bot, await Bot.makeForwardMsg(images));
                    } else {
                        await e.reply(images.map(item => item.message));
                    }

                    // 并行删除文件
                    await Promise.all(images.map(({ filePath }) => checkAndRemoveFile(filePath)));
                }
                if (page_info) {
                    // 视频
                    const videoUrl = page_info.urls?.mp4_720p_mp4 || page_info.urls?.mp4_hd_mp4;
                    // 文章
                    if (!videoUrl) return true;
                    try {
                        // wb 视频只能强制使用 1，由群友@非酋提出
                        this.downloadVideo(videoUrl, false, {
                            "User-Agent": COMMON_USER_AGENT,
                            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.9",
                            "referer": "https://weibo.com/",
                        }, 1, 'weibo.mp4').then(path => {
                            this.sendVideoToUpload(e, path);
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
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.general))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.general} 已拦截`);
            return false;
        }
        try {
            const adapter = await GeneralLinkAdapter.create(e.msg);
            logger.debug(`[R插件][General Adapter Debug] Adapter object: ${JSON.stringify(adapter, null, 2)}`);

            // 特殊处理皮皮虾 - 显示封面和标题
            if (adapter.name === "皮皮虾" && adapter.videoInfo) {
                const messagesToSend = [];
                // 1. 封面图
                if (adapter.cover) {
                    messagesToSend.push(segment.image(adapter.cover));
                }
                // 2. 文字信息
                const textMessages = [];
                textMessages.push(`${this.identifyPrefix}识别：皮皮虾`);
                textMessages.push(`👤作者：${adapter.author || '未知'}`);
                if (adapter.desc) {
                    textMessages.push(`📝标题：${adapter.desc}`);
                }
                const videoInfo = adapter.videoInfo;
                if (videoInfo.stats) {
                    const stats = videoInfo.stats;
                    const statsText = `👍${stats.likes || 0} 💬${stats.comments || 0} 🔄${stats.shares || 0} 👁️${stats.views || 0}`;
                    textMessages.push(`📊数据：${statsText}`);
                }
                messagesToSend.push(textMessages.join('\n'));

                // 发送封面和信息
                await e.reply(messagesToSend.flat());

                // 3. 发送视频
                if (adapter.video && adapter.video !== '') {
                    const url = adapter.video;
                    this.downloadVideo(url, false, null, this.videoDownloadConcurrency, 'pipixia.mp4').then(videoPath => {
                        logger.debug(`[R插件][General Adapter Debug] Video downloaded to path: ${videoPath}`);
                        this.sendVideoToUpload(e, videoPath);
                    });
                }

                // 4. 发送评论（如果有）
                logger.info(`[R插件][皮皮虾] 收到评论数据: ${adapter.comments?.length || 0} 条`);
                if (adapter.comments && adapter.comments.length > 0) {
                    const MAX_COMMENT_COUNT = 50;
                    const commentForwardMsgs = adapter.comments.slice(0, MAX_COMMENT_COUNT).map(comment => {
                        const userName = comment.user?.name || '匿名用户';
                        const content = comment.content || '';
                        const likeCount = comment.likeCount || 0;
                        const replyCount = comment.replyCount || 0;

                        // 格式化时间
                        const createTime = comment.createTime ? new Date(comment.createTime * 1000).toLocaleString('zh-CN') : '';

                        // 格式：评论内容 -> 时间+互动（用户名已在nickname中显示）
                        let msgText = content;

                        // 底部添加时间和互动数据
                        const footer = [];
                        if (createTime) footer.push(createTime);
                        if (likeCount > 0 || replyCount > 0) {
                            footer.push(`👍 ${likeCount} 💬 ${replyCount}`);
                        }
                        if (footer.length > 0) {
                            msgText += `\n\n${footer.join(' ')}`;
                        }

                        return {
                            message: { type: 'text', text: msgText },
                            nickname: userName,
                            user_id: comment.user?.id || e.user_id
                        };
                    });

                    if (commentForwardMsgs.length > 0) {
                        await replyWithRetry(e, Bot, await Bot.makeForwardMsg(commentForwardMsgs));
                    }
                }

                return true;
            }

            // 通用处理逻辑（非皮皮虾）
            e.reply(`${this.identifyPrefix}识别：${adapter.name}${adapter.desc ? `, ${adapter.desc}` : ''}`);
            logger.debug(adapter);
            logger.debug(`[R插件][General Adapter Debug] adapter.images: ${JSON.stringify(adapter.images)}`);
            logger.debug(`[R插件][General Adapter Debug] adapter.video: ${adapter.video}`);
            if (adapter.video && adapter.video !== '') {
                logger.debug(`[R插件][General Adapter Debug] Entering video sending logic for ${adapter.name}. Video URL: ${adapter.video}`);
                // 视频：https://www.kuaishou.com/short-video/3xhjgcmir24m4nm
                const url = adapter.video;
                this.downloadVideo(url, false, null, this.videoDownloadConcurrency, 'kuaishou.mp4').then(videoPath => {
                    logger.debug(`[R插件][General Adapter Debug] Video downloaded to path: ${videoPath}`);
                    this.sendVideoToUpload(e, videoPath);
                });
            } else if (adapter.images && adapter.images.length > 0) {
                logger.debug(`[R插件][General Adapter Debug] Entering image sending logic for ${adapter.name}`);
                logger.info(`[R插件][图片下载] 开始并发下载 ${adapter.images.length} 张图片...`);

                const messageSegments = [];
                const downloadedFilePaths = [];
                const downloadPath = this.getCurDownloadPath(e);
                await mkdirIfNotExists(downloadPath);

                // 并发下载所有图片
                const downloadPromises = adapter.images.map(async (imageUrl, index) => {
                    try {
                        const fileName = `kuaishou_img_${index}.jpg`;
                        const filePath = `${downloadPath}/${fileName}`;

                        const response = await axios({
                            method: 'get',
                            url: imageUrl,
                            responseType: 'stream'
                        });
                        const writer = fs.createWriteStream(filePath);
                        response.data.pipe(writer);
                        await new Promise((resolve, reject) => {
                            writer.on('finish', resolve);
                            writer.on('error', reject);
                        });

                        return {
                            filePath,
                            segment: {
                                message: segment.image(filePath),
                                nickname: this.e.sender.card || this.e.user_id,
                                user_id: this.e.user_id,
                            }
                        };
                    } catch (error) {
                        logger.error(`[R插件][图片下载] 图片${index}下载失败: ${error.message}`);
                        return null;
                    }
                });

                const results = await Promise.all(downloadPromises);
                const successResults = results.filter(r => r !== null);

                successResults.forEach(r => {
                    messageSegments.push(r.segment);
                    downloadedFilePaths.push(r.filePath);
                });

                logger.info(`[R插件][图片下载] 下载完成: ${downloadedFilePaths.length}/${adapter.images.length} 张`);

                // 发送合并转发
                if (messageSegments.length > 0) {
                    const forwardMsg = await Bot.makeForwardMsg(messageSegments);
                    await replyWithRetry(e, Bot, forwardMsg);

                    // 删除临时文件（静默删除）
                    await Promise.all(downloadedFilePaths.map(fp => checkAndRemoveFile(fp)));
                    logger.info(`[R插件][图片下载] 已清理临时文件`);
                }
            } else {
                logger.debug(`[R插件][General Adapter Debug] No images or video found for ${adapter.name}. Replying with failure message.`);
                e.reply("解析失败：无法获取到资源");
            }
        } catch (err) {
            logger.error("解析失败 ", err);
            return true;
        }
        return true;
    }

    // 油管解析
    async sy2b(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.sy2b))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.sy2b} 已拦截`);
            return false;
        }
        const timeRange = ytbFormatTime(this.youtubeClipTime);
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
            let url = removeParams(urlRex.exec(e.msg)?.[0] || url2Rex.exec(e.msg)?.[0]).replace(/&/g, isWindows ? '^&' : '&');
            //非最高画质，就按照设定的来
            let graphics = "";
            if (this.youtubeGraphicsOptions != 0) {
                graphics = `[height<=${this.youtubeGraphicsOptions}]`;
            }

            const path = this.getCurDownloadPath(e);
            const rawTitle = (await ytDlpGetTilt(url, isOversea, this.myProxy, this.youtubeCookiePath)).toString().replace(/\n/g, '');

            // 使用固定文件名
            const videoFilename = 'youtube.mp4';
            const audioFilename = 'youtube.flac';

            // 获取缩略图URL（不下载到本地）
            const thumbnailUrl = await ytDlpGetThumbnailUrl(url, isOversea, this.myProxy, this.youtubeCookiePath);

            // 清理可能存在的旧文件
            await checkAndRemoveFile(`${path}/${videoFilename}`);
            await checkAndRemoveFile(`${path}/${audioFilename}`);

            // 音频逻辑
            if (url.includes("music")) {
                await replyWithRetry(e, Bot, [
                    segment.image(thumbnailUrl),
                    `${this.identifyPrefix}识别：油管音乐\n视频标题：${rawTitle}`
                ]);
                await ytDlpHelper(path, url, isOversea, this.myProxy, this.videoDownloadConcurrency, 'youtube', true, graphics, timeRange, this.youtubeCookiePath);
                const fullAudioPath = `${path}/${audioFilename}`;
                if (this.isSendVocal) {
                    await e.reply(segment.record(fullAudioPath));
                }
                await this.uploadGroupFile(e, fullAudioPath);
                return;
            }

            // 下面为视频逻辑
            const Duration = convertToSeconds((await ytDlpGetDuration(url, isOversea, this.myProxy, this.youtubeCookiePath)).toString().replace(/\n/g, ''));

            if (Duration > this.youtubeDuration) {
                // 超时限制
                await replyWithRetry(e, Bot, [
                    segment.image(thumbnailUrl),
                    `${this.identifyPrefix}识别：油管，视频时长超限 \n视频标题：${rawTitle}\n⌚${DIVIDING_LINE.replace('{}', '限制说明').replace(/\n/g, '')}⌚\n视频时长：${(Duration / 60).toFixed(2).replace(/\.00$/, '')} 分钟\n大于管理员限定解析时长：${(this.youtubeDuration / 60).toFixed(2).replace(/\.00$/, '')} 分钟`
                ]);
            } else if (Duration > this.youtubeClipTime && timeRange != '00:00:00-00:00:00') {
                // 截取模式
                await replyWithRetry(e, Bot, [
                    segment.image(thumbnailUrl),
                    `${this.identifyPrefix}识别：油管，视频截取中请耐心等待 \n视频标题：${rawTitle}\n✂️${DIVIDING_LINE.replace('{}', '截取说明').replace(/\n/g, '')}✂️\n视频时长：${(Duration / 60).toFixed(2).replace(/\.00$/, '')} 分钟\n大于管理员限定截取时长：${(this.youtubeClipTime / 60).toFixed(2).replace(/\.00$/, '')} 分钟\n将截取视频片段`
                ]);
                await ytDlpHelper(path, url, isOversea, this.myProxy, this.videoDownloadConcurrency, 'youtube', true, graphics, timeRange, this.youtubeCookiePath);
                await this.sendVideoToUpload(e, `${path}/${videoFilename}`);
            } else {
                // 正常下载
                await replyWithRetry(e, Bot, [
                    segment.image(thumbnailUrl),
                    `${this.identifyPrefix}识别：油管，视频下载中请耐心等待 \n视频标题：${rawTitle}\n视频时长：${(Duration / 60).toFixed(2).replace(/\.00$/, '')} 分钟`
                ]);
                await ytDlpHelper(path, url, isOversea, this.myProxy, this.videoDownloadConcurrency, 'youtube', true, graphics, timeRange, this.youtubeCookiePath);
                await this.sendVideoToUpload(e, `${path}/${videoFilename}`);
            }
        } catch (error) {
            logger.error(error);
            throw error; // Rethrow the error so it can be handled by the caller
        }
        return true;
    }

    // 米游社
    async miyoushe(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.miyoushe))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.miyoushe} 已拦截`);
            return false;
        }
        let url = e.msg === undefined ? e.message.shift().data.replaceAll("\\", "") : e.msg.trim();
        let msg = /(?:https?:\/\/)?(m|www)\.miyoushe\.com\/[A-Za-z\d._?%&+\-=\/#]*/.exec(url)?.[0];
        const id = /\/(\d+)$/.exec(msg)?.[0].replace("\/", "");

        fetch(MIYOUSHE_ARTICLE.replace("{}", id), {
            headers: {
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-cn",
                "Connection": "keep-alive",
                "x-rpc-app_version": "2.87.0",
                "x-rpc-client_type": "4",
                "Referer": "https://www.miyoushe.com/",
                "DS": getDS(),
            }
        }).then(async resp => {
            const respJson = await resp.json();
            // debug专用
            // fs.writeFile('data.json', JSON.stringify(respJson), (err) => {
            //     if (err) {
            //         logger.error('Error writing file:', err);
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
            const normalMsg = `${this.identifyPrefix}识别：米游社，${subject}\n${realContent?.describe || ""}`;
            const replyMsg = cover ? [segment.image(cover), normalMsg] : normalMsg;
            e.reply(replyMsg);
            // 图片
            if (images) {
                if (images.length > this.globalImageLimit) {
                    const replyImages = images.map(item => {
                        return {
                            message: segment.image(item),
                            nickname: this.e.sender.card || this.e.user_id,
                            user_id: this.e.user_id,
                        };
                    });
                    await replyWithRetry(e, Bot, Bot.makeForwardMsg(replyImages));
                } else {
                    const imageSegments = images.map(item => segment.image(item));
                    e.reply(imageSegments);
                }
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
                        this.downloadVideo(videoUrl, false, null, this.videoDownloadConcurrency, 'miyoushe.mp4').then(videoPath => {
                            this.sendVideoToUpload(e, videoPath);
                        });
                        break;
                    }
                }
            }
        });
    }

    // 微视
    async weishi(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.weishi))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.weishi} 已拦截`);
            return false;
        }
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
                logger.error("[R插件][微视] 无法检测到ID，逻辑大概问题在正则表达式");
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

            await replyWithRetry(e, Bot, [segment.image(cover), `${this.identifyPrefix}识别：微视，${title}`]);

            this.downloadVideo(noWatermarkDownloadUrl, false, null, this.videoDownloadConcurrency, 'weishi.mp4').then(videoPath => {
                this.sendVideoToUpload(e, videoPath);
            });
        } catch (err) {
            logger.error(err);
            return true;
        }
        return true;
    }

    async zuiyou(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.zuiyou))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.zuiyou} 已拦截`);
            return false;
        }
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
            const videoTitleRegex = /:<\/span><h1>(.*?)<\/h1><\/div><div=/;
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

            const images = imgSrcs.filter(item => item.includes("\/img\/view\/id"));

            // Construct the response object
            const shortVideoInfo = {
                authorName: videoAuthorMatch ? videoAuthorMatch[1] : '',
                title: videoTitleMatch ? videoTitleMatch[1] : '',
                cover: videoCoverMatch ? videoCoverMatch[1] : '' || images[0],
                noWatermarkDownloadUrl: videoUrlMatch ? videoUrlMatch[1] : '',
                images,
            };

            e.reply(`${this.identifyPrefix}识别：最右，${shortVideoInfo.authorName}\n${shortVideoInfo.title}`);

            if (shortVideoInfo.images.length > 0) {
                const replyImages = shortVideoInfo.images.map(item => {
                    return {
                        message: segment.image(item),
                        nickname: this.e.sender.card || this.e.user_id,
                        user_id: this.e.user_id,
                    };
                });
                await replyWithRetry(e, Bot, Bot.makeForwardMsg(replyImages));
            }
            if (shortVideoInfo.noWatermarkDownloadUrl) {
                this.downloadVideo(shortVideoInfo.noWatermarkDownloadUrl, false, null, this.videoDownloadConcurrency, 'zuiyou.mp4').then(videoPath => {
                    this.sendVideoToUpload(e, videoPath);
                });
            }
        } catch (error) {
            logger.error(error);
            throw error; // Rethrow the error so it can be handled by the caller
        }
    }

    async freyr(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.freyr))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.freyr} 已拦截`);
            return false;
        }
        // https://music.apple.com/cn/album/hectopascal-from-yagate-kimi-ni-naru-piano-arrangement/1468323115?i=1468323724
        // 过滤参数
        const message = e.msg.replace("&ls", "");
        // 匹配名字
        const freyrName = message.includes("spotify") ? "Spotify" : "Apple Music";
        // 找到R插件保存目录
        const currentWorkingDirectory = path.resolve(this.getCurDownloadPath(e));
        // 如果没有文件夹就创建一个
        await mkdirIfNotExists(currentWorkingDirectory + "/am");
        // 检测是否存在框架
        const isExistFreyr = await checkToolInCurEnv("freyr");
        if (!isExistFreyr) {
            e.reply(`检测到没有${freyrName}需要的环境，无法解析！${HELP_DOC}`);
            return;
        }
        // 执行命令
        const result = await execSync(`freyr -d ${currentWorkingDirectory + "/am/"} get ${message}`);
        logger.info(result.toString());
        // 获取信息
        let { title, album, artist } = await this.parseFreyrLog(result.toString());
        // 兜底策略
        if (freyrName === "Apple Music" && (title === "N/A" || album === "N/A" || artist === "N/A")) {
            const data = await axios.get(`https://api.fabdl.com/apple-music/get?url=${message}`, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT,
                    "Referer": "https://apple-music-downloader.com/",
                    "Origin": "https://apple-music-downloader.com",
                    "Accept": "application/json, text/plain, */*",
                },
            });
            const { name, artists } = data.data.result;
            title = name;
            artist = artists;
        }
        // 判断是否是海外服务器
        const isOversea = await this.isOverseasServer();
        // 国内服务器解决方案
        if (!isOversea) {
            // 临时接口
            const url = await this.musicTempApi(e, `${title} ${artist}`, freyrName);
            // 下载音乐
            downloadAudio(url, this.getCurDownloadPath(e), title, 'follow').then(async path => {
                // 发送语音
                if (this.isSendVocal) {
                    await e.reply(segment.record(path));
                }
                // 判断是不是icqq
                await this.uploadGroupFile(e, path);
                await checkAndRemoveFile(path);
            }).catch(err => {
                logger.error(`下载音乐失败，错误信息为: ${err.message}`);
            });
        } else {
            // freyr 逻辑
            e.reply(`${this.identifyPrefix}识别：${freyrName}，${title}--${artist}`);
            // 检查目录是否存在
            const musicPath = currentWorkingDirectory + "/am/" + artist + "/" + album;
            // 找到音频文件
            const mediaFiles = await getMediaFilesAndOthers(musicPath);
            for (let other of mediaFiles.others) {
                await this.uploadGroupFile(e, `${musicPath}/${other}`);
            }
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
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.linkShareSummary))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.linkShareSummary} 已拦截`);
            return false;
        }

        let name, summaryLink;

        if (e.msg.startsWith("#总结一下")) {
            name = "网页总结";
            summaryLink = e.msg.replace("#总结一下", "");
        } else {
            ({ name, summaryLink } = contentEstimator(e.msg));
        }

        // 判断是否有总结的条件
        if (_.isEmpty(this.aiApiKey)) {
            // e.reply(`没有配置 Kimi，无法为您总结！${ HELP_DOC }`)
            await this.tempSummary(name, summaryLink, e);
            return false;
        }

        const builder = await new OpenaiBuilder()
            .setBaseURL(this.aiBaseURL)
            .setApiKey(this.aiApiKey)
            .setModel(this.aiModel)
            .setPrompt(SUMMARY_PROMPT);

        if (this.aiModel.includes('deepseek')) {
            builder.setProvider('deepseek');
        }

        await builder.build();

        e.reply(`${this.identifyPrefix}识别：${name}，正在为您总结，请稍等...`, true);

        let messages = [{ role: "user", content: summaryLink }];

        // 兜底策略：检测模型是否支持 tool_calls
        if (!this.aiModel.includes("kimi") && !this.aiModel.includes("moonshot")) {
            // 不支持 tool_calls 的模型，直接爬取内容并总结
            try {
                // 直接使用llmRead爬取链接内容
                const crawled_content = await llmRead(summaryLink);
                // 重新构造消息，将爬取到的内容直接放入对话历史
                messages = [
                    { role: "user", content: `这是网页链接: ${summaryLink}` },
                    { role: "assistant", content: `好的，我已经爬取了网页内容，内容如下：\n${crawled_content}` },
                    { role: "user", content: "请根据以上内容进行总结。" }
                ];

                // 调用kimi进行总结，此时不传递任何工具
                const response = await builder.chat(messages); // 不传递 CRAWL_TOOL
                const { ans: kimiAns, model } = response;
                // 估算阅读时间并提取标题
                const stats = estimateReadingTime(kimiAns);
                const titleMatch = kimiAns.match(/(Title|标题)([:：])\s*(.*)/)?.[3];
                e.reply(`《${titleMatch || '未知标题'}》 预计阅读时间: ${stats.minutes} 分钟，总字数: ${stats.words}`);
                // 将总结内容格式化为合并转发消息
                const Msg = await Bot.makeForwardMsg(textArrayToMakeForward(e, [`「R插件 x ${model}」联合为您总结内容：`, kimiAns]));
                await replyWithRetry(e, Bot, Msg);
            } catch (error) {
                e.reply(`总结失败: ${error.message}`);
            }
            return false;
        }

        // 为了防止无限循环，设置一个最大循环次数
        for (let i = 0; i < 5; i++) {
            const response = await builder.chat(messages, [CRAWL_TOOL]);

            // 如果Kimi返回了工具调用
            if (response.tool_calls) {
                const tool_calls = response.tool_calls;
                messages.push({
                    role: 'assistant',
                    content: null,
                    tool_calls: tool_calls,
                });

                // 遍历并处理每一个工具调用
                for (const tool_call of tool_calls) {
                    if (tool_call.function.name === 'crawl') {
                        try {
                            const args = JSON.parse(tool_call.function.arguments);
                            const urlToCrawl = args.url;
                            // 执行爬取操作
                            const crawled_content = await llmRead(urlToCrawl);
                            messages.push({
                                role: 'tool',
                                tool_call_id: tool_call.id,
                                name: 'crawl',
                                content: crawled_content,
                            });
                        } catch (error) {
                            messages.push({
                                role: 'tool',
                                tool_call_id: tool_call.id,
                                name: 'crawl',
                                content: `爬取错误: ${error.message}`,
                            });
                        }
                    }
                }
            } else {
                // 如果没有工具调用，说明得到了最终的总结
                const { ans: kimiAns, model } = response;
                // 计算阅读时间
                const stats = estimateReadingTime(kimiAns);
                const titleMatch = kimiAns.match(/(Title|标题)([:：])\s*(.*?)\n/)?.[3];
                e.reply(`《${titleMatch || '未知标题'}》 预计阅读时间: ${stats.minutes} 分钟，总字数: ${stats.words}`);
                const Msg = await Bot.makeForwardMsg(textArrayToMakeForward(e, [`「R插件 x ${model}」联合为您总结内容：`, kimiAns]));
                await replyWithRetry(e, Bot, Msg);
                return false;
            }
        }
        e.reply("处理超出限制，请重试");
        return false;
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
        e.reply(`${this.identifyPrefix}识别：${name} - ${titleMatch}，正在为您总结，请稍等...`, true);
        const summary = await deepSeekChat(content, SUMMARY_PROMPT);
        const Msg = await Bot.makeForwardMsg(textArrayToMakeForward(e, [`「R插件 x DeepSeek」联合为您总结内容：`, summary]));
        await replyWithRetry(e, Bot, Msg);
    }

    // q q m u s i c 解析
    async qqMusic(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.qqMusic))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.qqMusic} 已拦截`);
            return false;
        }
        // case1:　Taylor Swift/Bleachers《Anti-Hero (Feat. Bleachers) (Explicit)》 https://c6.y.qq.com/base/fcgi-bin/u?__=lg19lFgQerbo @QQ音乐
        /** case 2:
         * {"app":"com.tencent.structmsg","config":{"ctime":1722497864,"forward":1,"token":"987908ab4a1c566d3645ef0ca52a162a","type":"normal"},"extra":{"app_type":1,"appid":100497308,"uin":542716863},"meta":{"news":{"action":"","android_pkg_name":"","app_type":1,"appid":100497308,"ctime":1722497864,"desc":"Taylor Swift/Bleachers","jumpUrl":"https://i.y.qq.com/v8/playsong.html?hosteuin=7KvA7i6sNeCi&sharefrom=gedan&from_id=1674373010&from_idtype=10014&from_name=(7rpl)&songid=382775503&songmid=&type=0&platform=1&appsongtype=1&_wv=1&source=qq&appshare=iphone&media_mid=000dKYJS3KCzpu&ADTAG=qfshare","preview":"https://pic.ugcimg.cn/1070bf5a6962b75263eee1404953c9b2/jpg1","source_icon":"https://p.qpic.cn/qqconnect/0/app_100497308_1626060999/100?max-age=2592000&t=0","source_url":"","tag":"QQ音乐","title":"Anti-Hero (Feat. Bleachers) (E…","uin":542716863}},"prompt":"[分享]Anti-Hero (Feat. Bleachers) (E…","ver":"0.0.0.1","view":"news"}
         */
        let musicInfo;
        // applet判定
        if (e.msg.includes(`"app":"com.tencent.music.lua"`) || e.msg.includes(`"app":"com.tencent.structmsg"`)) {
            logger.info("[R插件][qqMusic] 识别为小程序分享");
            const musicInfoJson = JSON.parse(e.msg);
            // 歌手和歌名
            const prompt = musicInfoJson.meta?.news?.title ?? musicInfoJson.meta?.music?.title;
            const desc = musicInfoJson.meta?.news?.desc ?? musicInfoJson.meta?.music?.desc;
            // 必要性拼接
            musicInfo = prompt + "-" + desc;
            // 空判定
            if (musicInfo.trim() === "-" || prompt === undefined || desc === undefined) {
                logger.info(`没有识别到QQ音乐小程序，帮助文档如下：${HELP_DOC}`);
                return true;
            }
        } else {
            // 连接判定
            const normalRegex = /^(.*?)\s*https?:\/\//;
            musicInfo = normalRegex.exec(e.msg)?.[1].trim();
        }
        // 删除特殊字符
        musicInfo = cleanFilename(musicInfo);
        // 判断音乐信息是否存在
        if (!musicInfo) {
            console.log('[R插件][qqMusic]: 暂不支持此类链接');
            return true;
        }
        logger.info(`[R插件][qqMusic] 识别音乐为：${musicInfo}`);
        // 使用临时接口下载
        const url = await this.musicTempApi(e, musicInfo, "QQ音乐");
        // 下载音乐
        await downloadAudio(url, this.getCurDownloadPath(e), musicInfo, 'follow').then(async path => {
            // 发送语音
            if (this.isSendVocal) {
                await e.reply(segment.record(path));
            }
            // 判断是不是icqq
            await this.uploadGroupFile(e, path);
            await checkAndRemoveFile(path);
        }).catch(err => {
            logger.error(`下载音乐失败，错误信息为: ${err.message}`);
        });
        return true;
    }

    // 汽水音乐
    async qishuiMusic(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.qishuiMusic))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.qishuiMusic} 已拦截`);
            return false;
        }
        const normalRegex = /^(.*?)\s*https?:\/\//;
        const musicInfo = normalRegex.exec(e.msg)?.[1].trim().replace("@汽水音乐", "");
        logger.info(`[R插件][qishuiMusic] 识别音乐为：${musicInfo}`);
        // 使用临时接口下载
        const url = await this.musicTempApi(e, musicInfo, "汽水音乐");
        // 下载音乐
        await downloadAudio(url, this.getCurDownloadPath(e), musicInfo, 'follow').then(async path => {
            // 发送语音
            if (this.isSendVocal) {
                await e.reply(segment.record(path));
            }
            // 判断是不是icqq
            await this.uploadGroupFile(e, path);
            await checkAndRemoveFile(path);
        }).catch(err => {
            logger.error(`下载音乐失败，错误信息为: ${err.message}`);
        });
        return true;
    }

    // 小飞机下载
    async aircraft(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.aircraft))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.aircraft} 已拦截`);
            return false;
        }
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
            e.reply(`未检测到必要的环境，无法解析小飞机${HELP_DOC}`);
            return;
        }
        const url = urlRex.exec(e.msg)[0];
        if (e.msg.startsWith("保存")) {
            // 发送文件到 SaveMessages
            await saveTDL(url, isOversea, this.myProxy);
            e.reply("文件已保存到 Save Messages！");
            return true;
        }
        e.reply(`${this.identifyPrefix}识别：小飞机（学习版）`);
        const tgSavePath = `${this.getCurDownloadPath(e)}/tg`;
        // 如果没有文件夹则创建
        await mkdirIfNotExists(tgSavePath);
        // 删除之前的文件
        await deleteFolderRecursive(tgSavePath);
        await startTDL(url, tgSavePath, isOversea, this.myProxy, this.videoDownloadConcurrency);
        // 过滤当前文件
        const mediaFiles = await getMediaFilesAndOthers(tgSavePath);
        if (mediaFiles.images.length > 0) {
            const imagesData = mediaFiles.images.map(item => {
                const fileContent = fs.readFileSync(`${tgSavePath}/${item}`);
                return {
                    message: segment.image(fileContent),
                    nickname: e.sender.card || e.user_id,
                    user_id: e.user_id,
                };
            });
            await replyWithRetry(e, Bot, await Bot.makeForwardMsg(imagesData), true, { recallMsg: MESSAGE_RECALL_TIME });
        } else if (mediaFiles.videos.length > 0) {
            for (const item of mediaFiles.videos) {
                await this.sendVideoToUpload(e, `${tgSavePath}/${item}`);
            }
        } else {
            for (let other of mediaFiles.others) {
                await this.uploadGroupFile(e, `${tgSavePath}/${other}`);
            }
        }
        return true;
    }

    // 贴吧
    async tieba(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.tieba))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.tieba} 已拦截`);
            return false;
        }
        // 提取链接和ID
        const msg = /https:\/\/tieba\.baidu\.com\/p\/[A-Za-z0-9]+/.exec(e.msg)?.[0];
        const id = /\/p\/([A-Za-z0-9]+)/.exec(msg)?.[1];
        // 获取帖子详情
        const hibi = HIBI_API_SERVICE + `/tieba/post_detail?tid=${id}`;
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
        let sendContent = `${this.identifyPrefix}识别：贴吧，${title}`;
        let extractImages = [];
        // 如果内容中有图片、文本或视频，它会将它们添加到 sendContent 消息中
        if (content && content.length > 0) {
            sendContent = [sendContent];
            for (const { cdn_src, text, link } of content) {
                logger.info({ cdn_src, text, link }); // 可以一次性输出多个属性

                // 处理图片
                if (cdn_src) extractImages.push(segment.image(cdn_src));

                // 处理文本
                if (text) sendContent.push(`\n\n📝 简介：${text}`);

                // 处理视频
                if (link) {
                    const filePath = await this.downloadVideo(link, false, null, this.videoDownloadConcurrency, 'bili_dynamic.mp4');
                    this.sendVideoToUpload(e, filePath);
                }
            }
        }
        e.reply(sendContent, true);
        if (extractImages && extractImages.length > 0) {
            const imageMessages = extractImages.map(item => ({
                message: item,
                nickname: e.sender.card || e.user_id,
                user_id: e.user_id,
            }));
            const result = await e.reply(Bot.makeForwardMsg(imageMessages));

            // 检测发送失败，尝试重试
            if (!result || !result.message_id) {
                // 提取远程URL
                const imageUrls = extractImages.map(img => {
                    // extractImages中每项是segment.image(cdn_src)的结果
                    // segment.image返回的是{type: 'image', data: {file: url}}
                    return img.data.file;
                });
                await retryImageSend(e, Bot, imageUrls, './data/rcmp4/', (paths) => {
                    return paths.map(p => ({
                        message: segment.image(p),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    }));
                }, segment);
            }
        }
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

    // 小黑盒
    async xiaoheihe(e) {
        // 切面判断是否需要解析
        if (!(await this.isEnableResolve(RESOLVE_CONTROLLER_NAME_ENUM.xiaoheihe))) {
            logger.info(`[R插件][全局解析控制] ${RESOLVE_CONTROLLER_NAME_ENUM.xiaoheihe} 已拦截`);
            return false;
        }

        const msg = e.msg;
        let type = '';
        let id = '';
        // 提取 id
        if (msg.includes('bbs')) {
            type = 'bbs';
            const bbsMatch = msg.match(/bbs\/link\/([a-zA-Z0-9]+)/) || msg.match(/bbs\/app\/api\/web\/share\?.*?link_id=([a-zA-Z0-9]+)/);
            if (bbsMatch) id = bbsMatch[1] || bbsMatch[2];
        } else if (msg.includes('pc')) {
            type = 'pc';
            const pcMatch = msg.match(/game\/pc\/([a-zA-Z0-9]+)/) || msg.match(/game\/share_game_detail\?.*?appid=([a-zA-Z0-9]+)&game_type=pc/);
            if (pcMatch) id = pcMatch[1] || pcMatch[2];
        } else if (msg.includes('console')) {
            type = 'console';
            const consoleMatch = msg.match(/game\/console\/([a-zA-Z0-9]+)/) || msg.match(/game\/share_game_detail\?.*?appid=([a-zA-Z0-9]+)&game_type=console/);
            if (consoleMatch) id = consoleMatch[1] || consoleMatch[2];
        } else if (msg.includes('mobile')) {
            type = 'mobile';
            const mobileMatch = msg.match(/game\/mobile\/([a-zA-Z0-9]+)/) || msg.match(/game\/share_game_detail\?.*?appid=([a-zA-Z0-9]+)&game_type=mobile/);
            if (mobileMatch) id = mobileMatch[1] || mobileMatch[2];
        }
        if (!type || !id) {
            logger.info(`[R插件][小黑盒] 未获取到有效ID: ${e.msg}`);
            return false;
        }

        // 检测是否填写小黑盒Cookie
        if (!this.xiaoheiheCookie) {
            e.reply(`检测到没有填写小黑盒Cookie，无法解析小黑盒`);
            return;
        }

        // 帖子类型
        if (type === 'bbs') {
            try {
                // 构造请求
                const params = getApiParams('bbs', id);
                const response = await axios.get(XHH_BBS_LINK, {
                    params,
                    headers: {
                        "Cookie": this.xiaoheiheCookie,
                        "User-Agent": COMMON_USER_AGENT,
                    }
                });
                const data = response.data;
                if (data.status !== 'ok' || !data.result) {
                    e.reply('小黑盒帖子解析失败，请检查链接是否正确或Cookie是否过期。');
                    logger.error(`[R插件][小黑盒帖子] API返回错误: ${JSON.stringify(data)}`);
                    return true;
                }

                const { link, comments } = data.result;
                const messagesToSend = [];
                // 封面
                if (link.thumb) {
                    messagesToSend.push(segment.image(link.thumb));
                }
                else if (link.video_thumb) {
                    messagesToSend.push(segment.image(link.video_thumb));
                }
                // 文字信息
                const textMessages = [];
                textMessages.push(`${this.identifyPrefix}识别：小黑盒帖子`);
                textMessages.push(`👤作者：${link.user.username}`);
                if (link.title) {
                    textMessages.push(`📝标题：${link.title}`);
                }
                if (link.description) {
                    textMessages.push(`📄简介：${link.description}`);
                }
                let tagsToDisplay = '';
                if (link.hashtags && link.hashtags.length > 0) {
                    tagsToDisplay = link.hashtags
                        .slice(0, 10) // 最多选择10个tag
                        .map(tag => `#${tag.name}`)
                        .join(' ');
                } else if (link.content_tags && link.content_tags.length > 0) {
                    tagsToDisplay = link.content_tags
                        .slice(0, 10) // 最多选择10个tag
                        .map(tag => `#${tag.text}`)
                        .join(' ');
                }
                if (tagsToDisplay) {
                    textMessages.push(`🏷️标签：${tagsToDisplay}`);
                }
                messagesToSend.push(textMessages.join('\n'));

                // 清理HTML文本
                const cleanHtmlText = (html) => {
                    if (!html) return '';
                    return html
                        .replace(/<a[^>]*?href="([^"]*?)"[^>]*?>(.*?)<\/a>/g, (match, href, text) => {
                            const cleanText = text.replace(/<[^>]+>/g, '').trim();
                            if (!cleanText) return '';
                            const cleanHref = href.replace(/\\/g, '');
                            const formattedText = `『${cleanText}』`;
                            try {
                                const decodedHref = decodeURIComponent(cleanHref);
                                const heyboxMatch = decodedHref.match(/heybox:\/\/({.*})/);
                                if (heyboxMatch && heyboxMatch[1]) {
                                    const jsonString = heyboxMatch[1];
                                    const linkData = JSON.parse(jsonString);
                                    const protocolType = linkData.protocol_type;
                                    if (protocolType === 'openUser' && linkData.user_id) {
                                        return `${formattedText} (https://www.xiaoheihe.cn/app/user/profile/${linkData.user_id})`;
                                    } else if (protocolType === 'openGameDetail' && linkData.app_id) {
                                        const gameType = linkData.game_type || 'pc';
                                        return `${formattedText} (https://www.xiaoheihe.cn/app/topic/game/${gameType}/${linkData.app_id})`;
                                    } else if (protocolType === 'openLink' && linkData.link?.linkid) {
                                        return `${formattedText} (https://www.xiaoheihe.cn/app/bbs/link/${linkData.link.linkid})`;
                                    }
                                }
                            } catch (e) {
                                return formattedText;
                            }
                            if (cleanHref.startsWith('http')) {
                                return `${formattedText} (${cleanHref})`;
                            }
                            return formattedText;
                        })
                        .replace(/<span[^>]*?data-emoji="([^"]*?)"[^>]*?>.*?<\/span>/g, (match, emoji) => `[${emoji}]`)
                        .replace(/<\/p>|<\/h[1-6]>|<\/blockquote>|<br\s*\/?>/g, '\n\n')
                        .replace(/<[^>]+>/g, '')
                        .trim();
                };

                // 解析提取帖子内容
                if (link.text && typeof link.text === 'string' && (link.text.startsWith('[') || link.text.startsWith('{'))) {
                    try {
                        const textEntities = JSON.parse(link.text);
                        const htmlItem = textEntities.find(item => item.type === 'html' && item.text);
                        if (htmlItem) {
                            // 图文混排的情况
                            await e.reply(messagesToSend.flat()); // 先发送封面和基础信息

                            const combinedMessage = [];
                            const htmlString = htmlItem.text;
                            const parts = htmlString.split(/(<img .*?\/?>|<iframe.*?<\/iframe>)/g).filter(Boolean);
                            let textBuffer = '';
                            for (let i = 0; i < parts.length; i++) {
                                const part = parts[i];
                                if (part.startsWith('<img')) {
                                    const cleanedText = cleanHtmlText(textBuffer);
                                    if (cleanedText) {
                                        combinedMessage.push(cleanedText);
                                    }
                                    textBuffer = '';
                                    // 貌似只有id 无法确定类型 暂使用并发
                                    const gameMatch = part.match(/data-gameid="(\d+)"/);
                                    const imgMatch = part.match(/data-original="([^"]+)"/);
                                    if (gameMatch && gameMatch[1]) {
                                        const gameId = gameMatch[1];
                                        const gameTypes = [
                                            'pc',
                                            'console',
                                            'mobile'
                                        ];
                                        const apiUrls = {
                                            pc: XHH_GAME_LINK,
                                            console: XHH_CONSOLE_LINK,
                                            mobile: XHH_MOBILE_LINK
                                        };
                                        const promises = gameTypes.map(gt =>
                                            axios.get(apiUrls[gt], {
                                                params: getApiParams(gt, gameId),
                                                headers: {
                                                    'Cookie': this.xiaoheiheCookie,
                                                    "User-Agent": COMMON_USER_AGENT
                                                },
                                            }).then(res => res.data).catch(() => null)
                                        );
                                        const results = await Promise.all(promises);
                                        const validResult = results.find(res => res && res.status === 'ok' && res.result);
                                        if (validResult) {
                                            const gameData = validResult.result;
                                            // 封面
                                            if (gameData.image) {
                                                combinedMessage.push(segment.image(gameData.image));
                                            }

                                            // 评分
                                            const textLines = [];
                                            const commentCount = gameData.comment_stats?.score_comment || 0;
                                            let scoreText = '🌟 评分: ';
                                            if (gameData.score) {
                                                scoreText += `${gameData.score}${commentCount > 0 ? ` (${commentCount}人)` : ''}`;
                                            } else {
                                                scoreText += `暂无评分${commentCount > 0 ? ` (${commentCount}人)` : ''}`;
                                            }
                                            textLines.push(scoreText);

                                            //价格
                                            let priceText = '💰 价格: ';
                                            let priceFound = false;
                                            if (gameData.price?.current) {
                                                priceText += `¥${gameData.price.current}${gameData.price.discount > 0 ? ` (-${gameData.price.discount}%)` : ''}`;
                                                priceFound = true;
                                            } else if (gameData.region_prices?.[0]) {
                                                const rp = gameData.region_prices[0];
                                                priceText += `${rp.final_amount}${rp.discount > 0 ? ` (-${rp.discount}%)` : ''} (${rp.region_name})`;
                                                priceFound = true;
                                            }
                                            if (!priceFound) {
                                                priceText += `暂无价格${gameData.price?.discount > 0 ? ` (折扣-${gameData.price.discount}%)` : ''}`;
                                            }
                                            textLines.push(priceText);

                                            let finalCardText = textLines.join('\n');
                                            const nextPartIndex = i + 1;
                                            if (nextPartIndex < parts.length && !parts[nextPartIndex].startsWith('<img')) {
                                                if (cleanHtmlText(parts[nextPartIndex])) {
                                                    finalCardText += '\n';
                                                }
                                            }
                                            combinedMessage.push(finalCardText);
                                        } else {
                                            logger.warn(`[R插件][小黑盒帖子] 游戏ID: ${gameId} 未找到。`);
                                        }
                                    } else if (imgMatch && imgMatch[1]) {
                                        // 普通图片
                                        combinedMessage.push(segment.image(imgMatch[1]));
                                    } else {
                                        // 无法识别 当作文本
                                        textBuffer += part;
                                    }
                                } else if (part.startsWith('<iframe')) {
                                    const cleanedText = cleanHtmlText(textBuffer);
                                    if (cleanedText) {
                                        combinedMessage.push(cleanedText);
                                    }
                                    textBuffer = '';
                                    const srcMatch = part.match(/src="([^"]+)"/);
                                    if (srcMatch && srcMatch[1]) {
                                        let src = srcMatch[1].replace(/\\/g, '');
                                        // 补全协议头
                                        if (src.startsWith('//')) {
                                            src = 'https:' + src;
                                        }
                                        combinedMessage.push(`\n(${src})\n`);
                                    }
                                } else {
                                    // 文本部分
                                    textBuffer += part;
                                }
                            }
                            const finalCleanedText = cleanHtmlText(textBuffer);
                            if (finalCleanedText) {
                                combinedMessage.push(finalCleanedText);
                            }

                            if (combinedMessage.length > 0) {
                                const postContentForwardMsgs = [{
                                    message: combinedMessage,
                                    nickname: this.e.sender.card || this.e.user_id,
                                    user_id: this.e.user_id,
                                }];
                                await replyWithRetry(e, Bot, await Bot.makeForwardMsg(postContentForwardMsgs));
                            }
                        } else {
                            // 图文分离的情况
                            const imageUrls = textEntities
                                .filter(item => item.type === 'img' && item.url)
                                .map(img => img.url);
                            const textContent = textEntities
                                .filter(item => item.type === 'text' && item.text)
                                .map(t => t.text)
                                .join('\n');
                            const hasValidText = textContent && textContent !== link.description;
                            if (hasValidText) {
                                // 有有效文本
                                if (imageUrls.length > this.globalImageLimit) {
                                    await e.reply(messagesToSend.flat());
                                    const combinedMessage = [];
                                    imageUrls.forEach(url => combinedMessage.push(segment.image(url)));
                                    combinedMessage.push(textContent);
                                    const forwardMsg = [{
                                        message: combinedMessage,
                                        nickname: this.e.sender.card || this.e.user_id,
                                        user_id: this.e.user_id
                                    }];
                                    await replyWithRetry(e, Bot, await Bot.makeForwardMsg(forwardMsg));
                                } else {
                                    imageUrls.forEach(url => messagesToSend.push(segment.image(url)));
                                    await e.reply(messagesToSend.flat());
                                    const textForwardMsg = [{
                                        message: textContent,
                                        nickname: this.e.sender.card || this.e.user_id,
                                        user_id: this.e.user_id
                                    }];
                                    await replyWithRetry(e, Bot, await Bot.makeForwardMsg(textForwardMsg));
                                }
                            } else {
                                // 无有效文本
                                if (imageUrls.length > this.globalImageLimit) {
                                    await e.reply(messagesToSend.flat());
                                    const imageMessage = imageUrls.map(url => segment.image(url));
                                    const forwardMsg = [{
                                        message: imageMessage,
                                        nickname: this.e.sender.card || this.e.user_id,
                                        user_id: this.e.user_id
                                    }];
                                    await replyWithRetry(e, Bot, await Bot.makeForwardMsg(forwardMsg));
                                } else {
                                    imageUrls.forEach(url => messagesToSend.push(segment.image(url)));
                                    await e.reply(messagesToSend.flat());
                                }
                            }
                        }
                    } catch (e) {
                        logger.error(`[R插件][小黑盒帖子] 尝试解析JSON提取正文内容失败，错误: ${e.message}`);
                    }
                } else {
                    await e.reply(messagesToSend.flat());
                }

                // 处理并发送视频
                if (link.has_video === 1 && link.video_url) {
                    const videoPath = await this.downloadVideo(link.video_url, false, null, this.videoDownloadConcurrency, 'xiaoheihe.mp4');
                    await this.sendVideoToUpload(e, videoPath);
                }

                // 处理并发送评论
                if (comments && comments.length > 0) {
                    comments.sort((a, b) => a.comment[0].floor_num - b.comment[0].floor_num);
                    const MAX_COMMENT_MESSAGES = 50; // 最大评论条数
                    let processedCommentCount = 0;
                    const commentForwardMsgs = [];
                    for (const thread of comments) {
                        if (processedCommentCount >= MAX_COMMENT_MESSAGES) break;
                        for (const comment of thread.comment) {
                            if (processedCommentCount >= MAX_COMMENT_MESSAGES) break;
                            const cleanedCommentText = cleanHtmlText(comment.text);
                            let msgText;
                            const userInfo = `${comment.user.username}`;
                            const formattedTime = this.formatCommentTime(comment.create_at); // 格式化时间
                            let commentContent = [];
                            if (comment.replyuser) {
                                msgText = `${userInfo} 回复 ${comment.replyuser.username}\n${formattedTime}·${comment.ip_location}\n\n${cleanedCommentText}`;
                            } else {
                                msgText = `${userInfo}\n${comment.floor_num}楼 ${formattedTime}·${comment.ip_location}\n\n${cleanedCommentText}`;
                            }
                            commentContent.push({ type: 'text', text: msgText });
                            if (comment.imgs && comment.imgs.length > 0) {
                                for (const img of comment.imgs) {
                                    commentContent.push(segment.image(img.url));
                                }
                            }
                            commentForwardMsgs.push({
                                message: commentContent,
                                nickname: comment.user.username,
                                user_id: comment.userid,
                            });
                            processedCommentCount++;
                        }
                    }
                    if (commentForwardMsgs.length > 0) {
                        await replyWithRetry(e, Bot, await Bot.makeForwardMsg(commentForwardMsgs));
                    }
                }
            } catch (error) {
                logger.error(`[R插件][小黑盒帖子] 解析失败: ${error.message}`);
                e.reply('小黑盒帖子解析时遇到问题，可能是网络错误或被风控了。');
            }
            // pc和主机和手机游戏类型
        } else if (type === 'pc' || type === 'console' || type === 'mobile') {
            try {
                let apiUrl;
                if (type === 'pc')
                    apiUrl = XHH_GAME_LINK;
                else if (type === 'console')
                    apiUrl = XHH_CONSOLE_LINK;
                else if (type === 'mobile')
                    apiUrl = XHH_MOBILE_LINK;

                const params = getApiParams(type, id);
                const response = await axios.get(apiUrl, {
                    params: params,
                    headers: {
                        'Cookie': this.xiaoheiheCookie,
                        "User-Agent": COMMON_USER_AGENT,
                    },
                });
                const data = response.data.result;
                if (!data) {
                    e.reply('小黑盒游戏解析失败，请检查链接是否正确或Cookie是否过期。');
                    logger.error(`[R插件][小黑盒游戏] API返回错误: ${JSON.stringify(response.data)}`);
                    return true;
                }

                const messageToSend = [];
                // 识别信息
                messageToSend.push(`${this.identifyPrefix}识别：小黑盒游戏`);
                // 游戏主封面图
                if (data.image) {
                    messageToSend.push(segment.image(data.image));
                }
                const otherTextLines = [];
                // 游戏名 (中文名和英文名)
                const gameName = data.name;
                const gameNameEn = data.name_en ? ` (${data.name_en})` : '';
                if (gameName || gameNameEn) {
                    otherTextLines.push(`🕹️ ${(gameName || '')}${gameNameEn}`);
                }
                // 小黑盒评分
                if (data.score) {
                    const commentCount = data.comment_stats?.score_comment || 0;
                    otherTextLines.push(`🌟 小黑盒评分: ${data.score} (${commentCount}人评价)`);
                }
                // 价格信息
                let priceDisplay = '';
                if (data.game_type === 'pc' && data.price?.current) { // PC游戏价格
                    priceDisplay = `¥${data.price.current}`;
                } else if (data.game_type === 'console' && data.region_prices && data.region_prices.length > 0) { // 主机游戏地区价格
                    const firstRegionPrice = data.region_prices[0];
                    priceDisplay = `${firstRegionPrice.final_amount} (${firstRegionPrice.region_name})`;
                }
                if (priceDisplay) {
                    otherTextLines.push(`💰 当前价格: ${priceDisplay}`);
                }
                if (otherTextLines.length > 0) {
                    if (!data.image) {
                        messageToSend.push('\n');
                    }
                    messageToSend.push(otherTextLines.join('\n'));
                }
                if (messageToSend.length > 0) {
                    await e.reply(messageToSend);
                }

                // 构建详细文本信息
                let detailTextParts = [];
                const forwardMessages = [];
                // 游戏信息
                let gameInfoLines = [];
                if (data.name) gameInfoLines.push(`• 中文名: ${data.name}`);
                if (data.name_en) gameInfoLines.push(`• 英文名: ${data.name_en}`);
                const releaseDate = data.menu_v2?.find(item => item.type === 'release_date');
                if (releaseDate?.value) gameInfoLines.push(`• 发行日期: ${releaseDate.value}`);
                const developer = data.menu_v2?.find(item => item.type === 'developer');
                if (developer?.value) gameInfoLines.push(`• 开发商: ${developer.value}`);
                let publishers = [];
                const menuV2Publisher = data.menu_v2?.find(item => item.type === 'publisher' && item.value);
                if (menuV2Publisher) {
                    publishers = menuV2Publisher.value.split('/').map(p => p.trim()).filter(Boolean);
                } else if (data.publishers && data.publishers.length > 0) {
                    publishers = data.publishers.map(p => p.value).filter(Boolean);
                }
                if (publishers.length > 0) {
                    gameInfoLines.push(`• 发行商: ${publishers.join(', ')}`);
                }
                if (data.platforms && data.platforms.length > 0) {
                    const platforms = data.platforms.join(' / ');
                    gameInfoLines.push(`• 支持平台: ${platforms}`);
                }
                const qqGroup = data.menu_v2?.find(item => item.type === 'qq');
                if (qqGroup?.value) {
                    gameInfoLines.push(`• QQ交流群: ${qqGroup.value}`);
                }
                if (gameInfoLines.length > 0) {
                    detailTextParts.push(`--- ✨ 游戏信息 ✨ ---\n${gameInfoLines.join('\n')}`);
                }
                // 游戏奖项
                let awardInfoLines = [];
                if (data.game_award && data.game_award.length > 0) {
                    data.game_award.forEach(award => {
                        const awardDetail = `${award.detail_name}${award.desc ? ` (${award.desc})` : ''}`;
                        awardInfoLines.push(`• ${awardDetail}`);
                    });
                }
                if (awardInfoLines.length > 0) {
                    detailTextParts.push(`\n--- 🏆 游戏奖项 🏆 ---\n${awardInfoLines.join('\n')}`);
                }
                // 价格信息
                let priceInfoLines = [];
                if (data.game_type === 'pc' && data.price) { // PC/Steam价格
                    if (data.price.current !== data.price.initial) {
                        priceInfoLines.push(`• 当前价格: ¥${data.price.current} (原价: ¥${data.price.initial}, -${data.price.discount}%)`);
                    } else if (data.price.current) {
                        priceInfoLines.push(`• 当前价格: ¥${data.price.current}`);
                    }
                    if (data.price.lowest_price) {
                        priceInfoLines.push(`• 史低价格: ¥${data.price.lowest_price} (-${data.price.lowest_discount}%)`);
                    }
                    if (data.heybox_price && data.heybox_price.cost_coin) {
                        priceInfoLines.push(`• 小黑盒商城: ${data.heybox_price.cost_coin / 1000} 盒币`);
                        if (data.heybox_price.discount > 0) {
                            priceInfoLines.push(`  (折扣: -${data.heybox_price.discount}%, 原价: ${data.heybox_price.original_coin / 1000} 盒币)`);
                        }
                    }
                    if (data.price?.deadline_date) {
                        priceInfoLines.push(`• 优惠截止: ${data.price.deadline_date}`);
                    }
                }
                if (data.game_type === 'console' && data.region_prices && data.region_prices.length > 0) { // 主机地区价格
                    const regionPricesDisplay = data.region_prices.map(rp => {
                        let priceStr = `${rp.region_name}: `;
                        if (rp.current !== rp.initial) {
                            priceStr += `${rp.final_amount} (原价: ${rp.initial_amount}, -${rp.discount}%)`;
                        } else {
                            priceStr += `${rp.final_amount}`;
                        }
                        if (rp.lowest_price && rp.lowest_price !== rp.final_amount) {
                            priceStr += ` / 史低: ${rp.lowest_price}`;
                        }
                        return priceStr;
                    }).join('\n  ');
                    priceInfoLines.push(`🌐 地区价格:\n  ${regionPricesDisplay}`);
                }
                if (priceInfoLines.length > 0) {
                    detailTextParts.push(`\n--- 💰 价格信息 💰 ---\n${priceInfoLines.join('\n')}`);
                }
                // 社区评价
                let communityInfoLines = [];
                if (data.score) {
                    communityInfoLines.push(`• 小黑盒评分: ${data.score} (${data.comment_stats?.score_comment || 0}人评价)`);
                }
                if (data.comment_stats?.star_5) {
                    const positiveRate = (parseFloat(data.comment_stats.star_5) / 100).toLocaleString('en-US', { style: 'percent' });
                    communityInfoLines.push(`• 玩家好评率: ${positiveRate}`);
                }
                if (data.multidimensional_score_radar && data.multidimensional_score_radar.dimension_list.length > 0) {
                    communityInfoLines.push(`• 多维度评分:`);
                    data.multidimensional_score_radar.dimension_list.forEach(dim => {
                        communityInfoLines.push(`  - ${dim.dimension_name}: ${dim.score}`);
                    });
                }
                const tagsSource = (data.common_tags && data.common_tags.length > 0) ? data.common_tags : data.hot_tags;
                const tags = tagsSource
                    ?.map(tag => {
                        if (tag && tag.desc) {
                            return `#${tag.desc}`;
                        }
                        return null;
                    })
                    .filter(Boolean)
                    .join(' ');
                if (tags) communityInfoLines.push(`• 热门标签: ${tags}`);
                if (data.user_num?.game_data) {
                    const heyboxPlayers = data.user_num.game_data.find(item => item.desc === '小黑盒玩家数');
                    if (heyboxPlayers?.value) communityInfoLines.push(`• 小黑盒玩家: ${heyboxPlayers.value}${heyboxPlayers.hb_rich_text?.attrs?.[1]?.text || ''}`);
                    const avgPlayTime = data.user_num.game_data.find(item => item.desc === '平均游戏时间');
                    if (avgPlayTime?.value) communityInfoLines.push(`• 平均游戏时长: ${avgPlayTime.value}`);
                }
                if (data.user_num?.game_data) {
                    const currentOnline = data.user_num.game_data.find(item => item.desc === '当前在线');
                    if (currentOnline?.value) communityInfoLines.push(`• 当前在线: ${currentOnline.value}人`);
                    const yesterdayPeak = data.user_num.game_data.find(item => item.desc === '昨日峰值在线');
                    if (yesterdayPeak?.value) communityInfoLines.push(`• 昨日峰值: ${yesterdayPeak.value}人`);
                }
                if (data.game_data) {
                    const hotRanking = data.game_data.find(item => item.desc === '热门排名');
                    if (hotRanking?.value) communityInfoLines.push(`• 热门排名: ${hotRanking.value}`);
                    const followers = data.game_data.find(item => item.desc === '关注数');
                    if (followers?.value) communityInfoLines.push(`• 关注数: ${followers.value}`);
                }
                if (communityInfoLines.length > 0) {
                    detailTextParts.push(`\n--- 🌟 社区评价 🌟 ---\n${communityInfoLines.join('\n')}`);
                }
                // 兼容性信息 (PC游戏特有)
                if (data.game_type === 'pc') {
                    const steamAggreTag = data.common_tags?.find(tag => tag.type === 'steam_aggre');
                    if (steamAggreTag && steamAggreTag.detail_list) {
                        const steamDeckStatusItem = steamAggreTag.detail_list.find(item => item.name === '支持Steam Deck');

                        if (steamDeckStatusItem && steamDeckStatusItem.desc) {
                            detailTextParts.push(`\n--- 🎮 兼容性信息 🎮 ---\n• Steam Deck: ${steamDeckStatusItem.desc}`);
                        }
                    }
                }
                // DLCs信息 (主机游戏特有)
                const dlcsInfo = data.menu_v2?.find(item => item.type === 'dlc');
                if (dlcsInfo?.value) {
                    detailTextParts.push(`\n--- 🧩 DLCs信息 🧩 ---\n• ${dlcsInfo.value} (点击原链接查看详情)`);
                }
                // 游戏简介
                if (data.about_the_game) {
                    detailTextParts.push(`\n--- 📖 游戏简介 📖 ---\n${data.about_the_game}`);
                }
                // 将所有构建好的文本合并
                if (detailTextParts.length > 0) {
                    forwardMessages.push({
                        message: detailTextParts.join('\n'),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    });
                }

                // 添加游戏截图
                const imageUrls = data.screenshots
                    ?.filter(m => m.type === 'image')
                    .map(m => m.url || m.thumbnail)
                    .filter(Boolean)
                    || [];
                if (imageUrls.length > 0) {
                    const combinedImageMessage = {
                        message: [
                            `  🖼️ 游戏截图 🖼️\n`,
                            ...imageUrls.map(url => segment.image(url))
                        ],
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    };
                    forwardMessages.push(combinedImageMessage);
                }
                // 发送合并后的转发消息
                await replyWithRetry(e, Bot, await Bot.makeForwardMsg(forwardMessages));

                // 发送游戏视频
                const video = data.screenshots?.find(m => m.type === 'movie');
                if (video) {
                    const videoPath = await this.downloadVideo(video.url, false, null, this.videoDownloadConcurrency, 'xiaoheihe.mp4');
                    this.sendVideoToUpload(e, videoPath);
                }
            } catch (error) {
                logger.error(`[R插件][小黑盒游戏] 解析失败: ${error.message}`);
                e.reply('小黑盒游戏解析时遇到问题，可能是网络错误或被风控了。');
            }
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
            return mergeFileToMp4(data[0].fullFileName, data[1].fullFileName, `${title}.mp4`);
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
            const resp = await axios.get(url, params);

            const location = resp.request.res.responseUrl;

            const setCookieHeaders = resp.headers['set-cookie'];
            let ttwidValue;
            if (setCookieHeaders) {
                setCookieHeaders.forEach(cookie => {
                    // 使用正则表达式提取 ttwid 的值
                    const ttwidMatch = cookie.match(/ttwid=([^;]+)/);
                    if (ttwidMatch) {
                        ttwidValue = ttwidMatch[1];
                    }
                });
            }

            return new Promise((resolve, reject) => {
                if (location != null) {
                    return resolve({
                        location: location,
                        ttwidValue: ttwidValue
                    });
                } else {
                    return reject("获取失败");
                }
            });
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }


    /**
     * 格式化时间戳为用户友好的字符串
     * @param timestamp Unix 时间戳 (秒)
     * @returns {string} 格式化后的时间字符串
     */
    formatCommentTime(timestamp) {
        const now = Date.now(); // 当前时间戳 (毫秒)
        const commentTime = timestamp * 1000; // 评论时间戳 (毫秒)
        const diff = now - commentTime; // 时间差 (毫秒)
        const oneMinute = 60 * 1000;
        const oneHour = 60 * oneMinute;
        const oneDay = 24 * oneHour;
        const oneMonth = 30 * oneDay; // 简单按30天算一个月
        const oneYear = 365 * oneDay; // 简单按365天算一年
        const commentDate = new Date(commentTime);
        const today = new Date(now);
        const yesterday = new Date(now - oneDay);
        // 设置日期为当天的0点0分0秒，用于比较
        today.setHours(0, 0, 0, 0);
        yesterday.setHours(0, 0, 0, 0);
        commentDate.setHours(0, 0, 0, 0);
        // 格式化时间为 HH:MM
        const formatHourMinute = (date) => {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        };
        // 格式化日期为 YYYY年MM月DD日
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}年${month}月${day}日`;
        };
        if (diff < oneMinute) {
            return "刚刚";
        } else if (diff < oneHour) {
            return `${Math.floor(diff / oneMinute)}分钟前`;
        } else if (diff < oneDay && commentDate.getTime() === today.getTime()) {
            // 今天，显示 HH:MM
            return `今天${formatHourMinute(new Date(commentTime))}`;
        } else if (diff < (2 * oneDay) && commentDate.getTime() === yesterday.getTime()) {
            // 昨天，显示 昨天 HH:MM
            return `昨天${formatHourMinute(new Date(commentTime))}`;
        } else if (diff < oneMonth) {
            // 几天前
            return `${Math.floor(diff / oneDay)}天前`;
        } else if (diff < oneYear) {
            // 几个月前，显示 MM月DD日 HH:MM
            const month = String(new Date(commentTime).getMonth() + 1).padStart(2, '0');
            const day = String(new Date(commentTime).getDate()).padStart(2, '0');
            return `${month}月${day}日 ${formatHourMinute(new Date(commentTime))}`;
        } else {
            // 几年前，显示 YYYY年MM月DD日
            return formatDate(new Date(commentTime));
        }
    }

    /**
     * 获取当前发送人/群的下载路径
     * @param e Yunzai 机器人事件
     * @returns {string}
     */
    getCurDownloadPath(e) {
        return `${this.defaultPath}${e.group_id || e.user_id}`;
    }

    /**
     * 提取视频下载位置
     * @returns {{groupPath: string, target: string}}
     */
    getGroupPathAndTarget() {
        const groupPath = `${this.defaultPath}${this.e.group_id || this.e.user_id}`;
        // 使用时间戳生成唯一文件名，避免多平台并发时冲突
        const target = `${groupPath}/video_${Date.now()}.mp4`;
        return { groupPath, target };
    }

    /**
     * 工具：根据URL多线程下载视频 / 音频
     * @param url
     * @param isProxy
     * @param headers
     * @param numThreads
     * @param fileName 可选，指定下载后的文件名（如 'weibo.mp4', 'BV123.mp4'）
     * @returns {Promise<string>} 返回下载文件的完整路径
     */
    async downloadVideo(url, isProxy = false, headers = null, numThreads = this.videoDownloadConcurrency, fileName = null) {
        // 构造群信息参数
        const groupPath = `${this.defaultPath}${this.e.group_id || this.e.user_id}`;
        // 如果传入 fileName 则使用，否则使用时间戳
        const actualFileName = fileName || `video_${Date.now()}.mp4`;
        const target = `${groupPath}/${actualFileName}`;
        await mkdirIfNotExists(groupPath);
        // 构造header部分内容
        const userAgent = "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36";

        // 构造代理参数
        const proxyOption = {
            ...(isProxy && {
                httpAgent: new HttpsProxyAgent(`http://${this.proxyAddr}:${this.proxyPort}`),
            }),
        };

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
        };
        logger.info(`[R插件][视频下载]：当前队列长度为 ${this.queue.size + 1}`);
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
                        "Range": `bytes=${start}-${end}`
                    },
                    responseType: "stream",
                    ...proxyOption
                };

                promises.push(axios.get(url, partAxiosConfig).then(res => {
                    return new Promise((resolve, reject) => {
                        const partPath = `${target}.part${i}`;
                        logger.mark(`[R插件][视频下载引擎] 正在下载 part${i}`);
                        const writer = fs.createWriteStream(partPath);
                        res.data.pipe(writer);
                        writer.on("finish", () => {
                            logger.mark(`[R插件][视频下载引擎] part${i + 1} 下载完成`); // 记录线程下载完成
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

            return target;
        } catch (err) {
            logger.error(`下载视频发生错误！\ninfo:${err}`);
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

        // 从 target 中提取文件名
        const fileName = target.split('/').pop() || target.split('\\').pop() || 'video.mp4';

        // 构造aria2c命令参数
        const aria2cArgs = [
            `"${url}"`,
            `--out="${fileName}"`,
            `--dir="${groupPath}"`,
            `--user-agent="${userAgent}"`,
            `--max-connection-per-server=${numThreads}`, // 每个服务器的最大连接数
            `--split=${numThreads}`,               // 分成 6 个部分进行下载
        ];

        // 如果有自定义头信息
        if (headers) {
            for (const [key, value] of Object.entries(headers)) {
                aria2cArgs.push(`--header="${key}: ${value}"`);
            }
        }

        // 如果使用代理
        if (proxyOption && proxyOption.httpAgent) {
            const proxyUrl = proxyOption.httpAgent.proxy.href;
            aria2cArgs.push(`--all-proxy="${proxyUrl}"`);
        }

        try {
            await checkAndRemoveFile(target);
            logger.mark(`开始下载: ${url}`);

            // 执行aria2c命令
            const command = `aria2c ${aria2cArgs.join(' ')}`;
            return new Promise((resolve, reject) => {
                exec(command, { timeout: DOWNLOAD_WAIT_DETECT_FILE_TIME * 10 }, (error, stdout, stderr) => {
                    if (error) {
                        if (error.killed) {
                            logger.error(`[R插件][Aria2] 下载文件超时！`);
                        }
                        logger.error(`下载视频发生错误！\ninfo:${stderr || error.message}`);
                        return reject(new Error(`Aria2 进程执行失败: ${stderr || error.message}`));
                    }
                    logger.mark(`下载完成: ${url}`);
                    if (fs.existsSync(target) && fs.statSync(target).size > 0) {
                        logger.info(`[R插件][Aria2] 文件校验成功: ${target}`);
                        resolve(target);
                    } else {
                        logger.error(`[R插件][Aria2] 下载完成但文件无效 (不存在或为空): ${target}`);
                        reject(new Error("Aria2 下载的文件无效。"));
                    }
                });
            });
        } catch (err) {
            logger.error(`下载视频发生错误！\ninfo:${err}`);
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
            `-n ${numThreads}`,
            `-o "${target}"`,
            `-U "${userAgent}"`,
            url
        ];

        // 如果有自定义头信息
        if (headers) {
            for (const [key, value] of Object.entries(headers)) {
                axelArgs.push(`-H "${key}: ${value}"`);
            }
        }

        // 如果使用代理
        if (proxyOption && proxyOption.httpAgent) {
            const proxyUrl = proxyOption.httpAgent.proxy.href;
            axelArgs.push(`--proxy="${proxyUrl}"`);
        }

        try {
            await checkAndRemoveFile(target);
            logger.mark(`开始下载: ${url}`);


            // 执行axel命令
            const command = `axel ${axelArgs.join(' ')}`;
            return new Promise((resolve, reject) => {
                exec(command, { timeout: DOWNLOAD_WAIT_DETECT_FILE_TIME * 10 }, (error, stdout, stderr) => {
                    if (error) {
                        if (error.killed) {
                            logger.error(`[R插件][Axel] 下载文件超时！`);
                        }
                        logger.error(`下载视频发生错误！\ninfo:${stderr || error.message}`);
                        return reject(new Error(`Axel 进程执行失败: ${stderr || error.message}`));
                    }
                    logger.mark(`下载完成: ${url}`);
                    if (fs.existsSync(target) && fs.statSync(target).size > 0) {
                        logger.info(`[R插件][Axel] 文件校验成功: ${target}`);
                        resolve(target);
                    } else {
                        logger.error(`[R插件][Axel] 下载完成但文件无效 (不存在或为空): ${target}`);
                        reject(new Error("Axel 下载的文件无效。"));
                    }
                });
            });
        } catch (err) {
            logger.error(`下载视频发生错误！\ninfo:${err}`);
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
            logger.mark(`开始下载: ${url}`);
            const writer = fs.createWriteStream(target);
            res.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on("finish", () => resolve(target));
                writer.on("error", reject);
            });
        } catch (err) {
            logger.error(`下载视频发生错误！\ninfo:${err}`);
        }
    }

    /**
     * 判断是否启用解析
     * @param resolveName
     * @returns {Promise<boolean>}
     */
    async isEnableResolve(resolveName) {
        const controller = this.globalBlackList;
        // 如果不存在，那么直接放行
        if (controller == null) {
            return true;
        }
        // 找到禁用列表中是否包含 `resolveName`
        const foundItem = controller.find(item => item === resolveName);
        // 如果 undefined 说明不在禁用列表就放行
        return foundItem === undefined;
    }

    /**
     * 判断是否是海外服务器
     * @return {Promise<Boolean>}
     */
    async isOverseasServer() {
        // 如果配置了强制使用海外服务器，则返回true
        if (this.forceOverseasServer) {
            return true;
        }
        // 如果第一次使用没有值就设置
        if (!(await redisExistKey(REDIS_YUNZAI_ISOVERSEA))) {
            await redisSetKey(REDIS_YUNZAI_ISOVERSEA, {
                os: false,  // 默认不使用海外服务器
            });
            return false;
        }
        // 如果有就取出来
        return (await redisGetKey(REDIS_YUNZAI_ISOVERSEA)).os;
    }

    /**
     * 判断当前用户是否是信任用户
     * @param userId
     * @returns {Promise<boolean>}
     */
    async isTrustUser(userId) {
        // 如果当前用户是机器人主人
        if (this.e.isMaster) {
            return true;
        }
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
            // 判断文件是否存在
            if (!fs.existsSync(path)) {
                return e.reply('视频不存在');
            }
            const stats = fs.statSync(path);
            const videoSize = Math.floor(stats.size / (1024 * 1024));
            // 正常发送视频
            if (videoSize > videoSizeLimit) {
                e.reply(`当前视频大小：${videoSize}MB，\n大于设置的最大限制：${videoSizeLimit}MB，\n改为上传群文件`);
                await this.uploadGroupFile(e, path); // uploadGroupFile 内部会处理删除
            } else {
                // 使用 replyWithRetry 包装视频发送，自动处理重发
                const result = await replyWithRetry(e, Bot, segment.video(path));
                // 发送成功后删除原文件
                if (result && result.message_id) {
                    await checkAndRemoveFile(path);
                    // 同时清理可能生成的 retry 文件
                    const retryPath = path.replace(/(\.\w+)$/, '_retry$1');
                    await checkAndRemoveFile(retryPath);
                } else {
                    // 重发也失败了，清理文件
                    await checkAndRemoveFile(path);
                    const retryPath = path.replace(/(\.\w+)$/, '_retry$1');
                    await checkAndRemoveFile(retryPath);
                }
            }
        } catch (err) {
            logger.error(`[R插件][发送视频判断是否需要上传] 发生错误:\n ${err}`);
            // 如果发送失败，也尝试删除，避免残留
            await checkAndRemoveFile(path);
            const retryPath = path.replace(/(\.\w+)$/, '_retry$1');
            await checkAndRemoveFile(retryPath);
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
