import axios from "axios";
import { COMMON_USER_AGENT, douyinTypeMap } from "../constants/constant.js";
import { DY_SHARE_NOTE_PAGE, DY_SHARE_VIDEO_PAGE, DY_TTWID_REGISTER, DY_TOUTIAO_INFO } from "../constants/tools.js";

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
