/**
 * QQ 音乐 musics.fcg 双信封本地解析引擎（ESM）
 *
 * 不依赖任何服务器/第三方解析，纯本地：
 *   - 签名 P(form) / 请求体加密 L(form) 由 utils/qqmusic/Qmusic.cjs 完成
 *     （CJS 强制按 CommonJS 执行，spawn 子进程隔离，避免污染宿主）
 *   - 响应解密由 utils/qqmusic/decrypt-cli.cjs 完成（jiemi.js 加密
 *     函数命名有误导性，实为解密）
 *
 * 用法：
 *   export QQ_COOKIE='...'
 *   node utils/qqmusic.js search 稻香
 *   node utils/qqmusic.js url <songMid> <mediaMid>
 *   node utils/qqmusic.js share <分享链接>
 */
import { spawn } from "node:child_process";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const QMUSIC_CLI = path.join(__dirname, "qqmusic", "Qmusic.cjs");
const DECRYPT_CLI = path.join(__dirname, "qqmusic", "decrypt-cli.cjs");

const API = "https://u6.y.qq.com/cgi-bin/musics.fcg";
const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const GUID = "225418138";
const DEFAULT_QDESC = "lq96kOgg";
const SPIP_FALLBACK = "https://ws.stream.qqmusic.qq.com/";

// QQ 音乐相关域名白名单（短链跟随/分享链接解析仅允许访问这些 host，防 SSRF）
const QQ_HOST_SUFFIXES = ["y.qq.com", "qq.com", "gtimg.cn", "url.cn"];

/**
 * 校验 host 是否属于 QQ 音乐白名单（host 本身或其后缀命中）
 * @param {string} hostname
 * @returns {boolean}
 */
function isQqHost(hostname) {
    const host = String(hostname || "").trim().toLowerCase();
    if (!host) {
        return false;
    }
    return QQ_HOST_SUFFIXES.some(
        (suffix) => host === suffix || host.endsWith("." + suffix)
    );
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 从 Cookie 提取 wxuin 或 uin（数字字符串），没有返回 '0'
 * @param {string} cookie
 * @returns {string}
 */
export function extractUinFromCookie(cookie = "") {
    const text = String(cookie || "");
    const wx = text.match(/(?:^|;)\s*wxuin=(\d+)/);
    if (wx) {
        return wx[1];
    }
    const uin = text.match(/(?:^|;)\s*uin=o?(\d+)/i);
    if (uin) {
        return uin[1];
    }
    return "0";
}

/**
 * 归一化 QQ 音乐图片地址：http→https、//→https://、替换 {size} 等占位符
 * 空值返回 'def'
 * @param {string} url
 * @returns {string}
 */
export function normalizeQqImage(url = "") {
    const value = String(url || "").trim();
    if (!value) {
        return "def";
    }
    let normalized = value;
    if (/^http:\/\//i.test(normalized)) {
        normalized = normalized.replace(/^http:\/\//i, "https://");
    } else if (/^https:\/\//i.test(normalized)) {
        // 保持 https 原样
    } else if (normalized.startsWith("//")) {
        normalized = `https:${normalized}`;
    } else {
        normalized = `https://${normalized}`;
    }
    // 先替换带斜杠的 {size}/（如 {size}/ → 300x300/），再替换剩余 {size}
    normalized = normalized.replace(/\{size\}\//gi, "300x300/");
    normalized = normalized.replace(/\{size\}/gi, "300x300");
    return normalized;
}

/**
 * 生成基础 comm 段
 * @param {string} uin
 * @returns {object}
 */
function buildComm(uin = "0") {
    return {
        cv: 4747474,
        ct: 24,
        format: "json",
        inCharset: "utf-8",
        outCharset: "utf-8",
        notice: 0,
        platform: "yqq.json",
        needNewCode: 1,
        uin: String(uin),
        g_tk_new_20200303: 5381,
        g_tk: 5381,
    };
}

/**
 * spawn 子进程并收集输出（所有脚本一律子进程隔离执行）
 * @param {string} script 脚本绝对路径
 * @param {string[]} args 参数
 * @param {object} options
 * @param {string} [options.input] 写入 stdin 的内容
 * @param {number} [options.timeout] 超时 ms
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function runChild(script, args = [], { input = "", timeout = 20000 } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, ...args], {
            stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            settle(null, new Error(`子进程 ${path.basename(script)} 执行超时(${timeout}ms)`));
        }, timeout);
        const settle = (out, err) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            if (err) {
                reject(err);
            } else {
                resolve(out);
            }
        };
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });
        child.on("error", (err) => settle(null, err));
        child.on("close", (code) => {
            if (code !== 0) {
                settle(null, new Error(`子进程 ${path.basename(script)} 退出码 ${code}${stderr ? `：${stderr.trim()}` : ""}`));
                return;
            }
            settle({ stdout, stderr }, null);
        });
        if (input) {
            child.stdin.write(input);
        }
        child.stdin.end();
    });
}

/**
 * 调用 Qmusic.cjs 计算 sign 与加密请求体
 * @param {object|string} form 业务 JSON 对象或字符串
 * @returns {Promise<{ sign: string, body: string }>}
 */
async function signAndEncrypt(form) {
    const formJson = typeof form === "string" ? form : JSON.stringify(form);
    const { stdout } = await runChild(QMUSIC_CLI, [formJson]);
    const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length < 2) {
        throw new Error(`Qmusic.cjs 输出异常（期望 2 行，实际 ${lines.length} 行）：${stdout.slice(0, 300)}`);
    }
    return { sign: lines[0], body: lines[1] };
}

/**
 * 调用 decrypt-cli.cjs 解密响应密文（base64 输入）
 * @param {string} b64 响应字节的 base64
 * @returns {Promise<object>} 解密后的业务 JSON
 */
async function runDecrypt(b64) {
    const { stdout } = await runChild(DECRYPT_CLI, [], { input: b64 });
    const text = stdout.trim();
    if (!text) {
        throw new Error("decrypt-cli 无输出");
    }
    return JSON.parse(text);
}

/**
 * 发送 musics.fcg 请求（签名 + 加密 + 解密全链路）
 * @param {object|string} form 业务 JSON
 * @param {string} [cookie]
 * @returns {Promise<{ sign: string, json: object }>}
 */
async function musicsCall(form, cookie = "") {
    const { sign, body } = await signAndEncrypt(form);
    const url = `${API}?_=${Date.now()}&encoding=ag-1&sign=${encodeURIComponent(sign)}`;
    const headers = {
        "User-Agent": UA,
        Referer: "https://y.qq.com/",
        Origin: "https://y.qq.com",
        "Content-Type": "text/plain",
        Accept: "application/octet-stream,*/*",
    };
    if (cookie) {
        headers.Cookie = cookie;
    }
    const response = await axios.post(url, body, {
        headers,
        responseType: "arraybuffer",
        timeout: 15000,
    });
    const buffer = Buffer.from(response.data);
    const json = await runDecrypt(buffer.toString("base64"));
    return { sign, json };
}

// ---------------------------------------------------------------------------
// 业务函数
// ---------------------------------------------------------------------------

/**
 * 获取搜索结果列表（DoSearchForQQMusicDesktop）
 * @param {string} keyword 搜索关键词
 * @param {object} [options]
 * @param {string} [options.cookie]
 * @param {number} [options.limit] 每页条数
 * @returns {Promise<Array<{ mid, mediaMid, title, singer, cover, duration, pay }>>}
 */
export async function searchQqMusic(keyword = "", { cookie = "", limit = 10 } = {}) {
    const uin = extractUinFromCookie(cookie);
    const form = {
        comm: buildComm(uin),
        req_1: {
            method: "DoSearchForQQMusicDesktop",
            module: "music.search.SearchCgiService",
            param: {
                remoteplace: "txt.yqq.center",
                searchid: String(Date.now()),
                search_type: 0,
                query: String(keyword),
                page_num: 1,
                num_per_page: limit,
            },
        },
    };
    const { json } = await musicsCall(form, cookie);
    const list = json?.req_1?.data?.body?.song?.list || [];
    return list.map((song) => {
        const album = song.album || {};
        const pmid = album.pmid || album.mid || "";
        const coverUrl = pmid
            ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${pmid}.jpg`
            : "";
        return {
            mid: song.mid || "",
            mediaMid: song.file?.media_mid || song.media_mid || "",
            title: song.title || "",
            singer: (song.singer || [])
                .map((item) => item?.name || "")
                .filter(Boolean)
                .join(" / "),
            cover: normalizeQqImage(coverUrl),
            duration: Number(song.interval) || 0,
            pay: song.pay || {},
        };
    });
}

/**
 * 按 songmid 查询歌曲详情（标题/歌手/专辑封面）
 * 分享链接/卡片解析拿不到封面时补全用；失败返回空对象，不影响主流程
 * @param {string} songMid
 * @param {object} [options]
 * @returns {Promise<{ title: string, singer: string, cover: string }>}
 */
export async function fetchQqSongDetail(songMid = "", options = {}) {
    if (!songMid) {
        return { title: "", singer: "", cover: "" };
    }
    try {
        const url = `https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid=${encodeURIComponent(songMid)}&format=json`;
        const response = await axios.get(url, {
            headers: {
                "User-Agent": UA,
                Referer: "https://y.qq.com/",
                ...(options.cookie ? { Cookie: options.cookie } : {}),
            },
            timeout: 15000,
            validateStatus: () => true,
        });
        if (response.status >= 400) {
            return { title: "", singer: "", cover: "" };
        }
        // 接口可能带 JSONP 前缀，去掉后解析
        const text = typeof response.data === "string"
            ? response.data.replace(/^[^(]*\(|\);?\s*$/g, "")
            : response.data;
        const body = typeof text === "string" ? JSON.parse(text) : text;
        const song = body?.data?.[0] || {};
        const album = song?.album || {};
        const pmid = album.pmid || album.mid || "";
        return {
            title: song?.title || "",
            singer: Array.isArray(song?.singer)
                ? song.singer.map((item) => item?.name || "").filter(Boolean).join(" / ")
                : "",
            cover: pmid
                ? normalizeQqImage(`https://y.gtimg.cn/music/photo_new/T002R300x300M000${pmid}.jpg`)
                : "",
        };
    } catch (error) {
        if (typeof logger !== "undefined") {
            logger.debug?.(`[qqmusic] 歌曲详情获取失败: ${error.message}`);
        }
        return { title: "", singer: "", cover: "" };
    }
}

/**
 * 拼接 CDN 直链（优先 xcdnurl，其次 purl/wifiurl，相对路径用 sip 前缀补全）
 * @param {object} info midurlinfo[0]
 * @param {string[]} sip
 * @returns {string}
 */
function buildPlayUrl(info = {}, sip = []) {
    let url = info.xcdnurl || info.purl || info.wifiurl || "";
    if (!url) {
        return "";
    }
    if (/^https?:/i.test(url)) {
        return url;
    }
    const base = (sip[0] || sip[1] || SPIP_FALLBACK).replace(/\/+$/, "");
    return `${base}/${url.replace(/^\/+/, "")}`;
}

/**
 * 获取单个文件的播放/下载 URL（music.vkey.GetEVkey / GetUrl）
 * @param {string} songMid 歌曲 mid
 * @param {object} [options]
 * @param {string} [options.mediaMid] 媒体 mid，缺省用 songMid
 * @param {string} [options.filename] 期望文件名（如 O400{mediaMid}.ogg），缺省 O400 低码率
 * @param {string} [options.cookie]
 * @param {string} [options.qdesc] 默认 'lq96kOgg'
 * @returns {Promise<{ url, result, filename, info }>}
 */
export async function getQqPlayUrl(
    songMid,
    { mediaMid = "", filename = "", cookie = "", qdesc = DEFAULT_QDESC } = {},
) {
    const uin = extractUinFromCookie(cookie);
    const mm = mediaMid || songMid;
    const fn = filename || `O400${mm}.ogg`;
    const form = {
        comm: buildComm(uin),
        req_1: {
            module: "music.vkey.GetEVkey",
            method: "GetUrl",
            param: {
                guid: GUID,
                songmid: [songMid],
                songtype: [0],
                filename: [fn],
                uin,
                loginflag: 1,
                platform: "20",
                xcdn: 1,
                qdesc,
            },
        },
    };
    let json;
    try {
        ({ json } = await musicsCall(form, cookie));
    } catch (error) {
        // 网络/接口失败不抛出，转成可读结果，由 pickQqPlayUrl 汇总进 warnings
        return {
            url: "",
            result: -1,
            filename: fn,
            info: {},
            error: error.message || String(error),
        };
    }
    const reqData = json?.req_1 || {};
    // 业务层 code 非 0：无音源数据（实测无 Cookie 时 GetEVkey 返回 code=1000）；归一为数字避免字符串 "0" 误判
    const bizCode = Number(reqData.code);
    if (bizCode && bizCode !== 0) {
        // 业务码 1000 = 未登录（2026-10-12 实测：Cookie 过期时必现；换新 Cookie 后同一出口立即恢复正常）
        const msg = bizCode === 1000
            ? "QQ 音乐接口未登录（业务码 1000）：tools.qqMusicCookie 未配置或已失效（登录状态过期），请重新登录 https://y.qq.com 复制最新 Cookie"
            : `QQ 音乐接口返回业务码 ${bizCode}`;
        return { url: "", result: -2, filename: fn, info: {}, error: msg };
    }
    const data = reqData.data || {};
    const info = data.midurlinfo?.[0] || {};
    return {
        url: buildPlayUrl(info, data.sip || []),
        // result 归一为数字：接口偶发返回字符串 "0"，避免 pickQqPlayUrl 的 === 0 严格比较判失败
        result: info.result === undefined ? undefined : Number(info.result),
        filename: info.filename || fn,
        info,
    };
}

// 音质 → 候选文件名前缀顺序（前缀决定码率：O400=低码率OGG、M500=128K、M800=320K、C400=M4A、RS02=试听片段）
const QUALITY_PREFIX_ORDER = {
    auto: ["O400", "M500", "M800", "C400", "RS02"],
    standard: ["O400", "M500", "M800", "C400", "RS02"],
    "128k": ["M500", "M800", "C400", "O400", "RS02"],
    "320k": ["M800", "M500", "C400", "O400", "RS02"],
    m4a: ["C400", "M800", "M500", "O400", "RS02"],
    trial: ["RS02"],
};
const PREFIX_EXT = { O400: "ogg", M500: "mp3", M800: "mp3", C400: "m4a", RS02: "mp3" };

// 文件名前缀 → 面向用户的音质标签（点歌卡片与分享解析共用一份映射）
const FILENAME_QUALITY_LABELS = {
    O400: "低码率OGG",
    M500: "128K",
    M800: "320K",
    C400: "M4A",
    RS02: "试听片段",
};

/**
 * 按 filename 前缀（如 M800xxxx.mp3）取音质标签，未知返回空串
 * @param {string} filename
 * @returns {string}
 */
export function qqQualityLabelFromFilename(filename = "") {
    const fn = String(filename || "").trim().toUpperCase();
    for (const [prefix, label] of Object.entries(FILENAME_QUALITY_LABELS)) {
        if (fn.startsWith(prefix)) {
            return label;
        }
    }
    return "";
}

/**
 * 是否为 60 秒试听片段（RS02）。2026-10-12 实测：本服务器（东京出口）对任何歌曲
 * 都只能拿到 RS02，完整音源被 QQ 音乐按出口地区拒绝（业务码 104003）。
 * @param {string} filename
 * @returns {boolean}
 */
export function isQqTrialFilename(filename = "") {
    return /^RS02/i.test(String(filename || "").trim());
}

/**
 * 归一化音质配置；未知值回退 auto
 * @param {string} [quality]
 * @returns {string}
 */
function normalizeQuality(quality = "") {
    const q = String(quality || "").toLowerCase().trim();
    return QUALITY_PREFIX_ORDER[q] ? q : "auto";
}

/**
 * 按音质生成候选文件名列表（首个为最优先）
 * @param {string} mediaMid
 * @param {string} [quality]
 * @returns {string[]}
 */
function buildCandidates(mediaMid, quality = "") {
    const order = QUALITY_PREFIX_ORDER[normalizeQuality(quality)] || QUALITY_PREFIX_ORDER.auto;
    return order.map(prefix => `${prefix}${mediaMid}.${PREFIX_EXT[prefix]}`);
}

/**
 * 从 filename（如 O400xxxx.ogg）中提取媒体 mid
 * @param {string} filename
 * @returns {string}
 */
export function mediaMidFromFilename(filename = "") {
    const prefixes = Object.keys(PREFIX_EXT)
        .sort((a, b) => b.length - a.length)
        .join("|");
    const match = String(filename).match(new RegExp(`^(?:${prefixes})([A-Za-z0-9]+)\\.\\w+$`, "i"));
    return match ? match[1] : "";
}

function buildResult(result, warnings) {
    return {
        url: result.url,
        result: result.result,
        filename: result.filename,
        info: result.info,
        warnings,
    };
}

/**
 * 依次尝试常见文件名取流，返回第一个 result===0 且有 url 的结果
 * 全部失败返回最后尝试结果 + warnings（含 104003 权益门中文提示）
 * @param {string} songMid
 * @param {object} [options]
 * @param {string} [options.mediaMid] 缺省时先探测默认请求的 filename 反推
 * @param {string} [options.cookie]
 * @returns {Promise<{ url, result, filename, info, warnings }>}
 */
export async function pickQqPlayUrl(songMid, { mediaMid = "", cookie = "", quality = "" } = {}) {
    const warnings = [];
    const useQuality = normalizeQuality(quality);
    let effectiveMediaMid = mediaMid;
    const candidates = [];
    let last = null;

    if (effectiveMediaMid) {
        candidates.push(...buildCandidates(effectiveMediaMid, useQuality));
    } else {
        // mediaMid 未知时先请求一次默认 O400，从返回 filename 反推媒体 mid
        const probe = await getQqPlayUrl(songMid, { cookie });
        last = probe;
        if (probe.result === 0 && probe.url && ["auto", "standard"].includes(useQuality)) {
            return buildResult(probe, warnings);
        }
        if (probe.error) {
            warnings.push(`QQ 音乐接口请求失败：${probe.error}`);
            // 网络层失败说明服务不可达，继续试候选只会重复超时，直接终止
            return buildResult(probe, warnings);
        } else if (probe.result === 104003) {
            warnings.push(`QQ 音乐歌曲 ${songMid} 无试听/下载权益（104003），可能需要 VIP 或存在版权限制`);
        } else if (probe.result !== 0) {
            warnings.push(`QQ 音乐候选 ${probe.filename || "默认"} 返回 result=${probe.result}`);
        }
        effectiveMediaMid = mediaMidFromFilename(probe.filename) || songMid;
        candidates.push(...buildCandidates(effectiveMediaMid, useQuality));
    }

    for (const filename of candidates) {
        const current = await getQqPlayUrl(songMid, {
            mediaMid: effectiveMediaMid,
            filename,
            cookie,
        });
        last = current;
        if (current.result === 0 && current.url) {
            return buildResult(current, warnings);
        }
        if (current.error) {
            warnings.push(`QQ 音乐接口请求失败：${current.error}`);
            break;
        } else if (current.result === 104003) {
            warnings.push(`QQ 音乐歌曲 ${songMid} 无试听/下载权益（104003），可能需要 VIP 或存在版权限制`);
        } else if (current.result !== 0) {
            warnings.push(`QQ 音乐候选 ${filename} 返回 result=${current.result}`);
        }
    }

    if (last) {
        return buildResult(last, warnings);
    }
    return { url: "", result: -1, filename: "", info: {}, warnings: [...warnings, "QQ 音乐取流失败：未获得任何响应"] };
}

// ---------------------------------------------------------------------------
// 分享链接解析
// ---------------------------------------------------------------------------

/**
 * 安全 decodeURIComponent
 * @param {string} value
 * @returns {string}
 */
function safeDecode(value = "") {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/**
 * 从分享链接提取 songMid / mediaMid
 * 支持 i.y.qq.com/v8/playsong.html?songmid=&media_mid=、songDetail/{mid}、m.y.qq.com 等形态
 * @param {string} rawUrl
 * @returns {{ songMid: string, mediaMid: string }}
 */
function parseShareUrl(rawUrl = "") {
    const target = String(rawUrl || "").trim();
    const result = { songMid: "", mediaMid: "" };
    const segments = target.match(/(?:[?&#]|^)(?:songmid|song_mid|songMid|media_mid|mediaMid|mid)=([^&#\s]+)/gi) || [];
    for (const segment of segments) {
        const match = segment.match(/(?:songmid|song_mid|songMid|media_mid|mediaMid|mid)=([^&#\s]+)/i);
        if (!match) {
            continue;
        }
        const value = safeDecode(match[1]);
        const lower = segment.toLowerCase();
        if (lower.includes("media_mid") || lower.includes("mediamid")) {
            result.mediaMid = result.mediaMid || value;
        } else if (lower.includes("songmid") || lower.includes("song_mid")) {
            result.songMid = result.songMid || value;
        } else if (!result.songMid && !result.mediaMid) {
            result.songMid = value;
        }
    }
    if (!result.songMid) {
        const pathMatch = target.match(/\/(?:songDetail|song|singerDetail)\/([A-Za-z0-9]+)/i);
        if (pathMatch) {
            result.songMid = pathMatch[1];
        }
    }
    return result;
}

/**
 * 跟随 HTTP 重定向拿到最终 URL（短链场景）
 * @param {string} url
 * @param {number} [maxRedirects]
 * @returns {Promise<string>}
 */
function followRedirect(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const tryGet = (target, redirects) => {
            let currentUrl;
            try {
                currentUrl = new URL(target);
            } catch (err) {
                reject(new Error(`重定向目标 URL 非法: ${err.message}`));
                return;
            }
            if (!isQqHost(currentUrl.hostname)) {
                reject(new Error(`重定向目标不在 QQ 音乐白名单内: ${currentUrl.hostname}`));
                return;
            }
            const req = https.request(
                currentUrl,
                {
                    method: "GET",
                    headers: { "User-Agent": UA },
                },
                (res) => {
                    if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                        const location = res.headers.location;
                        res.resume();
                        if (!location) {
                            resolve(target);
                            return;
                        }
                        const nextUrl = new URL(location, currentUrl).toString();
                        if (redirects >= maxRedirects) {
                            // 最后一跳返回前同样校验 host，避免把非白名单 URL 交回上层解析
                            try {
                                if (!isQqHost(new URL(nextUrl).hostname)) {
                                    reject(new Error("重定向目标不在 QQ 音乐白名单内"));
                                    return;
                                }
                            } catch (err) {
                                reject(new Error(`重定向目标 URL 非法: ${err.message}`));
                                return;
                            }
                            resolve(nextUrl);
                            return;
                        }
                        tryGet(nextUrl, redirects + 1);
                        return;
                    }
                    res.resume();
                    resolve(target);
                },
            );
            req.setTimeout(10000, () => req.destroy(new Error("重定向请求超时")));
            req.on("error", reject);
            req.end();
        };
        tryGet(url, 0);
    });
}

function emptyShareResult(message, warnings = []) {
    return {
        mid: "",
        mediaMid: "",
        title: "",
        singer: "",
        cover: "def",
        url: "",
        result: -1,
        filename: "",
        warnings: [...warnings, message],
    };
}

/**
 * 解析 QQ 音乐分享链接并取流
 * 支持 playsong.html?songmid=&media_mid=、y.qq.com/n/ryqq/songDetail/{songMid}、
 * i.y.qq.com、m.y.qq.com、c6.y.qq.com 短链（https 跟随重定向）等形态
 * @param {string} url 分享链接
 * @param {object} [options]
 * @param {string} [options.cookie]
 * @returns {Promise<{ mid, mediaMid, title, singer, cover, url, result, filename, warnings }>}
 */
export async function resolveQqShareLink(url = "", { cookie = "", quality = "" } = {}) {
    const warnings = [];
    let target = String(url || "").trim();
    if (!target) {
        return emptyShareResult("QQ 音乐分享链接为空", warnings);
    }

    // 入口 host 白名单校验：非 QQ 音乐域名直接拒绝，不发起任何请求（防 SSRF）
    let parsedEntryHost = "";
    try {
        parsedEntryHost = new URL(target).hostname;
    } catch {
        // 非 URL 形态（纯标题文本等）不在此校验，走搜索分支
    }
    if (parsedEntryHost && !isQqHost(parsedEntryHost)) {
        return emptyShareResult("仅支持解析 QQ 音乐域名（y.qq.com 等）的分享链接");
    }

    if (/c6\.y\.qq\.com\/base\/fcgi-bin\/u\?/i.test(target) || /[?&]__=/.test(target)) {
        try {
            const finalUrl = await followRedirect(target);
            if (finalUrl && finalUrl !== target) {
                target = finalUrl;
            } else {
                warnings.push("QQ 音乐短链未跟随到最终链接，按原链接解析");
            }
        } catch (err) {
            warnings.push(`QQ 音乐短链跟随失败：${err.message}；尝试直接解析`);
        }
    }

    const parsed = parseShareUrl(target);
    const songMid = parsed.songMid || parsed.mediaMid;
    const mediaMid = parsed.mediaMid || "";
    if (!songMid) {
        // 不回显 target，避免泄露内网/非白名单 URL 细节
        return emptyShareResult("QQ 音乐链接无法识别 songmid/media_mid", warnings);
    }

    const picked = await pickQqPlayUrl(songMid, { mediaMid, cookie, quality });
    // 分享链接/卡片解析路径补全歌曲详情（标题/歌手/专辑封面）；失败不影响取流
    const detail = await fetchQqSongDetail(songMid, { cookie });
    return {
        mid: songMid,
        mediaMid,
        title: detail.title || "",
        singer: detail.singer || "",
        cover: detail.cover || "def",
        url: picked.url,
        result: picked.result,
        filename: picked.filename,
        warnings: [...warnings, ...(picked.warnings || [])],
    };
}

// ---------------------------------------------------------------------------
// CLI 冒烟入口
// ---------------------------------------------------------------------------
const IS_CLI =
    process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (IS_CLI) {
    const [, , cmd, arg1, arg2] = process.argv;
    const cookie = process.env.QQ_COOKIE || process.env.COOKIE || "";
    (async () => {
        if (cmd === "search") {
            const keyword = arg1 || "";
            const songs = await searchQqMusic(keyword, { cookie });
            console.log(JSON.stringify({ count: songs.length, songs }, null, 2));
        } else if (cmd === "url") {
            const songMid = arg1;
            const mediaMid = arg2 || "";
            if (!songMid) {
                throw new Error("用法: node utils/qqmusic.js url <songMid> [mediaMid]");
            }
            const result = await getQqPlayUrl(songMid, { mediaMid, cookie });
            console.log(JSON.stringify(result, null, 2));
        } else if (cmd === "share") {
            const link = arg1 || "";
            const result = await resolveQqShareLink(link, { cookie });
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.error("用法: node utils/qqmusic.js <search|url|share> <参数>");
            process.exit(1);
        }
    })().catch((err) => {
        console.error(String((err && err.stack) || err));
        process.exit(1);
    });
}
