import axios from 'axios';
import { WXCHANNEL_YUANBAO_PARSE, WXCHANNEL_FEED_INFO } from '../constants/tools.js';

/**
 * 微信视频号分享链接解析
 * 移植自 https://github.com/ltaoo/wx_channels_download 的 internal/api/sph/worker.js
 *
 * 解析流程（两步法）：
 *   1. 调腾讯元宝接口 yuanbao.tencent.com/api/weixin/get_parse_result 解析分享链接
 *      → 返回 playable_url，其中包含 token(generalToken) 与 eid(exportId)
 *   2. 调视频号接口 channels.weixin.qq.com/finder-preview/api/feed/get_feed_info
 *      → 用 token + eid 换取视频地址、作者、互动数据等
 *
 * 鉴权：仅需「腾讯元宝 Web 端 Cookie」，不需要微信登录。
 */

// 元宝接口请求头（与 worker.js 完全一致，含设备/会话指纹）
const PARSE_HEADERS = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'content-type': 'application/json',
    'origin': 'https://yuanbao.tencent.com',
    'referer': 'https://yuanbao.tencent.com/chat/naQivTmsDa/cf4d0079-ed1b-4c55-a3f3-2ca1379727d1',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'sec-ch-ua': `"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"`,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': `"macOS"`,
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    't-userid': 'b9575f6b0a8c4a55a08096904a5ef20a',
    'x-agentid': 'naQivTmsDa/cf4d0079-ed1b-4c55-a3f3-2ca1379727d1',
    'x-commit-tag': '72282a0d',
    'x-device-id': '1921b001708100d7fa31002b9646bd0cc15a3e2e1f',
    'x-hy106': '',
    'x-hy92': 'e963067ffa31002b9646bd0c03000008b1951a',
    'x-hy93': '1921b001708100d7fa31002b9646bd0cc15a3e2e1f',
    'x-id': 'b9575f6b0a8c4a55a08096904a5ef20a',
    'x-instance-id': '5',
    'x-language': 'zh-CN',
    'x-os_version': 'Mac OS(10.15.7)-Blink',
    'x-platform': 'mac',
    'x-requested-with': 'XMLHttpRequest',
    'x-source': 'web',
    'x-web-third-source': 'main',
    'x-webdriver': '0',
    'x-webversion': '2.69.0',
    'x-ybuitest': '0',
};

// 视频号 feed 详情接口请求头
const FEED_INFO_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'Origin': 'https://channels.weixin.qq.com',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'sec-ch-ua': `"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"`,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': `"macOS"`,
};

/**
 * 生成 _rid：当前时间戳16进制 + "-" + 8位随机hex
 * 模拟前端 zg() + "-" + Gg()
 * @returns {string}
 */
function generateRid() {
    const timestampHex = Math.floor(Date.now() / 1000).toString(16);
    const chars = '0123456789abcdef';
    let randomHex = '';
    for (let i = 0; i < 8; i++) {
        randomHex += chars[Math.floor(Math.random() * 16)];
    }
    return `${timestampHex}-${randomHex}`;
}

/**
 * Step 1: 调腾讯元宝接口解析分享链接
 * @param {string} shareUrl 视频号分享链接，形如 https://weixin.qq.com/sph/xxx
 * @param {string} cookie 腾讯元宝 Web 端 Cookie
 * @returns {Promise<object>} parseData，包含 wx_export_id / playable_url / cover_url / author / desc 等
 */
export async function parseShareUrl(shareUrl, cookie) {
    logger.info(`[R插件][视频号][parseShareUrl] start, url: ${shareUrl}`);
    const payload = { type: 'video_channel_url', url: shareUrl, scene: 1 };
    const resp = await axios.post(WXCHANNEL_YUANBAO_PARSE, payload, {
        headers: { ...PARSE_HEADERS, cookie },
        timeout: 15000,
    });
    const result = resp.data;
    if (!result || !result.data || !result.data.wx_export_id) {
        logger.warn(`[R插件][视频号][parseShareUrl] missing wx_export_id in response`);
        throw new Error('元宝接口未返回 wx_export_id，可能是 Cookie 失效或分享链接无效');
    }
    logger.info(`[R插件][视频号][parseShareUrl] success, exportId: ${result.data.wx_export_id}`);
    return result.data;
}

/**
 * Step 2: 调视频号 feed 详情接口获取视频信息
 * @param {string} exportId 从 playable_url 提取的 eid
 * @param {string} generalToken 从 playable_url 提取的 token
 * @returns {Promise<object>} FeedResponse
 */
export async function getFeedInfo(exportId, generalToken) {
    logger.info(`[R插件][视频号][getFeedInfo] start, exportId: ${exportId}`);
    const rid = generateRid();
    const payload = { baseReq: { generalToken }, exportId };
    const apiUrl = `${WXCHANNEL_FEED_INFO}?_rid=${rid}&_pageUrl=${encodeURIComponent('https://channels.weixin.qq.com/finder-preview/pages/feed')}`;
    const referer =
        'https://channels.weixin.qq.com/finder-preview/pages/feed' +
        `?entry_card_type=48&comment_scene=39&appid=0` +
        `&token=${encodeURIComponent(generalToken)}` +
        `&entry_scene=0&eid=${encodeURIComponent(exportId)}`;

    const resp = await axios.post(apiUrl, payload, {
        headers: { ...FEED_INFO_HEADERS, Referer: referer },
        timeout: 15000,
    });
    const result = resp.data;
    logger.info(`[R插件][视频号][getFeedInfo] success, errCode: ${result?.errCode}`);
    return result;
}

/**
 * 清洗视频 URL：仅保留 encfilekey 和 token 参数，去除其余临时参数
 * 移植自 sph.go 的 cleanVideoURL，便于长期保存/直链下载
 * @param {string} videoUrl 原始视频 URL
 * @returns {string} 清洗后的 URL，若缺少关键参数则返回原 URL
 */
export function cleanVideoURL(videoUrl) {
    try {
        const u = new URL(videoUrl);
        const filekey = u.searchParams.get('encfilekey');
        const token = u.searchParams.get('token');
        if (filekey && token) {
            return `${u.protocol}//${u.host}${u.pathname}?encfilekey=${filekey}&token=${token}`;
        }
    } catch (e) {
        // 解析失败，返回原 URL
    }
    return videoUrl;
}

/**
 * 从分享链接消息文本中提取 sph 链接
 * 支持 https://weixin.qq.com/sph/xxx 格式
 * @param {string} msg 消息文本
 * @returns {string|null}
 */
export function extractShareUrl(msg) {
    if (!msg || typeof msg !== 'string') return null;
    const match = /https?:\/\/weixin\.qq\.com\/sph\/[A-Za-z0-9]+/i.exec(msg);
    return match ? match[0] : null;
}

/**
 * 组合两步解析，返回标准化结果
 * @param {string} shareUrl 视频号分享链接
 * @param {string} cookie 腾讯元宝 Web 端 Cookie
 * @returns {Promise<object>} 标准化结果 { video, originVideo, cover, desc, author, authorIcon, authIcon, stats, createTime, expiredTime, raw }
 */
export async function fetchVideoProfile(shareUrl, cookie) {
    if (!cookie) {
        throw new Error('未配置腾讯元宝 Cookie，请联系管理员设置（#设置视频号Cookie）');
    }

    // Step 1
    const parseData = await parseShareUrl(shareUrl, cookie);
    logger.info(`[R插件][视频号] step 1/2 done, exportId: ${parseData.wx_export_id}`);

    // 从 playable_url 中提取 token(generalToken) 与 eid(exportId)
    let generalToken = '';
    let exportId = '';
    try {
        const playableUrl = new URL(parseData.playable_url);
        generalToken = playableUrl.searchParams.get('token') || '';
        exportId = playableUrl.searchParams.get('eid') || '';
    } catch (_) {
        // ignore
    }
    if (!generalToken) logger.warn('[R插件][视频号] generalToken is empty in playable_url');
    if (!exportId) logger.warn('[R插件][视频号] exportId (eid) is empty in playable_url');

    // Step 2
    const feedResult = await getFeedInfo(exportId, generalToken);
    logger.info('[R插件][视频号] step 2/2 done');

    // 校验响应：仅在 errCode 字段存在且非 0 时视为错误（部分响应可能不含 errCode 字段，视为成功）
    if (!feedResult) {
        throw new Error('视频号接口返回空响应');
    }
    if (feedResult.errCode !== undefined && feedResult.errCode !== null && feedResult.errCode !== 0) {
        const errMsg = feedResult.errMsg || '未知错误';
        throw new Error(`视频号接口返回错误: ${errMsg} (errCode: ${feedResult.errCode})`);
    }
    // 校验关键数据是否存在
    if (!feedResult.data || (!feedResult.data.feedInfo && !feedResult.data.authorInfo)) {
        throw new Error('视频号接口返回数据为空，可能是分享链接已失效或 token 过期');
    }

    const data = feedResult.data || {};
    const feedInfo = data.feedInfo || {};
    const authorInfo = data.authorInfo || {};
    const sceneInfo = data.sceneInfo || {};

    // 优先使用清洗后的 originVideoUrl（仅含 encfilekey + token），其次用原始 videoUrl
    const rawVideoUrl = feedInfo.videoUrl || '';
    const originVideoUrl = cleanVideoURL(rawVideoUrl);
    // H.264 编码视频链接（部分 PC QQ 兼容性更好）
    const h264VideoUrl = feedInfo.h264VideoInfo?.videoUrl || '';

    return {
        // 视频地址（优先清洗后直链，其次原始，最后 H264 兜底）
        video: originVideoUrl || rawVideoUrl || h264VideoUrl || '',
        originVideo: originVideoUrl,
        rawVideo: rawVideoUrl,
        h264Video: h264VideoUrl,
        // 封面
        cover: feedInfo.coverUrl || parseData.cover_url || '',
        // 描述
        desc: feedInfo.description || parseData.desc || '',
        // 作者
        author: authorInfo.nickname || parseData.author || '',
        authorIcon: authorInfo.headImgUrl || parseData.author_icon || '',
        authIcon: authorInfo.authIconUrl || parseData.author_certification_icon || '',
        // 互动数据
        stats: {
            like: feedInfo.likeCountFmt || '',
            fav: feedInfo.favCountFmt || '',
            forward: feedInfo.forwardCountFmt || '',
            comment: feedInfo.commentCountFmt || '',
        },
        // 时间
        createTime: feedInfo.createtime || 0,
        expiredTime: sceneInfo.expiredTime || 0,
        // 元数据
        mediaType: feedInfo.mediaType || 0,
        // 原始响应（调试用）
        raw: feedResult,
    };
}
