/**
 * 用于百度翻译的常量控制
 *
 * @type {{英: string, 日: string, 文: string, 中: string}}
 */
export const transMap = { 中: "zh", 日: "jp", 文: "wyw", 英: "en", 俄: "ru", 韩: "kr" };
/**
 * 用于腾讯交互式翻译的常量控制
 *
 * @type {{英: string, 俄: string, 日: string, 韩: string, 中: string}}
 */
export const tencentTransMap = { 中: "zh", 日: "ja", 韩: "ko", 英: "en", 俄: "ru" };
/**
 * 用于腾讯交互式翻译的常量控制
 *
 * @type {{英: string, 俄: string, 日: string, 韩: string, 中: string}}
 */
export const googleTransMap = { 中: "zh-CN", 日: "jp", 韩: "ko", 英: "en", 俄: "ru" };

/**
 * 以下为抖音/TikTok类型代码
 *
 * @type {{"0": string, "55": string, "2": string, "68": string, "58": string, "4": string, "61": string, "51": string, "150": string}}
 */
export const douyinTypeMap = {
    2: "image",
    4: "video",
    68: "image",
    0: "video",
    51: "video",
    55: "video",
    58: "video",
    61: "video",
    150: "image",
};

export const PROMPT_MAP = {
    "解决": "You are now a programmer, the following is an error, please tell me how to solve this error in Chinese. ",
    "解释": "You are now a programming language expert, please tell me what the following code is doing in Chinese. ",
    "优化": "You are now a Clean Code expert. I have the following code. Please rewrite it in a cleaner and simpler way to make it easier for my colleagues to maintain the code. Also, explain in Chinese why you want to refactor like this, so I can add the refactor method description to the Pull Request. Attach code ",
    "翻译": "I want you to act as an Chinese translator, spelling corrector and improver. I will speak to you in any language and you will detect the language, translate it and answer in the corrected and improved version of my text, in English. I want you to replace my simplified A0-level words and sentences with more beautiful and elegant, upper level English words and sentences. Keep the meaning same, but make them more literary. I want you to only reply the correction, the improvements, then result of Chinese translation and nothing else, do not write explanations. My first sentence is ",
    "面试": "For the following interview questions, please provide in Chinese what you think is correct and common, and ask some common interview questions? ",
    "百科": "I want you to act as a Wikipedia page. I will give you the name of a topic, and you will provide a summary in Chinese of that topic in the format of a Wikipedia page. Your summary should be informative and factual, covering the most important aspects of the topic. Start your summary with an introductory paragraph that gives an overview of the topic. My first topic is ",
    "单词": "Below is a foreign language article. You will extract key words from the article and summarize these words into Chinese translations, definitions and a full explanation of an example sentence. Please check that all information is accurate and keep your answers concise without any additional feedback: ",
    "": "Summarize the key points of this article in Chinese and in a list of points. Choose an appropriate emoji for each bullet point. Each bullet point format is [emoji] - [text]."
}

export const TEN_THOUSAND = 10000;

export const CAT_LIMIT = 10;

export const XHS_CK = 'eGhzVHJhY2tlcklkPTczODhhYmY2LTI0MDgtNGU5YS04MTUyLTE0MGVhOGY1MTQ5ZjsgeGhzVHJhY2tlcklkLnNpZz1UcGUxTkNaX3B3UkFYdG01SVJmVEs0SWUxM0xBaGZuNmNZU2N4Vi1JYWxFOyBhMT0xODY2ZDkwMDM0NmI2NmppcjMzcGpxZ2MwM3JvcG1mczAydXMxdWNoeDEwMDAwMTM1MDUzOyB3ZWJJZD1mMTNkOGJkYjhiZGM3ZGE0MzY0NjA4NWJjYzQ1MDQ1YTsgZ2lkPXlZS0tmajg4SzA4MnlZS0tmajg4cUo3UzRLREtLVjNGcXFVVjd4Q0FrUzhxRk15OGxVNmlNeTg4OHlxMjgycThmMlk0UzAySjsgZ2lkLnNpZ249YlpzcFFzSUxEUmN5akZLQmN2L1FMWVhkU3lvPTsgd2ViX3Nlc3Npb249MDMwMDM3YTRjMDQyYjE1ZTVjMTg4OTUwOGIyNDRhZDExM2UwNTM7IHhoc1RyYWNrZXI9dXJsPW5vdGVEZXRhaWwmeGhzc2hhcmU9V2VpeGluU2Vzc2lvbjsgeGhzVHJhY2tlci5zaWc9YzdmcDVRclk2SGNvVERhUzluX2N3Z2RCRHh2MFZmWnpSU1NTcnlzbG5lQTsgZXh0cmFfZXhwX2lkcz1oNV8yMzAyMDExX29yaWdpbixoNV8xMjA4X2NsdCxoNV8xMTMwX2NsdCxpb3Nfd3hfbGF1bmNoX29wZW5fYXBwX2V4cCxoNV92aWRlb191aV9leHAzLHd4X2xhdW5jaF9vcGVuX2FwcF9kdXJhdGlvbl9vcmlnaW4scXVlc19jbHQyOyBleHRyYV9leHBfaWRzLnNpZz1DVUdrR3NYT3lBZmpVSXkyVGo3SjN4YmRNakFfSnpoR1JkYWd6cVlkbmJnOyB3ZWJCdWlsZD0xLjEuMjE7IHhzZWNhcHBpZD14aHMtcGMtd2ViOyB3ZWJzZWN0aWdhPTU5ZDNlZjFlNjBjNGFhMzdhN2RmM2MyMzQ2N2JkNDZkN2YxZGEwYjE5MThjZjMzNWVlN2YyZTllNTJhYzA0Y2Y7IHNlY19wb2lzb25faWQ9MTI0OTE1NWQtOWU5ZS00MzkyLTg2NTgtNTA1Yzc0YTUzMTM1'
