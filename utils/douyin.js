import axios from "axios";
import {
    COMMON_USER_AGENT,
    douyinTypeMap,
    REDIS_YUNZAI_DOUYIN_COMMAND_PATTERNS_CACHE,
} from "../constants/constant.js";
import {
    DY_APP_DETAIL,
    DY_CARRIER_PARSE,
    DY_SHARE_NOTE_PAGE,
    DY_SHARE_SETTINGS,
    DY_SHARE_VIDEO_PAGE,
    DY_TOUTIAO_INFO,
    DY_TTWID_REGISTER,
    DY_WEB_NOTE_PAGE,
    DY_WEB_OPEN_DETAIL,
} from "../constants/tools.js";
import { redisExistAndGetKey, redisSetKey } from "./redis-util.js";

const DOUYIN_REFERER = "https://www.douyin.com/";
const DOUYIN_PLAY_RATIOS = ["1080p", "720p", "540p", "360p"];
const DOUYIN_COMPRESSED_PLAY_RATIOS = ["720p", "540p", "360p"];
const TTWID_REGISTER_PAYLOAD = {
    aid: 1768,
    union: true,
    needFid: false,
    region: "cn",
    cbUrlProtocol: "https",
    service: "www.ixigua.com",
    migrate_info: {
        ticket: "",
        source: "node",
    },
};

function getDouyinHeaders(ttwid = "") {
    const headers = {
        "User-Agent": COMMON_USER_AGENT,
        Referer: DOUYIN_REFERER,
    };

    if (ttwid) {
        headers.Cookie = `ttwid=${ttwid}`;
    }

    return headers;
}

function extractCookieValue(setCookieHeaders, cookieName) {
    if (!setCookieHeaders) {
        return "";
    }

    const cookieList = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const cookie of cookieList) {
        const match = String(cookie).match(new RegExp(`${cookieName}=([^;]+)`));
        if (match?.[1]) {
            return match[1];
        }
    }

    return "";
}

function extractDouyinIdFromUrl(url = "") {
    return /share\/video\/(\d+)/.exec(url)?.[1]
        || /share\/note\/(\d+)/.exec(url)?.[1]
        || /video\/(\d+)/.exec(url)?.[1]
        || /note\/(\d+)/.exec(url)?.[1]
        || /modal_id=(\d+)/.exec(url)?.[1]
        || "";
}

function buildDouyinCanonicalCandidates(url = "") {
    const awemeId = extractDouyinIdFromUrl(url);
    if (!awemeId) {
        return [url];
    }

    if (url.includes("iesdouyin.com/share/video/")) {
        return [url, DY_SHARE_NOTE_PAGE.replace("{}", awemeId)];
    }

    if (url.includes("iesdouyin.com/share/note/")) {
        return [url, DY_SHARE_VIDEO_PAGE.replace("{}", awemeId)];
    }

    if (url.includes("/note/")) {
        return [DY_SHARE_NOTE_PAGE.replace("{}", awemeId), DY_SHARE_VIDEO_PAGE.replace("{}", awemeId)];
    }

    return [DY_SHARE_VIDEO_PAGE.replace("{}", awemeId), DY_SHARE_NOTE_PAGE.replace("{}", awemeId)];
}

async function fetchFirstResolvedDouyinAweme(canonicalUrls = [], ttwid = "") {
    let lastError = null;

    for (const canonicalUrl of canonicalUrls) {
        try {
            const shareResponse = await axios.get(canonicalUrl, {
                headers: getDouyinHeaders(ttwid),
                timeout: 15000,
            });
            const routerData = parseRouterDataFromHtml(String(shareResponse.data || ""));
            const aweme = findAwemeCandidate(routerData);
            const contentType = getAwemeContentType(aweme);

            if (!aweme?.aweme_id || contentType === "unknown") {
                throw new Error("SSR 页面中未找到可识别的抖音内容");
            }

            return {
                canonicalUrl,
                aweme,
                contentType,
            };
        } catch (error) {
            lastError = error;
            logger.debug?.(`[R插件][抖音SSR兜底] canonical 解析失败 ${canonicalUrl}: ${error.message}`);
        }
    }

    throw lastError || new Error("未命中可用的抖音 SSR 分享页");
}

function extractBalancedJson(source = "", marker = "window._ROUTER_DATA") {
    const markerIndex = source.indexOf(marker);
    if (markerIndex === -1) {
        return "";
    }

    const assignmentIndex = source.indexOf("=", markerIndex);
    if (assignmentIndex === -1) {
        return "";
    }

    const afterAssignment = source.slice(assignmentIndex + 1).trimStart();
    if (afterAssignment.startsWith("JSON.parse(")) {
        const startQuoteIndex = source.indexOf("\"", assignmentIndex);
        if (startQuoteIndex === -1) {
            return "";
        }

        let escaped = false;
        for (let i = startQuoteIndex + 1; i < source.length; i++) {
            const char = source[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"") {
                return source.slice(startQuoteIndex, i + 1);
            }
        }
        return "";
    }

    const jsonStartIndex = source.indexOf("{", assignmentIndex);
    if (jsonStartIndex === -1) {
        return "";
    }

    let depth = 0;
    let inString = false;
    let stringQuote = "";
    let escaped = false;

    for (let i = jsonStartIndex; i < source.length; i++) {
        const char = source[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === stringQuote) {
                inString = false;
                stringQuote = "";
            }
            continue;
        }

        if (char === "\"" || char === "'") {
            inString = true;
            stringQuote = char;
            continue;
        }

        if (char === "{") {
            depth++;
        } else if (char === "}") {
            depth--;
            if (depth === 0) {
                return source.slice(jsonStartIndex, i + 1);
            }
        }
    }

    return "";
}

function parseRouterDataFromHtml(html = "") {
    const rawJson = extractBalancedJson(html, "window._ROUTER_DATA");
    if (!rawJson) {
        throw new Error("未找到 window._ROUTER_DATA");
    }

    if (rawJson.startsWith("\"")) {
        return JSON.parse(JSON.parse(rawJson));
    }

    return JSON.parse(rawJson);
}

function findAwemeCandidate(value) {
    if (!value) {
        return null;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findAwemeCandidate(item);
            if (found) {
                return found;
            }
        }
        return null;
    }

    if (typeof value !== "object") {
        return null;
    }

    if (value.aweme_id && (value.video?.play_addr?.uri || Array.isArray(value.images) && value.images.length > 0)) {
        return value;
    }

    for (const item of Object.values(value)) {
        const found = findAwemeCandidate(item);
        if (found) {
            return found;
        }
    }

    return null;
}

function getFirstUrl(urlObject = {}) {
    return urlObject?.url_list?.at(-1)
        || urlObject?.url_list?.[0]
        || urlObject?.urlList?.at(-1)
        || urlObject?.urlList?.[0]
        || urlObject?.uri
        || "";
}

function getAwemeContentType(aweme = {}) {
    const mappedType = douyinTypeMap[aweme.aweme_type];
    if (mappedType) {
        return mappedType;
    }

    if (aweme.video?.play_addr?.uri) {
        return "video";
    }

    if (Array.isArray(aweme.images) && aweme.images.length > 0) {
        return "image";
    }

    return "unknown";
}

function getAwemeCoverUrl(aweme = {}) {
    return getFirstUrl(aweme.video?.cover)
        || getFirstUrl(aweme.video?.origin_cover)
        || aweme.images?.[0]?.url_list?.[0]
        || "";
}

function normalizeDurationSeconds(duration = 0) {
    const durationNumber = Number(duration) || 0;
    if (durationNumber <= 0) {
        return 0;
    }

    return durationNumber > 1000 ? Math.trunc(durationNumber / 1000) : Math.trunc(durationNumber);
}

function parseContentSize(headers = {}) {
    const contentRange = headers["content-range"] || headers["Content-Range"] || "";
    const contentRangeMatch = String(contentRange).match(/\/(\d+)$/);
    if (contentRangeMatch?.[1]) {
        return Number(contentRangeMatch[1]);
    }

    const contentLength = headers["content-length"] || headers["Content-Length"];
    const size = Number(contentLength) || 0;
    return size > 2 ? size : 0;
}

async function probeDouyinVideoQuality(videoId, ratio) {
    const playUrl = DY_TOUTIAO_INFO.replace("1080p", ratio).replace("{}", videoId);
    const response = await axios.get(playUrl, {
        headers: {
            ...getDouyinHeaders(),
            Range: "bytes=0-1",
        },
        timeout: 15000,
        responseType: "arraybuffer",
        maxRedirects: 5,
        validateStatus: status => status >= 200 && status < 400,
    });

    const size = parseContentSize(response.headers);
    if (!size) {
        return null;
    }

    const finalUrl = response.request?.res?.responseUrl || playUrl;
    return {
        ratio,
        size,
        playUrl,
        finalUrl,
    };
}

async function probeDouyinVideoQualities(videoId, preferCompressed = false) {
    const orderedRatios = preferCompressed ? DOUYIN_COMPRESSED_PLAY_RATIOS : DOUYIN_PLAY_RATIOS;
    const available = [];
    const seenSize = new Set();

    for (const ratio of orderedRatios) {
        try {
            const result = await probeDouyinVideoQuality(videoId, ratio);
            if (!result) {
                continue;
            }

            if (!seenSize.has(result.size)) {
                seenSize.add(result.size);
                available.push(result);
            }
        } catch (error) {
            logger.debug?.(`[R插件][抖音SSR兜底] 画质探测失败 ${ratio}: ${error.message}`);
        }
    }

    return available;
}

export async function registerAnonymousDouyinTtwid() {
    const response = await axios.post(DY_TTWID_REGISTER, TTWID_REGISTER_PAYLOAD, {
        headers: {
            ...getDouyinHeaders(),
            "Content-Type": "application/json",
        },
        timeout: 15000,
    });

    const ttwid = extractCookieValue(response.headers["set-cookie"], "ttwid");
    if (!ttwid) {
        throw new Error("匿名 ttwid 获取失败");
    }

    return ttwid;
}

export async function resolveDouyinVideoBySsr(url, options = {}) {
    const { initialTtwid = "", preferCompressed = false } = options;
    const canonicalUrls = buildDouyinCanonicalCandidates(url);
    const awemeId = extractDouyinIdFromUrl(url) || extractDouyinIdFromUrl(canonicalUrls[0] || "");

    if (!awemeId) {
        throw new Error("无法识别抖音 aweme_id");
    }

    const ttwid = initialTtwid || await registerAnonymousDouyinTtwid();
    const { canonicalUrl, aweme, contentType } = await fetchFirstResolvedDouyinAweme(canonicalUrls, ttwid);

    const resolved = {
        awemeId: String(aweme.aweme_id || awemeId),
        aweme,
        contentType,
        author: aweme.author || {},
        authorNickname: aweme.author?.nickname || "抖音用户",
        desc: aweme.desc || "",
        durationSeconds: normalizeDurationSeconds(aweme.video?.duration || aweme.duration),
        coverUrl: getAwemeCoverUrl(aweme),
        canonicalUrl,
        ttwid,
        downloadHeaders: getDouyinHeaders(),
    };

    if (contentType !== "video") {
        return resolved;
    }

    if (!aweme.video?.play_addr?.uri) {
        throw new Error("SSR 页面中未找到视频播放信息");
    }

    const qualities = await probeDouyinVideoQualities(aweme.video.play_addr.uri, preferCompressed);
    const selectedQuality = qualities[0];
    if (!selectedQuality?.playUrl) {
        throw new Error("未探测到可用抖音视频播放地址");
    }

    return {
        ...resolved,
        videoId: aweme.video.play_addr.uri,
        videoUrl: selectedQuality.playUrl,
        selectedRatio: selectedQuality.ratio,
    };
}

const DOUYIN_PC_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const DOUYIN_APP_USER_AGENT = "com.ss.android.ugc.aweme/380700 (Linux; U; Android 13; zh_CN; SM-G998B; Build/TP1A.220624.014)";
const DOUYIN_CARRIER_TYPES = [3, 4, 5, 6];
const DOUYIN_FALLBACK_COMMAND_PATTERNS = [
    "ˇˇ[^\\s]+※※",
    "##[A-Za-z0-9_+/=-]+##",
    "%%[A-Za-z0-9_+/=-]+%%",
    "\\$\\$[A-Za-z0-9_+/=-]+\\$\\$",
    "[￥¥][A-Za-z0-9_+/=-]+[￥¥]",
    "ωω[^\\s]+ωω",
    "ΔΔ[^\\s]+ΔΔ",
    "€[^\\s]+€",
    "activity_[A-Za-z0-9_=-]+",
];

function escapeRegExp(text = "") {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileDouyinCommandPattern(rawPattern = "", extraFlags = "") {
    if (typeof rawPattern !== "string" || !rawPattern.trim()) {
        return null;
    }

    let pattern = rawPattern.trim();
    const flagSet = new Set(extraFlags.split("").filter(Boolean));

    // 剥离 Java 内联前缀标志（如 (?i)、(?m)、(?s)、(?u)）
    const inlineFlagMatch = pattern.match(/^\(\?([imsuUx]+)\)/);
    if (inlineFlagMatch) {
        for (const ch of inlineFlagMatch[1]) {
            if (ch === "i" || ch === "m" || ch === "s") {
                flagSet.add(ch);
            }
        }
        pattern = pattern.slice(inlineFlagMatch[0].length);
    }

    const flags = [...flagSet].join("");
    // Java \x{HHHH} 码点转义 -> JS \u{HHHH}
    const unicodePattern = pattern.replace(/\\x\{([0-9a-fA-F]+)\}/g, "\\u{$1}");

    try {
        return new RegExp(unicodePattern, `${flags}u`);
    } catch {
        // 部分服务端正则包含 JS u 模式禁止的多余转义 降级尝试非 u 模式（4位以上码点转 UTF-16 代理对）
        const fallbackPattern = unicodePattern.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (raw, hex) => {
            const cp = parseInt(hex, 16);
            if (!Number.isFinite(cp) || cp > 0x10ffff) {
                return raw;
            }
            if (cp <= 0xffff) {
                return `\\u${cp.toString(16).padStart(4, "0")}`;
            }
            const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800;
            const lo = ((cp - 0x10000) % 0x400) + 0xdc00;
            return `\\u${hi.toString(16)}\\u${lo.toString(16)}`;
        });
        try {
            return new RegExp(fallbackPattern, flags);
        } catch {
            return null;
        }
    }
}

export async function getDouyinCommandPatterns() {
    const now = Date.now();
    try {
        const cacheData = await redisExistAndGetKey(REDIS_YUNZAI_DOUYIN_COMMAND_PATTERNS_CACHE);
        if (Array.isArray(cacheData?.patterns) && cacheData.patterns.length > 0 && cacheData?.expireAt > now) {
            return cacheData.patterns;
        }
    } catch (error) {
        logger.debug?.(`[R插件][抖音口令] 读取 Redis 正则缓存失败: ${error.message}`);
    }

    try {
        const resp = await axios.get(DY_SHARE_SETTINGS, {
            headers: {
                "User-Agent": DOUYIN_PC_USER_AGENT,
            },
            timeout: 10000,
        });
        const remotePatterns = resp.data?.status_code === 0 && Array.isArray(resp.data?.command_patterns)
            ? resp.data.command_patterns.filter(item => typeof item === "string" && item.trim())
            : [];

        if (remotePatterns.length > 0) {
            const merged = [...new Set([...remotePatterns, ...DOUYIN_FALLBACK_COMMAND_PATTERNS])];
            await redisSetKey(REDIS_YUNZAI_DOUYIN_COMMAND_PATTERNS_CACHE, {
                patterns: merged,
                expireAt: now + 6 * 60 * 60 * 1000,
            }).catch(() => { });
            return merged;
        }
    } catch (error) {
        logger.warn?.(`[R插件][抖音口令] 拉取远端正则表失败，使用本地兜底: ${error.message}`);
    }

    // 拉取失败短暂写入兜底缓存 避免连续异常高频打上游
    await redisSetKey(REDIS_YUNZAI_DOUYIN_COMMAND_PATTERNS_CACHE, {
        patterns: DOUYIN_FALLBACK_COMMAND_PATTERNS,
        expireAt: now + 10 * 60 * 1000,
    }).catch(() => { });
    return DOUYIN_FALLBACK_COMMAND_PATTERNS;
}

export async function extractDouyinCommandCandidates(text = "") {
    if (!text || typeof text !== "string") {
        return [];
    }

    // 截断超长群聊消息 防止卡死
    const safeText = text.length > 500
        ? text.slice(0, 500)
        : text;
    const patterns = await getDouyinCommandPatterns();
    const candidates = [];
    const seen = new Set();

    for (const rawPattern of patterns) {
        const regex = compileDouyinCommandPattern(rawPattern, "g");
        if (!regex) {
            continue;
        }
        for (const match of safeText.matchAll(regex)) {
            if (match?.[0] && !seen.has(match[0])) {
                seen.add(match[0]);
                candidates.push(match[0]);
                if (candidates.length >= 10) {
                    return candidates;
                }
            }
        }
    }

    return candidates;
}

function extractItemIdFromSchema(schema = "") {
    const text = String(schema);
    const paramMatch = text.match(/[?&](?:item_id|aweme_id|id)=(\d+)/i);
    if (paramMatch?.[1]) {
        return paramMatch[1];
    }
    const pathMatch = text.match(/\/(?:detail|note|video|article)\/(\d+)/i);
    if (pathMatch?.[1]) {
        return pathMatch[1];
    }
    if (/\/(?:user|profile|live)\//i.test(text) || /[?&](?:room_id|web_rid|sec_uid|uid)=/i.test(text)) {
        return "";
    }
    const fallbackMatch = text.match(/(\d{15,})/);
    return fallbackMatch?.[1] || "";
}

export async function parseDouyinCarrier(codeInfo = "") {
    if (!codeInfo) {
        return null;
    }

    for (const carrierType of DOUYIN_CARRIER_TYPES) {
        try {
            const resp = await axios.get(DY_CARRIER_PARSE, {
                params: {
                    aid: 1128,
                    carrier_type: carrierType,
                    code_info: codeInfo,
                    source_from: "",
                },
                headers: {
                    "User-Agent": DOUYIN_PC_USER_AGENT,
                },
                timeout: 4500,
            });

            if (resp.data?.status_code !== 0) {
                continue;
            }

            const data = resp.data?.data;
            const schema = data?.schema || "";
            if (!schema) {
                continue;
            }

            const shareScene = String(data?.share_scene || "");
            const roomId = String(schema).match(/[?&]room_id=([1-9]\d*)/i)?.[1] || "";
            const webRid = String(schema).match(/[?&]web_rid=([1-9]\d*)/i)?.[1] || "";
            const itemId = extractItemIdFromSchema(schema);
            const isArticle = schema.includes("article") || shareScene === "long_article";
            const isLive = /\/\/live(?:[/?]|$)|\/live\/|webcast/i.test(schema) || Boolean(roomId || webRid);
            const isNote = !isArticle && !isLive && (
                schema.includes("note")
                || schema.includes("slides")
                || shareScene.includes("note")
                || shareScene.includes("image")
            );

            if (itemId || roomId || webRid) {
                return {
                    carrierType,
                    codeInfo,
                    schema,
                    shareScene,
                    shareUserInfo: data?.share_user_info || null,
                    itemId,
                    roomId,
                    webRid,
                    isArticle,
                    isNote,
                    isLive,
                };
            }
        } catch (error) {
            logger.debug?.(`[R插件][抖音口令] carrier_type=${carrierType} 解析失败: ${error.message}`);
        }
    }

    return null;
}

/**
 * 解析消息中的抖音口令
 * 先提取口令，再调用 carrier/parse 换取 item_id 与场景类型。
 * 未匹配到任何口令特征时返回 null；命中口令特征但均已失效时返回 { itemId: "", command }。
 */
export async function resolveDouyinCommand(text = "") {
    const candidates = await extractDouyinCommandCandidates(text);
    if (candidates.length === 0) {
        return null;
    }

    for (const candidate of candidates.slice(0, 3)) {
        const parsed = await parseDouyinCarrier(candidate);
        if (parsed) {
            return parsed;
        }
    }

    return {
        itemId: "",
        command: candidates[0],
        isArticle: false,
        isNote: false,
        isLive: false,
    };
}

/**
 * 通过 App 端接口获取作品详情（限时日常等半私域内容与 Web detail 403 的兜底通道）
 */
export async function fetchDouyinAppDetail(awemeId, douyinCookie = "") {
    if (!awemeId || !douyinCookie) {
        return null;
    }

    try {
        const url = DY_APP_DETAIL.replace("{}", encodeURIComponent(String(awemeId)));
        const resp = await axios.get(url, {
            headers: {
                "User-Agent": DOUYIN_APP_USER_AGENT,
                Cookie: douyinCookie,
            },
            timeout: 15000,
        });

        const detail = resp.data?.aweme_detail || resp.data?.aweme || null;
        if (!detail || (!detail.aweme_id && !detail.video && !detail.images && !detail.article_info)) {
            return null;
        }
        return detail;
    } catch (error) {
        logger.debug?.(`[R插件][抖音App兜底] 请求失败 awemeId=${awemeId}: ${error.message}`);
        return null;
    }
}

function readJsStringLiteral(source = "", startQuoteIndex = 0) {
    let escaped = false;
    for (let i = startQuoteIndex + 1; i < source.length; i++) {
        const char = source[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        if (char === "\"") {
            return {
                literal: source.slice(startQuoteIndex, i + 1),
                endIndex: i + 1,
            };
        }
    }
    return null;
}

function extractPaceFChunks(html = "") {
    const chunks = [];
    const marker = "__pace_f.push(";
    let searchFrom = 0;

    while (searchFrom < html.length) {
        const markerIdx = html.indexOf(marker, searchFrom);
        if (markerIdx === -1) {
            break;
        }

        let cursor = markerIdx + marker.length;
        while (cursor < html.length && /\s/.test(html[cursor])) cursor++;
        if (html[cursor] !== "[") {
            searchFrom = cursor;
            continue;
        }
        cursor++;

        const commaIdx = html.indexOf(",", cursor);
        const closeBracketIdx = html.indexOf("]", cursor);
        // 跳过如 __pace_f.push([0]) 这类无逗号的初始化调用 防止跨标签误扫
        if (commaIdx === -1 || (closeBracketIdx !== -1 && closeBracketIdx < commaIdx)) {
            searchFrom = closeBracketIdx !== -1 ? closeBracketIdx + 1 : cursor;
            continue;
        }
        cursor = commaIdx + 1;
        while (cursor < html.length && /\s/.test(html[cursor])) cursor++;

        if (html[cursor] !== "\"") {
            searchFrom = cursor;
            continue;
        }

        const strToken = readJsStringLiteral(html, cursor);
        if (!strToken) {
            break;
        }

        try {
            chunks.push(JSON.parse(strToken.literal));
        } catch {
            try {
                chunks.push(JSON.parse(strToken.literal.replace(/(\\\\)|\\'/g, (_, bs) => bs || "'")));
            } catch {
                // 跳过非标准分片
            }
        }
        searchFrom = strToken.endIndex;
    }

    return chunks;
}

function extractBalancedObjectAt(source = "", startIndex = 0) {
    if (source[startIndex] !== "{") {
        return "";
    }
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < source.length; i++) {
        const char = source[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"") {
                inString = false;
            }
            continue;
        }
        if (char === "\"") {
            inString = true;
            continue;
        }
        if (char === "{") {
            depth++;
        } else if (char === "}") {
            depth--;
            if (depth === 0) {
                return source.slice(startIndex, i + 1);
            }
        }
    }
    return "";
}

function findEnclosingJsonObjects(source = "", markerIndices = []) {
    if (!source || markerIndices.length === 0) {
        return [];
    }

    const targetSet = new Set(markerIndices);
    const braceStack = [];
    const results = [];
    const seenOpenIndexes = new Set();
    let inString = false;
    let escaped = false;

    for (let i = 0; i < source.length; i++) {
        if (targetSet.has(i) && braceStack.length > 0) {
            const openIndex = braceStack[braceStack.length - 1];
            if (!seenOpenIndexes.has(openIndex)) {
                seenOpenIndexes.add(openIndex);
                const rawJson = extractBalancedObjectAt(source, openIndex);
                if (rawJson) {
                    try {
                        results.push(JSON.parse(rawJson));
                    } catch {
                        // 忽略无法完整解析的片段
                    }
                }
            }
        }

        const char = source[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"") {
                inString = false;
            }
            continue;
        }
        if (char === "\"") {
            inString = true;
        } else if (char === "{") {
            braceStack.push(i);
        } else if (char === "}" && braceStack.length > 0) {
            braceStack.pop();
        }
    }

    // 兜底：防止同分片前置原始文本含奇数个双引号导致整片 inString 状态错乱
    if (results.length === 0) {
        for (const markerIndex of markerIndices) {
            let searchPos = markerIndex;
            let tries = 0;
            while (searchPos > 0 && tries < 200) {
                const openIdx = source.lastIndexOf("{", searchPos - 1);
                if (openIdx === -1) {
                    break;
                }
                tries++;
                if (!seenOpenIndexes.has(openIdx)) {
                    seenOpenIndexes.add(openIdx);
                    const rawJson = extractBalancedObjectAt(source, openIdx);
                    if (rawJson && openIdx + rawJson.length > markerIndex) {
                        try {
                            results.push(JSON.parse(rawJson));
                            break;
                        } catch {
                            // 继续向外层 { 尝试
                        }
                    }
                }
                searchPos = openIdx;
            }
        }
    }

    return results;
}

function findArticleDetailInObject(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    if (value.aweme?.detail && (value.aweme.detail.articleInfo || value.aweme.detail.article_info)) {
        return value.aweme.detail;
    }
    if (value.articleInfo || value.article_info) {
        return value;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findArticleDetailInObject(item);
            if (found) {
                return found;
            }
        }
        return null;
    }
    for (const item of Object.values(value)) {
        const found = findArticleDetailInObject(item);
        if (found) {
            return found;
        }
    }
    return null;
}

function extractArticleDetailFromChunks(chunks = [], itemId = "") {
    const sources = [...chunks];
    if (chunks.length > 1) {
        sources.push(chunks.join(""));
    }

    const markers = [
        new RegExp(`"awemeId"\\s*:\\s*"${escapeRegExp(itemId)}"`, "g"),
        /"articleInfo"\s*:/g,
    ];

    // 先在全部分片中优先按目标 itemId 查找 再回退通用 articleInfo 防止命中推荐流作品
    for (const markerRegex of markers) {
        for (const source of sources) {
            const indices = [];
            for (const match of source.matchAll(markerRegex)) {
                indices.push(match.index);
            }
            if (indices.length === 0) {
                continue;
            }
            const objects = findEnclosingJsonObjects(source, indices);
            for (const obj of objects) {
                const detail = findArticleDetailInObject(obj) || obj?.aweme?.detail || null;
                if (detail) {
                    return detail;
                }
            }
        }
    }

    return null;
}

function resolveFlightTextReference(chunks = [], refToken = "") {
    const token = String(refToken).trim();
    if (token === "$undefined" || token === "$null") {
        return "";
    }
    const match = token.match(/^\$([0-9a-zA-Z]+)$/);
    if (!match) {
        return "";
    }

    const refId = match[1];
    const headerReg = new RegExp(`(?:^|\\r?\\n)${escapeRegExp(refId)}:T([0-9a-fA-F]+),`);
    const sources = chunks.map((chunk, idx) => ({
        text: String(chunk || ""),
        rest: chunks.slice(idx + 1).join(""),
    }));
    if (chunks.length > 1) {
        sources.push({ text: chunks.join(""), rest: "" });
    }

    for (const { text, rest } of sources) {
        const headerMatch = headerReg.exec(text);
        if (!headerMatch) {
            continue;
        }

        const byteLength = parseInt(headerMatch[1], 16);
        if (!Number.isFinite(byteLength) || byteLength <= 0) {
            return "";
        }

        const payloadStart = headerMatch.index + headerMatch[0].length;
        const combinedText = text.slice(payloadStart) + rest;
        const utf8Bytes = Buffer.from(combinedText, "utf8");
        if (utf8Bytes.length < byteLength) {
            return "";
        }

        try {
            const decoder = new TextDecoder("utf-8", { fatal: true });
            return decoder.decode(utf8Bytes.subarray(0, byteLength));
        } catch {
            return "";
        }
    }

    return "";
}

function parseDouyinArticleContent(rawContent, chunks = null) {
    if (!rawContent) {
        return "";
    }

    if (typeof rawContent === "object") {
        return String(
            rawContent.markdown
            || rawContent.content
            || rawContent.text
            || rawContent.long_article_abstract
            || ""
        ).trim();
    }

    let text = String(rawContent).trim();
    if (!text) {
        return "";
    }

    // 处理 SSR React Flight 文本引用（如 "$b"）或空引用（"$undefined" / "$null"）
    if (text.startsWith("$")) {
        if (!Array.isArray(chunks) || chunks.length === 0) {
            return "";
        }
        text = resolveFlightTextReference(chunks, text).trim();
        if (!text || text.startsWith("$")) {
            return "";
        }
    }

    if (text.startsWith("{")) {
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === "object") {
                return String(
                    parsed.markdown
                    || parsed.content
                    || parsed.text
                    || parsed.long_article_abstract
                    || ""
                ).trim();
            }
        } catch {
            // 兼容纯文本形态
        }
    }

    return text;
}

function normalizeArticleMediaUrl(url = "") {
    if (!url || typeof url !== "string") {
        return "";
    }
    let normalized = url.trim().replace(/\\/g, "");
    if (normalized.startsWith("//")) {
        normalized = `https:${normalized}`;
    }
    normalized = normalized.replace(/^http:\/\//i, "https://");
    return /^https?:\/\//i.test(normalized) ? normalized : "";
}

function extractCoverFromField(coverField) {
    if (!coverField) {
        return "";
    }
    if (typeof coverField === "string") {
        return normalizeArticleMediaUrl(coverField);
    }
    if (typeof coverField === "object") {
        return normalizeArticleMediaUrl(getFirstUrl(coverField));
    }
    return "";
}

function decodeBasicHtmlEntities(text = "") {
    return String(text)
        .replace(/&nbsp;/gi, " ")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, "&");
}

function cleanArticleMarkdownText(rawText = "") {
    let text = String(rawText || "").replace(/\r\n/g, "\n");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = decodeBasicHtmlEntities(text);

    // Markdown 普通链接
    text = text.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+[^)]*)?\)/g, (_, label, url) => {
        const cleanLabel = label.trim();
        return cleanLabel && cleanLabel !== url ? `${cleanLabel} (${url})` : url;
    });

    // 标题与引用前缀
    text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
    text = text.replace(/^[ \t]*>[ \t]*$/gm, "");
    text = text.replace(/^[ \t]*>[ \t]?/gm, "▎ ");

    // 加粗 / 斜体
    text = text.replace(/\*\*\*([^*\n]+?)\*\*\*/g, "$1");
    text = text.replace(/___([^_\n]+?)___/g, "$1");
    text = text.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
    text = text.replace(/__([^_\n]+?)__/g, "$1");
    text = text.replace(/(^|[^\w*])\*([^\s*\n][^*\n]*?[^\s*\n]|[^\s*\n])\*(?!\*)/g, "$1$2");

    return text.replace(/\n{3,}/g, "\n\n").trim();
}

function parseDouyinArticleSegments(markdown = "") {
    const normalized = String(markdown || "")
        .replace(/\r\n/g, "\n")
        .replace(/<br\s*\/?>/gi, "\n");
    const imageReg = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)(?:\s+[^)]*)?\)/g;

    const segments = [];
    let lastIndex = 0;

    const pushText = (rawSlice) => {
        const cleaned = cleanArticleMarkdownText(rawSlice);
        if (!cleaned) {
            return;
        }
        const prev = segments[segments.length - 1];
        if (prev?.type === "text") {
            prev.content = `${prev.content}\n\n${cleaned}`;
        } else {
            segments.push({ type: "text", content: cleaned });
        }
    };

    for (const match of normalized.matchAll(imageReg)) {
        pushText(normalized.slice(lastIndex, match.index));
        const imgUrl = normalizeArticleMediaUrl(match[1]);
        if (imgUrl) {
            segments.push({ type: "image", url: imgUrl });
        }
        lastIndex = match.index + match[0].length;
    }
    pushText(normalized.slice(lastIndex));

    return segments;
}

function normalizeDouyinMusic(music = null) {
    if (!music || typeof music !== "object") {
        return null;
    }
    const playUrlObj = music.play_url || music.playUrl || {};
    const rawUrlList = Array.isArray(playUrlObj.url_list)
        ? playUrlObj.url_list
        : (Array.isArray(playUrlObj.urlList) ? playUrlObj.urlList : []);
    const urlList = rawUrlList.map(url => normalizeArticleMediaUrl(url)).filter(Boolean);
    const rawUri = playUrlObj.uri || urlList[0] || "";
    if (!rawUri && urlList.length === 0) {
        return null;
    }
    return {
        ...music,
        title: music.title || music.musicName || "",
        author: music.author || music.ownerNickname || "",
        play_url: {
            ...playUrlObj,
            uri: rawUri,
            url_list: urlList.length > 0 ? urlList : (normalizeArticleMediaUrl(rawUri) ? [normalizeArticleMediaUrl(rawUri)] : []),
        },
        cover_hd: music.cover_hd || music.coverHd || music.cover_large || music.coverLarge || music.cover_medium || music.coverMedium,
        avatar_large: music.avatar_large || music.avatarLarge || music.cover_thumb || music.coverThumb,
    };
}

function normalizeArticleResult(detail, itemId, chunks = null) {
    if (!detail || typeof detail !== "object") {
        return null;
    }

    const articleInfo = detail.articleInfo || detail.article_info;
    if (!articleInfo || typeof articleInfo !== "object") {
        return null;
    }

    const rawContent = articleInfo.articleContent ?? articleInfo.article_content ?? "";
    const rawMarkdown = parseDouyinArticleContent(rawContent, chunks);
    if (!rawMarkdown) {
        return null;
    }

    const segments = parseDouyinArticleSegments(rawMarkdown);
    if (segments.length === 0) {
        return null;
    }

    const body = segments
        .filter(seg => seg.type === "text")
        .map(seg => seg.content)
        .join("\n\n")
        .trim();
    const title = String(articleInfo.articleTitle || articleInfo.article_title || detail.desc || "").trim();
    const coverUrl = extractCoverFromField(detail.video?.cover)
        || extractCoverFromField(detail.video?.origin_cover)
        || extractCoverFromField(articleInfo.cover)
        || extractCoverFromField(detail.images?.[0]);

    const author = detail.authorInfo || detail.author || {};
    const stats = detail.stats || detail.statistics || {};

    return {
        itemId: String(detail.awemeId || detail.aweme_id || itemId),
        title,
        body,
        segments,
        coverUrl,
        video: coverUrl ? { cover: { url_list: [coverUrl] } } : detail.video,
        music: normalizeDouyinMusic(detail.music),
        authorNickname: author.nickname || "抖音用户",
        commentAuthor: {
            sec_uid: author.sec_uid || author.secUid || "",
            uid: author.uid || "",
            unique_id: author.unique_id || author.uniqueId || "",
            short_id: author.short_id || author.shortId || "",
            nickname: author.nickname || "",
        },
        stats: {
            diggCount: Number(stats.diggCount ?? stats.digg_count ?? 0) || 0,
            commentCount: Number(stats.commentCount ?? stats.comment_count ?? 0) || 0,
            shareCount: Number(stats.shareCount ?? stats.share_count ?? 0) || 0,
            collectCount: Number(stats.collectCount ?? stats.collect_count ?? 0) || 0,
        },
        readTime: articleInfo.readTime || articleInfo.read_time || 0,
        createTime: detail.createTime || detail.create_time || 0,
    };
}

/**
 * 通道 1（优先）：通过开放平台来源头 Web 详情接口免 Cookie 获取长图文
 */
export async function fetchDouyinArticleOpenJson(itemId) {
    if (!itemId) {
        return null;
    }

    try {
        const url = DY_WEB_OPEN_DETAIL.replace("{}", encodeURIComponent(String(itemId)));
        const resp = await axios.get(url, {
            headers: {
                "User-Agent": DOUYIN_PC_USER_AGENT,
                Origin: "https://open.douyin.com",
                Referer: "https://open.douyin.com/",
            },
            timeout: 15000,
            validateStatus: () => true,
        });

        if (resp.status !== 200 || !resp.data || typeof resp.data !== "object") {
            return null;
        }

        return normalizeArticleResult(resp.data?.aweme_detail, itemId, null);
    } catch (error) {
        logger.debug?.(`[R插件][抖音长图文][JSON通道] 请求失败 itemId=${itemId}: ${error.message}`);
        return null;
    }
}

/**
 * 通道 2（回退）：通过 PC 网页 SSR + React Flight 获取长图文（需完整登录 Cookie）
 */
export async function fetchDouyinArticleSsr(itemId, douyinCookie = "") {
    if (!douyinCookie) {
        throw new Error("开放平台 JSON 通道不可用，且未配置 douyinCookie，无法启用 PC SSR 兜底");
    }

    logger.info?.(`[R插件][抖音长图文] JSON 通道未命中，回退 PC SSR 通道 itemId=${itemId}`);
    const pageUrl = DY_WEB_NOTE_PAGE.replace("{}", encodeURIComponent(String(itemId)));
    const resp = await axios.get(pageUrl, {
        headers: {
            "User-Agent": DOUYIN_PC_USER_AGENT,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            Referer: DOUYIN_REFERER,
            Cookie: douyinCookie,
        },
        timeout: 15000,
    });

    const html = String(resp.data || "");
    const chunks = extractPaceFChunks(html);
    if (chunks.length === 0) {
        throw new Error("页面未返回 __pace_f 渲染数据，请检查 douyinCookie 是否失效");
    }

    const detail = extractArticleDetailFromChunks(chunks, String(itemId));
    if (!detail) {
        throw new Error("未从长图文页面解析到 aweme.detail，作品可能已删除或 Cookie 已失效");
    }

    const article = normalizeArticleResult(detail, itemId, chunks);
    if (!article) {
        throw new Error("长图文正文为空");
    }

    return article;
}

/**
 * 获取抖音长图文详情：优先免 Cookie JSON 通道，失败时回退 PC SSR 通道
 */
export async function fetchDouyinArticleDetail(itemId, douyinCookie = "") {
    if (!itemId) {
        throw new Error("缺少长图文作品 ID");
    }

    const openArticle = await fetchDouyinArticleOpenJson(itemId);
    if (openArticle) {
        // logger.info?.(`[R插件][抖音长图文] 命中开放平台 JSON 通道 itemId=${itemId}`);
        return openArticle;
    }

    return await fetchDouyinArticleSsr(itemId, douyinCookie);
}

/**
 * 按长度上限优先在换行或标点处切分长图文正文
 */
export function splitDouyinArticleText(text = "", maxLen = 3000) {
    if (!Number.isFinite(maxLen) || maxLen <= 0) {
        maxLen = 3000;
    }

    const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!normalized) {
        return [];
    }
    if (normalized.length <= maxLen) {
        return [normalized];
    }

    const chunks = [];
    let remaining = normalized;
    const minSearchStart = Math.floor(maxLen * 0.5);
    const breakChars = ["\n\n", "\n", "。", "！", "？", "；", ".", "!", "?", ";", " "];

    while (remaining.length > maxLen) {
        const slice = remaining.slice(0, maxLen);
        let splitIdx = -1;

        for (const sep of breakChars) {
            const idx = slice.lastIndexOf(sep);
            if (idx >= minSearchStart) {
                splitIdx = idx + sep.length;
                break;
            }
        }

        if (splitIdx <= 0) {
            splitIdx = maxLen;
            if (splitIdx > 1) {
                const code = remaining.charCodeAt(splitIdx - 1);
                if (code >= 0xd800 && code <= 0xdbff) {
                    splitIdx--;
                }
            }
        }

        const chunk = remaining.slice(0, splitIdx).trim();
        if (chunk) {
            chunks.push(chunk);
        }
        remaining = remaining.slice(splitIdx).trimStart();
    }

    if (remaining.trim()) {
        chunks.push(remaining.trim());
    }
    return chunks;
}
