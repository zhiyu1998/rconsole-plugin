/**
 * 用于翻译的常量控制
 *
 * @type {{英: string, 日: string, 文: string, 中: string}}
 */
export const transMap = { 中: "zh", 日: "jp", 文: "wyw", 英: "en", 俄: "ru" };

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

export const TEN_THOUSAND = 10000;