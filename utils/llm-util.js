import { retryFetch } from "./common.js";
import { COMMON_USER_AGENT } from "../constants/constant.js";

function decodeHtmlEntities(text = "") {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

function stripHtmlToText(html = "") {
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
    const cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<template[\s\S]*?<\/template>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const decodedTitle = decodeHtmlEntities(title).replace(/\s+/g, " ").trim();
    const decodedText = decodeHtmlEntities(cleaned);

    if (!decodedTitle) {
        return decodedText;
    }

    return `Title: ${decodedTitle}\n\n${decodedText}`;
}

/**
 * LLM 爬虫
 * @param summaryLink
 * @returns {Promise<string>}
 */
export async function llmRead(summaryLink) {
    let normalizedUrl;
    try {
        normalizedUrl = new URL(summaryLink.trim());
    } catch (error) {
        throw new Error("链接格式无效，无法抓取网页内容");
    }

    if (!["http:", "https:"].includes(normalizedUrl.protocol)) {
        throw new Error("仅支持抓取 http/https 链接");
    }

    const response = await retryFetch(normalizedUrl.toString(), {
        headers: {
            "User-Agent": COMMON_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    });

    const raw = await response.text();
    const content = stripHtmlToText(raw);

    if (!content) {
        throw new Error("网页正文为空或提取失败");
    }

    // 防止超长文本导致后续模型上下文爆炸
    return content.slice(0, 50000);
}
