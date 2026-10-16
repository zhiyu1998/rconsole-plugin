/**
 * QQ 音乐点歌平台适配器
 * 协议细节复用 utils/qqmusic.js（本地签名/解密引擎），这里只做契约映射
 */
import {
    normalizeQqImage,
    pickQqPlayUrl,
    qqQualityLabelFromFilename,
    searchQqMusic,
} from "../qqmusic.js";
import { createEmptyPlayResult, createSongItem } from "./helpers.js";

/**
 * 按 filename 扩展名映射 audioType：.ogg→ogg、.m4a→m4a、默认 mp3
 * @param {string} filename
 * @returns {string}
 */
function audioTypeFromFilename(filename = "") {
    const fn = String(filename || "");
    if (/\.ogg$/i.test(fn)) {
        return "ogg";
    }
    if (/\.m4a$/i.test(fn)) {
        return "m4a";
    }
    return "mp3";
}

/**
 * @param {object} context
 * @returns {import('./index.js').MusicPlatformAdapter}
 */
export function createQqPlatform(context = {}) {
    const {
        cookie = "",
        quality = "auto",
    } = context;

    async function search(keyword, options = {}) {
        const limit = Number(options.limit) || 10;
        if (!keyword?.trim()) {
            return [];
        }
        const list = await searchQqMusic(keyword, {
            cookie: options.cookie ?? cookie,
            limit,
        });
        return (list || []).map(item => createSongItem({
            platform: "qq",
            sourceType: "song",
            songName: item.title || "",
            singerName: item.singer || "",
            duration: item.duration || "",
            cover: item.cover || "def",
            providerData: {
                id: item.mid || "",
                mediaMid: item.mediaMid || "",
            },
            id: item.mid || "",
        }));
    }

    async function resolve(songItem, options = {}) {
        const mid = songItem?.providerData?.id || songItem?.id;
        const mediaMid = songItem?.providerData?.mediaMid || "";
        if (!mid) {
            return createEmptyPlayResult({
                warnings: ["缺少 QQ 音乐歌曲 mid"],
            });
        }

        let picked;
        try {
            picked = await pickQqPlayUrl(mid, {
                mediaMid,
                cookie: options.cookie ?? cookie,
                quality: options.quality || quality,
            });
        } catch (error) {
            return createEmptyPlayResult({
                cover: normalizeQqImage(songItem?.cover),
                warnings: [`获取 QQ 音乐音源失败: ${error.message}`],
            });
        }

        const url = picked?.url || "";
        const qualityLabel = qqQualityLabelFromFilename(picked?.filename);
        const audioType = audioTypeFromFilename(picked?.filename);
        // 封面优先级：info 封面 → 歌曲封面 → normalizeQqImage 兜底（空值返回 def）
        const rawCover = picked?.info?.cover
            || (songItem?.cover && songItem.cover !== "def" ? songItem.cover : "")
            || "";
        const cover = normalizeQqImage(rawCover);

        const songName = songItem?.songName || "";
        const singerName = songItem?.singerName || "";

        // card 策略：有 mid 且 url 非空时给原生 qq 卡（custom 兜底字段），url 为空则 null
        const card = url
            ? {
                kind: "native",
                platformType: "qq",
                id: mid,
                pageUrl: `https://y.qq.com/n/ryqq/songDetail/${mid}`,
                audioUrl: url,
                title: songName,
                content: singerName ? `${singerName} · QQ音乐` : "QQ音乐",
                image: cover,
                musicType: "custom",
            }
            : null;

        return createEmptyPlayResult({
            url,
            audioType,
            size: "",
            qualityLabel,
            cover,
            tags: ["QQ音乐", qualityLabel].filter(Boolean),
            warnings: picked?.warnings || [],
            card,
        });
    }

    return {
        platform: "qq",
        displayName: "QQ音乐",
        supportsContentType(contentType) {
            // QQ 音乐暂不支持播客
            return !["2", "podcast"].includes(String(contentType || "1"));
        },
        search,
        resolve,
    };
}
