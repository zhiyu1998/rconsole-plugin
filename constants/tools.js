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
 * 扫码登录的二维码生成
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/login/login_action/QR.md
 * @type {string}
 */
export const BILI_SCAN_CODE_GENERATE = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate"

/**
 * 扫码登录检测然后发送令牌数据
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/login/login_action/QR.md
 * @type {string}
 */
export const BILI_SCAN_CODE_DETECT = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key={}";

/**
 * 直播间信息获取
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/live/info.md
 * @type {string}
 */
export const BILI_STREAM_INFO = "https://api.live.bilibili.com/room/v1/Room/get_info"

/**
 * 获取视频在线人数_web端
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/video/online.md
 * @type {string}
 */
export const BILI_ONLINE = "https://api.bilibili.com/x/player/online/total?bvid={0}&cid={1}"

/**
 * 剧集基本信息
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/bangumi/info.md
 * @type {string}
 */
export const BILI_EP_INFO = "https://api.bilibili.com/pgc/view/web/season?ep_id={}"

/**
 * 剧集基本信息
 * https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/bangumi/info.md
 * @type {string}
 */
export const BILI_SSID_INFO = "https://api.bilibili.com/pgc/web/season/section?season_id={}"

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
 * DY COMMENT API
 * @type {string}
 */
export const DY_COMMENT = "https://www.douyin.com/aweme/v1/web/comment/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id={}&cursor=0&count=20&item_type=0&insert_ids=&whale_cut_token=&cut_version=1&rcFT=&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1920&screen_height=1080&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=124.0.0.0&browser_online=true&engine_name=Blink&engine_version=124.0.0.0&os_name=Windows&os_version=10&cpu_core_num=20&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=50&webid=7361743797237679616"

/**
 * 今日头条 DY API
 * @type {string}
 */
export const DY_TOUTIAO_INFO = "https://aweme.snssdk.com/aweme/v1/play/?video_id={}&ratio=1080p&line=0"

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
 * 通用解析的请求链接
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

export const GENERAL_REQ_LINK_3 = {
    link: "https://picseed.com/v1/parser?auth_key=1E9DC25C-E75F-11EE-A0DD-0A5A298C6C2D&content={}",
    sign: 3
}

/**
 * 获取网易云歌曲下载链接
 * @type {string}
 */
export const NETEASE_SONG_DOWNLOAD = "https://neteasecloudmusicapi.vercel.app"

/**
 * 获取网易云歌曲详情
 * 致谢 NeteaseCloudMusicApi：https://gitlab.com/Binaryify/neteasecloudmusicapi
 * @type {string}
 */
export const NETEASE_SONG_DETAIL = "https://neteasecloudmusicapi.vercel.app"

/**
 * 国内网易云服务，如果有大佬可以有闲置的服务器可以到群里赞助
 * 致谢 NeteaseCloudMusicApi：https://gitlab.com/Binaryify/neteasecloudmusicapi
 * @type {string}
 */
export const NETEASE_API_CN = 'https://www.markingchen.ink';

/**
 * 下载VIP的临时接口
 * 备用：https://api.lolimi.cn/API/wydg/api.php?msg={}&n=1
 * 备用2: http://kilz.top/api/wangyi_music.php?msg={}&n=1
 * @type {string}
 */
export const NETEASE_TEMP_API = "https://www.hhlqilongzhu.cn/api/dg_wyymusic.php?gm={}&n=1&type=json"

/**
 * 下载VIP的临时接口2
 * @type {string}
 */
export const QQ_MUSIC_TEMP_API = "https://www.hhlqilongzhu.cn/api/dg_qqmusic.php?gm={}&n=1&type=json"

/**
 * 下载VIP的临时接口3
 * @type {string}
 */
export const QISHUI_MUSIC_TEMP_API = "https://api.cenguigui.cn/api/qishui/?msg={}&limit=1&type=json&n=1"

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

/**
 * 番剧搜索链接
 * @type {string}
 */
export const ANIME_SERIES_SEARCH_LINK = "https://ylu.cc/so.php?wd="

/**
 * 番剧搜索链接2
 * @type {string}
 */
export const ANIME_SERIES_SEARCH_LINK2 = "https://yhdm.one/search?q="

/**
 * HIBI API
 * @type {string}
 */
export const HIBI_API_SERVICE = "https://hibi.moecube.com/api";

/**
 * 临时 AI LLM爬虫
 * @type {string}
 */
export const PearAPI_CRAWLER = "https://api.pearktrue.cn/api/llmreader/?url={}&type=json";

/**
 * 临时 AI 总结
 * @type {string}
 */
export const PearAPI_DEEPSEEK = "https://api.pearktrue.cn/api/deepseek/"
