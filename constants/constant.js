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

/**
 * 固定值 1w，目前用于哔哩哔哩的数值渲染
 * @type {number}
 */
export const TEN_THOUSAND = 10000;

/**
 * #cat 指令的限制
 * @type {number}
 */
export const CAT_LIMIT = 10;

/**
 * 公共的 User-Agent
 * @type {string}
 */
export const COMMON_USER_AGENT = "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36";

/**
 * 无水印的头请求
 * @type {{cookie: string, "User-Agent": string, accept: string}}
 */
export const XHS_NO_WATERMARK_HEADER = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'cookie': '',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 UBrowser/6.2.4098.3 Safari/537.36',
}

/**
 * 分割线
 * @type {string}
 */
export const DIVIDING_LINE = "\n━━━{}━━━"

/**
 * 保存判断机子是否是海外服务器的key
 * @type {string}
 */
export const REDIS_YUNZAI_ISOVERSEA = "Yz:rconsole:tools:oversea";

/**
 * 保存判断机子是否使用的是拉格朗日
 * @type {string}
 */
export const REDIS_YUNZAI_LAGRANGE = "Yz:rconsole:tools:lagrange";

/**
 * 某些功能的解析白名单
 * @type {string}
 */
export const REDIS_YUNZAI_WHITELIST = "Yz:rconsole:tools:whitelist";

/**
 * 番剧列表缓存
 * @type {string}
 */
export const REDIS_YUNZAI_ANIMELIST = "Yz:rconsole:tools:anime";

export const TWITTER_BEARER_TOKEN = "";

/**
 * 哔哩哔哩简介默认长度限制
 * @type {number}
 */
export const BILI_DEFAULT_INTRO_LEN_LIMIT = 50;

/**
 * 总结的prompt
 * @type {string}
 */
export const SUMMARY_PROMPT = `# Role: Web Content Summarization Assistant

## Profile
- author: R-plugin 
- version: 1.0
- language: 中文
- description: 一个专门用于网页内容摘要的AI助手，能够提取关键点，总结文章，并提供复杂主题的简洁概览。

## Skills
1. 精通自然语言理解和摘要技术。
2. 能够从各种网页内容格式（文章、博客、报告）中提取关键信息。
3. 能够总结短篇和长篇内容。
4. 适应不同的写作风格和语调。

## Rules
1. 确保摘要捕捉到网页的主要思想和关键点。
2. 摘要应简洁、清晰、准确，避免不必要的细节。
3. 根据原始内容的复杂性和长度调整摘要的长度和细节。
4. 保持原始内容的上下文和意图，不添加个人解释。

## Workflows
1. 分析网页的结构和主要部分。
2. 识别并提取内容中的关键点、论点或信息。
3. 首先，生成一个标题，格式约束为："标题: {title}"。
4. 然后，生成一个包含最重要细节的简洁摘要。
5. 接下来，生成一个"关键段落"标题，内容包括你认为文章中一些关键信息点，每个关键点前都带有一个表情符号。
6. 接下来，审查摘要的准确性和完整性。不要在摘要审查中包含当前网页的URL。
7. 最后，输出内容保证为中文。

## Init
在第一次对话中，请直接输出以下：您好！我将联合R插件为您提供简洁明了的网页内容。`

/**
 * 图片翻译 prompt
 * @type {string}
 */
export const IMAGE_TRANSLATION_PROMPT = `Begin each of the following with a triangle symbol (▲ U+25B2): First, a brief description of the image to be used as alt text. Do not describe or extract text in the description. Second, the text extracted from the image, with newlines where applicable. Un-obstruct text if it is covered by something, to make it readable. If there is no text in the image, only respond with the description. Do not include any other information. Example: ▲ Lines of code in a text editor.▲ const x = 5; const y = 10; const z = x + y; console.log(z); Finally, answer in Chinese.`

/**
 * 帮助文档提示
 * @type {string}
 */
export const HELP_DOC = "\n文档：https://zhiyu1998.github.io/rconsole-plugin/"

/**
 * 总结内容评估器的正则
 * @type {{reg: RegExp, name: string}[]}
 */
export const SUMMARY_CONTENT_ESTIMATOR_PATTERNS = [
    { reg: /(?:https?:\/\/)?mp\.weixin\.qq\.com\/[A-Za-z\d._?%&+\-=\/#]*/, name: '微信文章' },
    { reg: /(?:https?:\/\/)?arxiv.org\/[a-zA-Z\d._?%&+\-=\/#]*/, name: 'ArXiv论文' },
    { reg: /(?:https?:\/\/)?sspai.com\/[a-zA-Z\d._?%&+\-=\/#]*/, name: '少数派' },
    { reg: /(?:https?:\/\/)?www\.bilibili\.com\/read\/[A-Za-z\d._?%&+\-=\/#]*/, name: '哔哩哔哩专栏' },
    { reg: /(?:https?:\/\/)?www\.zhihu\.com\/question\/[A-Za-z\d._?%&+\-=\/#]*/, name: '知乎问题' },
    { reg: /(?:https?:\/\/)?(www\.)chinadaily.com.cn\/a\/[a-zA-Z0-9\d._?%&+\-=\/#]*/, name: 'ChinaDaily' }
];

const BILI_CDN_TEMPLATE = "upos-sz-mirror{}.bilivideo.com";
export const BILI_CDN_SELECT_LIST = Object.freeze([
    { label: '不使用', value: 0, sign: '' },
    { label: '腾讯CDN【推荐】', value: 1, sign: BILI_CDN_TEMPLATE.replace('{}', 'cos') },
    { label: '百度CDN', value: 2, sign: BILI_CDN_TEMPLATE.replace('{}', 'bd') },
    { label: '华为CDN', value: 3, sign: BILI_CDN_TEMPLATE.replace('{}', 'hw') },
    { label: '阿卡迈（海外）', value: 4 , sign: BILI_CDN_TEMPLATE.replace('{}', 'akamai')},
    { label: 'HK-CDN', value: 5, sign: BILI_CDN_TEMPLATE.replace('{}', 'aliov') }
]);

export const BILI_DOWNLOAD_METHOD = Object.freeze([
    { label: '稳定（原生）', value: 0 },
    { label: '性能（Aria2）', value: 1 },
    { label: '轻量（axel/wget）', value: 2 }
]);

export const BILI_RESOLUTION_LIST = Object.freeze([
    { label: '8K 超高清', value: 0 },
    { label: '4K 超清', value: 1 },
    { label: '1080P 高码率', value: 2 },
    { label: '1080P 高清', value: 3 },
    { label: '720P 高清', value: 4 },
    { label: '480P 清晰', value: 5 },
    { label: '360P 流畅', value: 6 },
]);

/**
 * 消息撤回时间
 * @type {number}
 */
export const MESSAGE_RECALL_TIME = 60;

/**
 * 针对 Aria2 和 Alex 的下载检测文件时间
 * @type {number}
 */
export const DOWNLOAD_WAIT_DETECT_FILE_TIME = 3000;

/**
 * 短链接接口
 * @type {string}
 */
export const SHORT_LINKS = "https://smolurl.com/api/links";
