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
export const DIVIDING_LINE = "\n------------------{}------------------"

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
export const SUMMARY_PROMPT = `请返回您仔细阅读正文后精心写成的详尽笔记，如果是ArXiv论文就简要介绍下内容和创新点即可`

/**
 * 图片翻译 prompt
 * @type {string}
 */
export const IMAGE_TRANSLATION_PROMPT = `Begin each of the following with a triangle symbol (▲ U+25B2): First, a brief description of the image to be used as alt text. Do not describe or extract text in the description. Second, the text extracted from the image, with newlines where applicable. Un-obstruct text if it is covered by something, to make it readable. If there is no text in the image, only respond with the description. Do not include any other information. Example: ▲ Lines of code in a text editor.▲ const x = 5; const y = 10; const z = x + y; console.log(z); Finally, answer in Chinese.`

/**
 * 帮助文档提示
 * @type {string}
 */
export const HELP_DOC = "\n文档：https://gitee.com/kyrzy0416/rconsole-plugin"

/**
 * 总结内容评估器的正则
 * @type {{reg: RegExp, name: string}[]}
 */
export const SUMMARY_CONTENT_ESTIMATOR_PATTERNS = [
    { reg: /(?:https?:\/\/)?mp\.weixin\.qq\.com\/[A-Za-z\d._?%&+\-=\/#]*/, name: '微信文章' },
    { reg: /(?:https?:\/\/)?arxiv.org\/[a-zA-Z\d._?%&+\-=\/#]*/, name: 'ArXiv论文' },
    { reg: /(?:https?:\/\/)?sspai.com\/[a-zA-Z\d._?%&+\-=\/#]*/, name: '少数派' },
    { reg: /(?:https?:\/\/)?www\.bilibili\.com\/read\/[A-Za-z\d._?%&+\-=\/#]*/, name: '哔哩哔哩专栏' },
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