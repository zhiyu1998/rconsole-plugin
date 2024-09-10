import { PearAPI_CRAWLER, PearAPI_DEEPSEEK } from "../constants/tools.js";

/**
 * LLM 爬虫
 * @param summaryLink
 * @returns {Promise<string>}
 */
export async function llmRead(summaryLink) {
    const llmCrawler = await fetch(PearAPI_CRAWLER.replace("{}", summaryLink));
    return (await llmCrawler.json())?.data;
}

/**
 * DeepSeek对话
 * @param content
 * @param prompt
 * @returns {Promise<string>}
 */
export async function deepSeekChat(content, prompt) {
    const deepseekFreeSummary = await fetch(PearAPI_DEEPSEEK, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            "messages": [
                {
                    "role": "system",
                    "content": prompt
                },
                {
                    "role": "user",
                    "content": content,
                }]
        }),
    });
    return (await deepseekFreeSummary.json())?.message;
}
