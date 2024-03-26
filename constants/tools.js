/**
 * AI总结API
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/misc/sign/wbi.md
 * @type {string}
 */
export const BILI_SUMMARY = "https://api.bilibili.com/x/web-interface/view/conclusion/get"

/**
 * 视频流URL
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/video/videostream_url.md
 * @type {string}
 */
export const BILI_PLAY_STREAM = "https://api.bilibili.com/x/player/playurl?cid={cid}&bvid={bvid}&qn=64&fnval=16"

/**
 * 动态信息
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/dynamic/get_dynamic_detail.md
 * @type {string}
 */
export const BILI_DYNAMIC = "https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id={}"

/**
 * BVID -> CID
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/33bde6f6afcac2ff8c6f7069f08ce84065a6cff6/docs/video/info.md?plain=1#L4352
 * @type {string}
 */
export const BILI_BVID_TO_CID = "https://api.bilibili.com/x/player/pagelist?bvid={bvid}&jsonp=jsonp"

/**
 * 视频基本信息API
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/video/info.md
 * @type {string}
 */
export const BILI_VIDEO_INFO = "http://api.bilibili.com/x/web-interface/view"

/**
 * 登录基本信息
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/login/login_info.md#%E5%AF%BC%E8%88%AA%E6%A0%8F%E7%94%A8%E6%88%B7%E4%BF%A1%E6%81%AF
 * @type {string}
 */
export const BILI_NAV = "https://api.bilibili.com/x/web-interface/nav"

/**
 * 米游社网页端获取文章
 * https://github.com/UIGF-org/mihoyo-api-collect/blob/main/hoyolab/article/article.md#%E8%8E%B7%E5%8F%96%E5%AE%8C%E6%95%B4%E6%96%87%E7%AB%A0%E4%BF%A1%E6%81%AF
 * @type {string}
 */
export const MIYOUSHE_ARTICLE = "https://bbs-api.miyoushe.com/post/wapi/getPostFull?post_id={}"

/**
 * 视频请求链接CDN
 * @type {string}
 */
export const XHS_VIDEO = "http://sns-video-bd.xhscdn.com/"

/**
 * dy API
 * @type {string}
 */
export const DY_INFO = "https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id={}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1344&screen_height=756&browser_language=zh-CN&browser_platform=Win32&browser_name=Firefox&browser_version=118.0&browser_online=true&engine_name=Gecko&engine_version=109.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=&platform=PC"

/**
 * Tiktok API
 * @type {string}
 */
export const TIKTOK_INFO = "https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/"

/**
 * X API
 * @type {string}
 */
export const TWITTER_TWEET_INFO = "https://api.twitter.com/2/tweets?ids={}"

/**
 * XHS 的请求链接
 * @type {string}
 */
export const XHS_REQ_LINK = "https://www.xiaohongshu.com/explore/"

/**
 * 🍉 的请求链接
 * @type {string}
 */
export const GENERAL_REQ_LINK = {
    link: "http://47.99.158.118/video-crack/v2/parse?content={}",
    sign: 1
}
export const GENERAL_REQ_LINK_2 = {
    link: "https://acid.jiuzige.com.cn/web/index/analysis?url={}",
    sign: 2
}

/**
 * 获取网易云歌曲下载链接
 * @type {string}
 */
export const NETEASE_SONG_DOWNLOAD = "https://neteasecloudmusicapi.vercel.app/song/url?id={}"

/**
 * 获取网易云歌曲详情
 * @type {string}
 */
export const NETEASE_SONG_DETAIL = "https://neteasecloudmusicapi.vercel.app/song/detail?ids={}"

/**
 * 单条微博的接口
 * @type {string}
 */
export const WEIBO_SINGLE_INFO = "https://m.weibo.cn/statuses/show?id={}"

/**
 * 微视接口
 * @type {string}
 */
export const WEISHI_VIDEO_INFO = "https://h5.weishi.qq.com/webapp/json/weishi/WSH5GetPlayPage?feedid={}"
