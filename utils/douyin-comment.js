import axios from "axios";
import { COMMON_USER_AGENT, REDIS_YUNZAI_DOUYIN_EMOJI_CACHE } from "../constants/constant.js";
import { DY_COMMENT, DY_EMOJI_LIST } from "../constants/tools.js";
import { redisExistAndGetKey, redisSetKey } from "./redis-util.js";
import * as aBogus from "./a-bogus.cjs";

function getImageUrlFromObject(imageObj = {}) {
    return imageObj?.url_list?.[0]
        || imageObj?.urlList?.[0]
        || imageObj?.url
        || imageObj?.uri
        || imageObj?.uri_list?.[0]
        || imageObj?.url?.url_list?.[0]
        || imageObj?.image?.url_list?.[0]
        || "";
}

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

function formatCountText(count = 0, label = "") {
    const text = formatInteractionCount(count);
    return label ? `${text}${label}` : text;
}

function getCommentLimit(value) {
    const limit = Number(value);
    return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
}

function getDefaultCommentAvatar(platform) {
    const iconMap = {
        douyin: "tiktok.png",
        bili: "bilibili.png",
    };
    return `${process.cwd()}/plugins/rconsole-plugin/resources/img/icon/${iconMap[platform] || "pic1.png"}`;
}

function normalizeCommentText(text = "") {
    return String(text)
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function getDouyinCommentImage(comment = {}) {
    return normalizeRenderImageUrl(
        getImageUrlFromObject(comment?.image_list?.[0]?.origin_url)
        || getImageUrlFromObject(comment?.image_list?.[0]?.url)
        || getImageUrlFromObject(comment?.image_list?.[0])
        || getImageUrlFromObject(comment?.images?.[0])
        || getImageUrlFromObject(comment?.pic_list?.[0])
        || getImageUrlFromObject(comment?.picList?.[0])
        || getImageUrlFromObject(comment?.image_urls?.[0])
        || getImageUrlFromObject(comment?.imageUrlList?.[0])
        || ""
    );
}

function getDouyinStickerImage(comment = {}) {
    return normalizeRenderImageUrl(
        getImageUrlFromObject(comment?.sticker?.static_url)
        || getImageUrlFromObject(comment?.sticker?.animate_url)
        || comment?.sticker?.static_url?.uri
        || comment?.sticker?.animate_url?.uri
        || comment?.sticker?.static_url?.url
        || comment?.sticker?.animate_url?.url
        || comment?.sticker?.static_url?.image?.url_list?.[0]
        || comment?.sticker?.animate_url?.image?.url_list?.[0]
        || comment?.sticker?.animate_url?.url
        || ""
    );
}

function getDouyinEmoteMap(comment = {}, emojiMap = {}) {
    const emoteMap = {
        ...emojiMap,
    };
    const candidates = [
        ...(comment?.emoji || []),
        ...(comment?.text_extra || []),
        ...(comment?.emoji_list || []),
        ...(comment?.emojis || []),
    ];

    for (const extra of candidates) {
        const key = extra?.display_name || extra?.hashtag_name || extra?.emoji_name || extra?.text || extra?.name;
        const keyText = typeof key === "string" ? key : "";
        const wrappedKey = keyText && keyText.startsWith("[") ? keyText : keyText ? `[${keyText}]` : "";
        const url = getImageUrlFromObject(extra?.emoji_url)
            || getImageUrlFromObject(extra?.image_url)
            || getImageUrlFromObject(extra?.icon_url)
            || getImageUrlFromObject(extra?.image)
            || getImageUrlFromObject(extra?.emoji)
            || getImageUrlFromObject(extra?.icon)
            || getImageUrlFromObject(extra?.sticker)
            || extra?.url
            || extra?.uri
            || "";
        if (wrappedKey && url) {
            emoteMap[wrappedKey] = { url: normalizeRenderImageUrl(url) };
        }
    }
    return emoteMap;
}

function normalizeDouyinRichText(text = "", emoteMap = {}) {
    const normalizedText = normalizeCommentText(text);
    if (!normalizedText) {
        return [];
    }

    const richText = [];
    const emoteEntries = Object.entries(emoteMap || {})
        .filter(([, value]) => value?.url)
        .sort((a, b) => b[0].length - a[0].length);
    const douyinEmoteReg = /\[[^\]\n]{1,32}\]/g;
    let lastIndex = 0;
    for (const match of normalizedText.matchAll(douyinEmoteReg)) {
        if (match.index > lastIndex) {
            richText.push({ type: "text", text: normalizedText.slice(lastIndex, match.index) });
        }
        const matchedKey = emoteEntries.find(([key]) => key === match[0] || key === match[0].trim());
        if (matchedKey) {
            richText.push({ type: "emote", text: match[0], url: matchedKey[1].url });
        } else {
            richText.push({ type: "emoji-text", text: match[0] });
        }
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < normalizedText.length) {
        richText.push({ type: "text", text: normalizedText.slice(lastIndex) });
    }
    return richText;
}

function buildDouyinCommentContent(comment = {}, emojiMap = {}) {
    const text = typeof comment.text === "string" ? comment.text : "";
    const stickerImage = getDouyinStickerImage(comment);
    const emoteMap = getDouyinEmoteMap(comment, emojiMap);
    const content = normalizeDouyinRichText(text, emoteMap);
    if (content.length === 0 && !stickerImage) {
        return {
            content: [],
            image: getDouyinCommentImage(comment),
            stickerImage: "",
        };
    }

    return {
        content,
        image: getDouyinCommentImage(comment),
        stickerImage,
    };
}

function normalizeDouyinReplyComment(item = {}, emojiMap = {}, formatCommentTime = () => "") {
    const emoteMap = {
        ...emojiMap,
        ...getDouyinEmoteMap(item, emojiMap),
    };
    const content = normalizeDouyinRichText(item?.text, emoteMap);
    const stickerImage = getDouyinStickerImage(item);
    if (content.length === 0 && !stickerImage) {
        return null;
    }
    const replyItem = Array.isArray(item?.reply_comment) ? item.reply_comment[0] : item?.reply_comment;
    return {
        nickname: item.user?.nickname || "抖音用户",
        avatar: normalizeRenderImageUrl(item.user?.avatar_thumb?.url_list?.[0] || item.user?.avatar_medium?.url_list?.[0] || ""),
        content,
        image: getDouyinCommentImage(item),
        stickerImage,
        time: item.create_time ? formatCommentTime(item.create_time) : "",
        location: item.ip_label || "",
        likeText: formatCountText(item.digg_count || 0, "赞"),
        replyText: formatCountText(item.reply_comment_total || 0, "回复"),
        replyComment: replyItem ? normalizeDouyinReplyComment(replyItem, emojiMap, formatCommentTime) : null,
        reply: replyItem?.text ? normalizeDouyinRichText(`热门回复：${replyItem.text}`, {
            ...emojiMap,
            ...getDouyinEmoteMap(replyItem, emojiMap),
        }) : [],
    };
}

export async function fetchDouyinComments(douId, headers) {
    const dyCommentUrl = DY_COMMENT.replace("{}", douId);
    const abParam = aBogus.generate_a_bogus(
        new URLSearchParams(new URL(dyCommentUrl).search).toString(),
        headers["User-Agent"],
    );
    const commentsResp = await axios.get(`${dyCommentUrl}&a_bogus=${abParam}`, {
        headers: {
            ...headers,
            Referer: headers.Referer || "https://www.douyin.com/",
        }
    });

    const data = commentsResp.data || {};
    const comments = data.comments || data.data?.comments || [];
    return {
        comments,
        cursor: data.cursor ?? data.data?.cursor ?? 0,
        has_more: data.has_more ?? data.data?.has_more ?? 0,
        total: data.total ?? data.data?.total ?? comments.length,
        raw: data,
    };
}

export async function fetchDouyinEmojiMap(headers = {}, cache = {}) {
    const now = Date.now();
    if (cache.emojiMap && cache.expireAt > now) {
        return {
            emojiMap: cache.emojiMap,
            expireAt: cache.expireAt,
        };
    }

    const abParam = aBogus.generate_a_bogus(
        new URLSearchParams(new URL(DY_EMOJI_LIST).search).toString(),
        headers["User-Agent"] || COMMON_USER_AGENT,
    );
    const resp = await axios.get(`${DY_EMOJI_LIST}&a_bogus=${abParam}`, { headers });
    const emojiList = resp.data?.emoji_list || [];
    const emojiMap = {};
    for (const item of emojiList) {
        const key = item?.display_name || item?.emoji_name || item?.name || item?.text;
        const keyText = typeof key === "string" ? key : "";
        const url = getImageUrlFromObject(item?.emoji_url);
        if (keyText && url) {
            const wrappedKey = keyText.startsWith("[") ? keyText : `[${keyText}]`;
            emojiMap[wrappedKey] = { url: normalizeRenderImageUrl(url) };
        }
    }

    return {
        emojiMap,
        expireAt: now + 6 * 60 * 60 * 1000,
    };
}

export async function getDouyinEmojiMap(headers = {}) {
    const now = Date.now();
    const cacheData = await redisExistAndGetKey(REDIS_YUNZAI_DOUYIN_EMOJI_CACHE);
    if (cacheData?.emojiMap && cacheData?.expireAt > now) {
        return cacheData.emojiMap;
    }

    try {
        const { emojiMap, expireAt } = await fetchDouyinEmojiMap(headers, {
            emojiMap: cacheData?.emojiMap,
            expireAt: cacheData?.expireAt,
        });
        await redisSetKey(REDIS_YUNZAI_DOUYIN_EMOJI_CACHE, {
            emojiMap,
            expireAt,
        });
        return emojiMap;
    } catch (err) {
        await redisSetKey(REDIS_YUNZAI_DOUYIN_EMOJI_CACHE, {
            emojiMap: {},
            expireAt: now + 10 * 60 * 1000,
        });
        throw err;
    }
}

export function buildDouyinCommentRenderData(commentResp, comments, emojiMap = {}, options = {}) {
    const displayComments = comments.slice(0, 10);
    const firstComment = displayComments[0] || {};
    const cover = firstComment?.video?.cover?.url_list?.[0]
        || firstComment?.author?.avatar_thumb?.url_list?.[0]
        || firstComment?.user?.avatar_thumb?.url_list?.[0]
        || "";
    const formatCommentTime = typeof options.formatCommentTime === "function" ? options.formatCommentTime : (() => "");

    return {
        title: "抖音评论",
        platform: "douyin",
        platformName: "抖音",
        workTitle: "抖音作品评论",
        subtitle: `展示 ${Math.min(displayComments.length, getCommentLimit(options.commentLimit))} 条`,
        platformIcon: options.platformIcon || getDefaultCommentAvatar("douyin"),
        cover: normalizeRenderImageUrl(cover),
        commentCountText: `${formatInteractionCount(commentResp?.total || comments.length)} 条评论`,
        footer: {
            botName: "R插件",
            pluginName: "douyinComment",
        },
        footerText: commentResp?.has_more ? "仅展示第一页评论" : "",
        comments: displayComments.map(item => {
            const commentContent = buildDouyinCommentContent(item, emojiMap);
            const replyItem = Array.isArray(item?.reply_comment) ? item.reply_comment[0] : item?.reply_comment;
            return {
                nickname: item.user?.nickname || "抖音用户",
                avatar: normalizeRenderImageUrl(item.user?.avatar_thumb?.url_list?.[0] || item.user?.avatar_medium?.url_list?.[0] || ""),
                content: normalizeDouyinRichText(item.text || "", getDouyinEmoteMap(item, emojiMap)),
                ...commentContent,
                time: item.create_time ? formatCommentTime(item.create_time) : "",
                likeCountText: formatInteractionCount(item.digg_count || 0),
                replyCountText: formatInteractionCount(item.reply_comment_total || 0),
                location: item.ip_label || "",
                actionMeta: [item.create_time ? formatCommentTime(item.create_time) : "", item.ip_label || ""].filter(Boolean).join(" · "),
                image: commentContent.image || "",
                replyComment: replyItem ? normalizeDouyinReplyComment(replyItem, emojiMap, formatCommentTime) : null,
                reply: replyItem?.text ? normalizeDouyinRichText(`热门回复：${replyItem.text}`, {
                    ...emojiMap,
                    ...getDouyinEmoteMap(replyItem, emojiMap)
                }) : [],
            };
        }),
    };
}
