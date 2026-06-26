import axios from "axios";
import _ from "lodash";
import { BILI_REPLY_PAGE, BILI_REPLY_WBI_MAIN } from "../constants/tools.js";
import { BILI_HEADER } from "./bilibili.js";
import { getWbi } from "./biliWbi.js";

function normalizeRenderImageUrl(url = "") {
    if (!url || typeof url !== "string") {
        return "";
    }
    let normalized = url.trim().replace(/\\/g, "");
    if (normalized.startsWith("//")) {
        normalized = `https:${normalized}`;
    }
    return normalized.replace(/^http:\/\//i, "https://");
}

function formatInteractionCount(count = 0) {
    const num = Number(count) || 0;
    if (num >= 100000000) {
        return `${(num / 100000000).toFixed(1).replace(/\.0$/, "")}亿`;
    }
    if (num >= 10000) {
        return `${(num / 10000).toFixed(1).replace(/\.0$/, "")}万`;
    }
    return `${num}`;
}

function getCommentLimit(value) {
    const limit = Number(value);
    return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
}

function getDefaultCommentAvatar() {
    return `${process.cwd()}/plugins/rconsole-plugin/resources/img/icon/bilibili.png`;
}

function getBiliPlatformIcon() {
    return getDefaultCommentAvatar();
}

function normalizeCommentText(text = "") {
    return String(text)
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function decodeBiliCommentText(text = "") {
    return String(text).replace(/&amp;?/g, "&");
}

function pushBiliTextParts(richText, textPart = "") {
    const lines = textPart.split("\n");
    lines.forEach((line, lineIndex) => {
        if (line) {
            richText.push({ type: "text", text: line });
        }
        if (lineIndex < lines.length - 1) {
            richText.push({ type: "line-break" });
        }
    });
}

function buildBiliHighlightEntries(content = {}) {
    const atEntries = Object.keys(content?.at_name_to_mid || {})
        .filter(name => name)
        .map(name => decodeBiliCommentText(name))
        .filter(name => name)
        .map(name => ({
            key: `@${name}`,
            text: `@${name}`,
        }));

    const jumpEntries = Object.entries(content?.jump_url || {})
        .map(([url, detail]) => {
            const key = decodeBiliCommentText(url);
            const title = String(detail?.title || "").trim();
            return key && title ? { key, text: title } : null;
        })
        .filter(Boolean);

    return [...jumpEntries, ...atEntries]
        .sort((a, b) => b.key.length - a.key.length);
}

function getFullUrlLength(text = "", start = 0, minLength = 0) {
    const fullUrl = text.slice(start).match(/^https?:\/\/[^\s]+/i)?.[0] || "";
    return Math.max(minLength, fullUrl.length);
}

function normalizeCommentRichText(content = {}, emotes = {}) {
    const rawText = typeof content === "object" ? content?.message : content;
    const normalizedText = normalizeCommentText(decodeBiliCommentText(rawText));
    if (!normalizedText) {
        return [];
    }

    const richText = [];
    const hasInputEmotes = emotes && Object.keys(emotes).length > 0;
    const contentEmotes = hasInputEmotes ? emotes : (typeof content === "object" ? content?.emote : {});
    const emoteEntries = Object.entries(contentEmotes || {})
        .map(([key, value]) => ({
            key,
            url: normalizeRenderImageUrl(value?.url || value?.gif_url || value?.webp_url || value?.img_url || value?.image_url || value?.uri || "")
        }))
        .filter(item => item.key && item.url)
        .sort((a, b) => b.key.length - a.key.length);
    const highlightEntries = buildBiliHighlightEntries(typeof content === "object" ? content : {});

    for (let index = 0; index < normalizedText.length;) {
        const matched = emoteEntries.find(item => normalizedText.startsWith(item.key, index));
        if (matched) {
            richText.push({ type: "emote", text: matched.key, url: matched.url });
            index += matched.key.length;
            continue;
        }

        const highlighted = highlightEntries.find(item => normalizedText.startsWith(item.key, index));
        if (highlighted) {
            richText.push({ type: "highlight", text: highlighted.text });
            index += getFullUrlLength(normalizedText, index, highlighted.key.length);
            continue;
        }

        const nextIndexList = emoteEntries
            .map(item => normalizedText.indexOf(item.key, index))
            .concat(highlightEntries.map(item => normalizedText.indexOf(item.key, index)))
            .filter(nextIndex => nextIndex >= 0);
        const nextIndex = nextIndexList.length > 0 ? Math.min(...nextIndexList) : normalizedText.length;
        pushBiliTextParts(richText, normalizedText.slice(index, nextIndex));
        index = nextIndex;
    }
    return richText;
}

function normalizeBiliColor(color) {
    if (typeof color === "number" && Number.isFinite(color)) {
        const value = Math.trunc(color);
        if (value === 0) {
            return "";
        }
        if (value >= 0 && value <= 0xffffff) {
            return `#${value.toString(16).padStart(6, "0")}`;
        }
        if (value >= 0 && value <= 0xffffffff) {
            return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
        }
        return "";
    }

    const value = String(color || "").trim();
    if (!value || value === "0") {
        return "";
    }
    if (/^\d{1,10}$/.test(value) && value.length !== 6) {
        const numberColor = Number(value);
        if (Number.isFinite(numberColor)) {
            return normalizeBiliColor(numberColor);
        }
    }
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) {
        return value.slice(0, 7);
    }
    if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) {
        return `#${value.slice(0, 6)}`;
    }
    return "";
}

function getBiliNicknameColor(item = {}) {
    return normalizeBiliColor(
        item?.member?.vip?.nickname_color ||
        item?.member?.nameplate?.nickname_color ||
        ""
    );
}

function getBiliFanMedal(item = {}) {
    const detail = item?.member?.fans_detail || null;
    if (!detail || typeof detail !== "object") {
        return null;
    }

    const name = String(detail.medal_name || detail.name || detail.medalName || "").trim();
    if (!name) {
        return null;
    }

    const level = Number(detail.level ?? detail.medal_level ?? detail.fans_level);
    const color = normalizeBiliColor(
        detail.medal_color ??
        detail.medal_color_start ??
        detail.color ??
        detail.background_color
    );
    const nameColor = normalizeBiliColor(detail.medal_color_name);
    const levelColor = normalizeBiliColor(
        detail.medal_color_level ??
        detail.level_color ??
        detail.medal_color
    );
    const levelBgColor = normalizeBiliColor(
        detail.medal_level_bg_color ??
        detail.medal_color_end ??
        ""
    );
    const borderColor = normalizeBiliColor(
        detail.medal_color_border ??
        detail.border_color ??
        detail.medal_color ??
        detail.color
    );
    const style = [
        color ? `--fan-medal-bg: ${color}` : "",
        nameColor ? `--fan-medal-name: ${nameColor}` : "",
        levelColor ? `--fan-medal-level: ${levelColor}` : "",
        levelBgColor ? `--fan-medal-level-bg: ${levelBgColor}` : "",
        borderColor ? `--fan-medal-border: ${borderColor}` : ""
    ].filter(Boolean).join("; ");

    return {
        name,
        level: Number.isFinite(level) && level > 0 ? Math.floor(level) : "",
        color,
        nameColor,
        levelColor,
        levelBgColor,
        borderColor,
        style
    };
}

function getBiliCommentDecor(item = {}) {
    const cardBg = [
        item?.member?.user_sailing_v2?.card_bg,
        item?.member?.user_sailing_v2?.card_bg_with_focus,
        item?.member?.user_sailing_v2?.collect_card,
        item?.member?.user_sailing_v2?.cardbg,
        item?.member?.user_sailing?.cardbg_with_focus,
        item?.member?.user_sailing?.cardbg,
        item?.member?.user_sailing?.collect_card,
        item?.member?.user_sailing?.card_bg,
        item?.member_sailing?.cardbg_with_focus,
        item?.member_sailing?.cardbg,
        item?.member_sailing?.collect_card,
        item?.member_sailing?.card_bg,
    ].filter(candidate => candidate && typeof candidate === "object");

    for (const candidate of cardBg) {
        const image = normalizeRenderImageUrl(candidate.image || candidate.image_enhance || "");
        const fan = candidate.fan || {};
        const number = fan.num_desc || (fan.number ? String(fan.number).padStart(6, "0") : "");
        const prefix = fan.num_prefix || (number ? "NO." : "");
        const text = number ? `${prefix}${number}` : "";
        const color = normalizeBiliColor(fan.color || fan.color_format?.colors?.[0] || "");
        if (image || text) {
            return { image, prefix, number, text, color };
        }
    }
    return null;
}

function isBiliUpComment(item = {}, ownerMid = "", isSubReply = false) {
    if (!ownerMid) {
        return isSubReply && Boolean(item?.reply_control?.up_reply);
    }
    const commentMid = item?.mid || item?.mid_str || item?.member?.mid || item?.member?.mid_str || "";
    if (String(commentMid) === String(ownerMid)) {
        return true;
    }
    return isSubReply && Boolean(item?.reply_control?.up_reply);
}

function isBiliUpLikedComment(item = {}) {
    return Boolean(item?.up_action?.like || item?.reply_control?.up_like);
}

function isBiliPinnedComment(item = {}) {
    return Boolean(item?.reply_control?.is_up_top || item?.reply_control?.is_top || item?.is_top);
}

function buildBiliMetaItems(item = {}) {
    return [
        item.reply_control?.up_reply ? "UP主回复" : "",
        item.reply_control?.sub_reply_entry_text || "",
    ].filter(Boolean);
}

function normalizeBiliReplyComment(item = {}, options = {}) {
    if (!item?.content?.message) {
        return null;
    }
    const content = normalizeCommentRichText(item.content);
    if (content.length === 0) {
        return null;
    }
    const formatCommentTime = typeof options.formatCommentTime === "function" ? options.formatCommentTime : (() => "");
    const ownerMid = options.ownerMid || "";
    const level = Number(item.member?.level_info?.current_level);
    const time = item.ctime ? formatCommentTime(item.ctime) : "";
    const location = item.reply_control?.location?.replace(/^IP属地：?/, "") || "";
    const isUp = isBiliUpComment(item, ownerMid, true);
    return {
        nickname: item.member?.uname || "B站用户",
        avatar: normalizeRenderImageUrl(item.member?.avatar || "") || getDefaultCommentAvatar(),
        nicknameColor: getBiliNicknameColor(item),
        content,
        time,
        location,
        level: Number.isFinite(level) ? level : null,
        isSeniorMember: Boolean(item.member?.is_senior_member || Number(item.member?.senior?.status) > 0),
        fanMedal: isUp ? null : getBiliFanMedal(item),
        isUp,
        actionMeta: [time, location].filter(Boolean).join(" · "),
        upLikeText: isBiliUpLikedComment(item) ? "UP主觉得很赞" : "",
        likeCountText: formatInteractionCount(item.like || 0),
        replyText: "回复"
    };
}

function normalizeBiliComment(item = {}, options = {}) {
    const content = normalizeCommentRichText(item?.content);
    if (content.length === 0) {
        return null;
    }
    const formatCommentTime = typeof options.formatCommentTime === "function" ? options.formatCommentTime : (() => "");
    const ownerMid = options.ownerMid || "";
    const replyItem = item.replies?.[0];
    const replyComment = normalizeBiliReplyComment(replyItem, options);
    const level = Number(item.member?.level_info?.current_level);
    const time = item.ctime ? formatCommentTime(item.ctime) : "";
    const location = item.reply_control?.location?.replace(/^IP属地：?/, "") || "";
    const replyCount = Number(item.rcount) || 0;
    const isUp = isBiliUpComment(item, ownerMid);
    return {
        nickname: item.member?.uname || "B站用户",
        avatar: normalizeRenderImageUrl(item.member?.avatar || "") || getDefaultCommentAvatar(),
        nicknameColor: getBiliNicknameColor(item),
        content,
        image: normalizeRenderImageUrl(item.content?.pictures?.[0]?.img_src || ""),
        time,
        location,
        level: Number.isFinite(level) ? level : null,
        isSeniorMember: Boolean(item.member?.is_senior_member || Number(item.member?.senior?.status) > 0),
        fanMedal: isUp ? null : getBiliFanMedal(item),
        isUp,
        decor: getBiliCommentDecor(item),
        pinnedText: isBiliPinnedComment(item) ? "置顶" : "",
        metaItems: buildBiliMetaItems(item),
        actionMeta: [time, location].filter(Boolean).join(" · "),
        upLikeText: isBiliUpLikedComment(item) ? "UP主觉得很赞" : "",
        likeCountText: formatInteractionCount(item.like || 0),
        replyCountText: formatInteractionCount(replyCount),
        replyText: replyCount > 0 ? `回复 ${formatInteractionCount(replyCount)}` : "回复",
        replyComment
    };
}

function dedupeBiliReplies(replies = []) {
    const commentMap = new Map();
    for (const item of replies) {
        if (item?.rpid && !commentMap.has(item.rpid)) {
            commentMap.set(item.rpid, item);
        }
    }
    return [...commentMap.values()];
}

function extractRepliesFromResp(resp = {}) {
    return [
        ...(resp.data?.data?.hots || []),
        ...(resp.data?.data?.top_replies || []),
        ...(resp.data?.data?.replies || [])
    ];
}

async function requestBiliReplyWbi(oid, limit, headers, sessData) {
    const wbiQuery = await getWbi({
        type: 1,
        oid,
        mode: 3,
        next: 0,
        ps: limit
    }, sessData);
    return axios.get(`${BILI_REPLY_WBI_MAIN}?${wbiQuery}`, { headers });
}

async function requestBiliReplyPage(oid, limit, headers) {
    const commentUrl = BILI_REPLY_PAGE
        .replace("{oid}", oid)
        .replace("{ps}", limit);
    return axios.get(commentUrl, { headers });
}

export async function fetchBiliComments(oid, options = {}) {
    const limit = getCommentLimit(options.commentLimit);
    const sessData = options.sessData || "";
    const headers = { ...BILI_HEADER };
    if (!_.isEmpty(sessData)) {
        headers.Cookie = `SESSDATA=${sessData}`;
    }

    let resp;
    let wbiError = null;
    try {
        resp = await requestBiliReplyWbi(oid, limit, headers, sessData);
    } catch (err) {
        wbiError = err;
    }

    if (resp && resp.data?.code !== 0) {
        wbiError = new Error(`code=${resp.data?.code}, message=${resp.data?.message}`);
    }
    if (!resp || resp.data?.code !== 0) {
        if (wbiError) {
            logger.warn(`[R插件][B站评论] WBI接口获取失败，尝试经典接口: ${wbiError.message}`);
        }
        resp = await requestBiliReplyPage(oid, limit, headers);
    }
    if (resp.data?.code !== 0) {
        throw new Error(`code=${resp.data?.code}, message=${resp.data?.message}`);
    }

    const replies = dedupeBiliReplies(extractRepliesFromResp(resp));
    return {
        replies,
        ownerMid: options.ownerMid || resp.data?.data?.upper?.mid || "",
        total: resp.data?.data?.page?.count || resp.data?.data?.cursor?.all_count || replies.length,
        raw: resp.data,
    };
}

export function buildBiliCommentRenderData(commentResp, comments, options = {}) {
    const commentLimit = getCommentLimit(options.commentLimit);
    const displayComments = comments.slice(0, commentLimit);
    const formatCommentTime = typeof options.formatCommentTime === "function" ? options.formatCommentTime : (() => "");

    return {
        title: "视频评论",
        platform: "bili",
        platformName: "B站",
        platformIcon: getBiliPlatformIcon(),
        workTitle: options.title || "B站视频",
        subtitle: `展示 ${Math.min(displayComments.length, commentLimit)} 条`,
        cover: normalizeRenderImageUrl(options.cover || ""),
        commentCountText: `${formatInteractionCount(commentResp?.total || comments.length)} 条评论`,
        footerText: commentResp?.replies?.length > displayComments.length ? "仅展示部分热门评论" : "",
        footer: {
            botName: "R插件",
            pluginName: "biliComment",
        },
        comments: displayComments
            .map(item => normalizeBiliComment(item, {
                ownerMid: options.ownerMid || commentResp?.ownerMid || "",
                formatCommentTime,
            }))
            .filter(Boolean),
    };
}
