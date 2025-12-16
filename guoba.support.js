import _ from "lodash";
import path from "path";
import { BILI_CDN_SELECT_LIST, BILI_DOWNLOAD_METHOD, BILI_RESOLUTION_LIST, YOUTUBE_GRAPHICS_LIST, NETEASECLOUD_QUALITY_LIST } from "./constants/constant.js";
import { RESOLVE_CONTROLLER_NAME_ENUM } from "./constants/resolve.js";
import model from "./model/config.js";

const pluginName = `rconsole-plugin`;

const _path = process.cwd() + `/plugins/${pluginName}`;
export function supportGuoba() {
    let globalWhitelist = Object.values(RESOLVE_CONTROLLER_NAME_ENUM).map(value => ({ value }));
    const globalWhitelistComponent = globalWhitelist.length === 0 ? 'GTags' : 'Select'
    return {
        pluginInfo: {
            name: "R插件",
            title: pluginName,
            author: "@zhiyu",
            authorLink: "https://gitee.com/kyrzy0416",
            link: "https://gitee.com/kyrzy0416/rconsole-plugin",
            isV3: true,
            isV2: false,
            description: "专门为朋友们写的Yunzai-Bot插件，专注图片分享和生活的插件！",
            // 是否显示在左侧菜单，可选值：auto、true、false
            // 当为 auto 时，如果配置项大于等于 3 个，则显示在左侧菜单
            showInMenu: 'auto',
            // 显示图标，此为个性化配置
            // 图标可在 https://icon-sets.iconify.design 这里进行搜索
            icon: 'mdi:stove',
            // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
            iconColor: '#d19f56',
            iconPath: path.join(_path, "resources/img/rank/logo.png"),
        },
        configInfo: {
            schemas: [
                // ==================== 全局配置 ====================
                {
                    label: '全局配置',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "全局配置",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: 'tools.globalBlackList',
                    label: '全局解析黑名单',
                    component: globalWhitelistComponent,
                    bottomHelpMessage: '添加后将全局禁用',
                    componentProps: {
                        allowAdd: true,
                        allowDel: true,
                        mode: 'multiple',
                        options: globalWhitelist,
                    },
                },
                {
                    field: "tools.globalImageLimit",
                    label: "解析图片是否合并转发",
                    bottomHelpMessage:
                        "超过配置的数字就会折叠。目前实现了此能的主要有米游社、b站动态专栏、微博、小红书",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入合并转发最大阈值",
                    },
                },
                {
                    field: "tools.identifyPrefix",
                    label: "识别前缀",
                    bottomHelpMessage: "识别前缀，比如你识别哔哩哔哩，那么就有：✅ 识别：哔哩哔哩",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入识别前缀",
                    },
                },
                {
                    field: "tools.proxyAddr",
                    label: "魔法地址",
                    bottomHelpMessage: "tiktok/小蓝鸟等要使用魔法时需要填写",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入魔法地址（默认：127.0.0.1）",
                    },
                },
                {
                    field: "tools.proxyPort",
                    label: "魔法端口",
                    bottomHelpMessage: "tiktok/小蓝鸟等要使用魔法时需要填写",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入端口（默认：7890）",
                    },
                },
                {
                    field: "tools.forceOverseasServer",
                    label: "强制使用海外服务器",
                    bottomHelpMessage: "设置为开启时，Twitter、TikTok等平台将强制不使用代理",
                    component: "Switch",
                    required: false,
                },
                {
                    field: "tools.defaultPath",
                    label: "视频暂存位置",
                    bottomHelpMessage:
                        "视频暂存位置(如果你对你系统我的文件非常了解可以修改，不然不建议)",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入视频暂存位置",
                    },
                },
                {
                    field: "tools.videoSizeLimit",
                    label: "视频大小限制",
                    bottomHelpMessage:
                        "视频大小限制（单位MB），超过大小则转换成群文件上传",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入视频大小限制",
                    },
                },
                {
                    field: "tools.streamDuration",
                    label: "解析直播时长",
                    bottomHelpMessage:
                        "解析直播（目前涉及哔哩哔哩、抖音）时长，单位：秒（默认：10秒），建议时间为10~60，不然也没人看",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入最大解析直播时长",
                    },
                },
                {
                    field: "tools.streamCompatibility",
                    label: "直播是否开启兼容模式",
                    bottomHelpMessage:
                        "兼容模式，NCQQ不用开，其他ICQQ、LLO需要开启",
                    component: "Switch",
                    required: false,
                },

                // ==================== 哔哩哔哩 ====================
                {
                    label: '哔哩哔哩',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "哔哩哔哩配置",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: "tools.biliSessData",
                    label: "哔哩哔哩SESSDATA",
                    bottomHelpMessage:
                        "如何获取具体参考我的文档说明：https://gitee.com/kyrzy0416/rconsole-plugin#Q&A",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入哔哩哔哩SESSDATA",
                    },
                },
                {
                    field: "tools.biliResolution",
                    label: "bili最高分辨率",
                    bottomHelpMessage:
                        "【开不开BBDown都同步】哔哩哔哩的最高分辨率，默认为480p，可以自行根据服务器进行调整",
                    component: "Select",
                    componentProps: {
                        options: BILI_RESOLUTION_LIST,
                    }
                },
                {
                    field: "tools.biliDownloadMethod",
                    label: "bili下载方式",
                    bottomHelpMessage:
                        "哔哩哔哩的下载方式：默认使用原生稳定的下载方式，如果你在乎内存可以使用轻量的wget和axel下载方式，如果在乎性能可以使用Aria2下载",
                    component: "Select",
                    componentProps: {
                        options: BILI_DOWNLOAD_METHOD,
                    }
                },
                {
                    field: "tools.biliSmartResolution",
                    label: "智能分辨率",
                    bottomHelpMessage:
                        "从API最高画质开始，自动选择不超过文件大小限制的最佳画质（优先AV1编码）",
                    component: "Switch",
                    required: false,
                },
                {
                    field: "tools.biliFileSizeLimit",
                    label: "文件大小限制",
                    bottomHelpMessage:
                        "视频大小限制（单位MB），超过大小则转换成群文件上传，配合智能分辨率使用",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入文件大小限制（MB，默认100）",
                    },
                },
                {
                    field: "tools.biliUseBBDown",
                    label: "BBDown接管下载",
                    bottomHelpMessage:
                        "【默认不开启，涉及范围只有哔哩哔哩，开启后默认最高画质发送】如果不爱折腾就使用默认下载方式，如果喜欢折腾就开启，开启后下载更强劲，并且一劳永逸！",
                    component: "Switch",
                    required: false,
                },
                {
                    field: "tools.biliCDN",
                    label: "强制使用CDN",
                    bottomHelpMessage: "BBDown强制使用CDN：【只影响开启后的BBDown，一定程度可以影响BBDown速度】哔哩哔哩的CDN地址更换，如果不需要默认不使用，如果选择了其他的CDN将会使用",
                    component: "Select",
                    componentProps: {
                        options: BILI_CDN_SELECT_LIST,
                    }
                },
                {
                    field: "tools.biliBangumiDirect",
                    label: "番剧直接解析",
                    bottomHelpMessage:
                        "开启后番剧将使用正常视频解析流程进行下载",
                    component: "Switch",
                    required: false,
                },
                {
                    field: "tools.biliBangumiResolution",
                    label: "番剧独立画质",
                    bottomHelpMessage:
                        "番剧独立画质设置，开启番剧直接解析后生效，默认为480p",
                    component: "Select",
                    componentProps: {
                        options: BILI_RESOLUTION_LIST,
                    }
                },
                {
                    field: "tools.biliBangumiDuration",
                    label: "番剧最大时长限制",
                    bottomHelpMessage:
                        "番剧超过此时长将不解析（单位：秒），默认30分钟（1800秒）",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入番剧最大限制时长（默认30分钟）",
                    },
                },
                {
                    field: "tools.biliDuration",
                    label: "视频最大时长限制",
                    bottomHelpMessage:
                        "超过时长无法解析（单位：秒），保护服务器性能，计算公式：8分钟 x 60秒 = 480秒",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入哔哩哔哩的视频最大限制时长（默认8分钟）",
                    },
                },
                {
                    field: "tools.biliIntroLenLimit",
                    label: "哔哩哔哩的简介长度限制",
                    bottomHelpMessage:
                        "防止简介过长刷屏",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入哔哩哔哩的简介长度限制（默认50个字符），填 0 或者 -1 可以不做任何限制，显示完整简介",
                    },
                },
                {
                    field: "tools.biliDisplayCover",
                    label: "是否显示封面",
                    bottomHelpMessage:
                        "默认显示，哔哩哔哩是否显示封面",
                    component: "Switch",
                    required: true,
                },
                {
                    field: "tools.biliDisplayInfo",
                    label: "是否显示相关信息",
                    bottomHelpMessage:
                        "默认显示，哔哩哔哩是否显示相关信息（点赞、硬币、收藏、分享、播放数、弹幕数、评论数）",
                    component: "Switch",
                    required: true,
                },
                {
                    field: "tools.biliDisplayIntro",
                    label: "是否显示简介",
                    bottomHelpMessage:
                        "默认显示，哔哩哔哩是否显示简介",
                    component: "Switch",
                    required: true,
                },
                {
                    field: "tools.biliDisplayOnline",
                    label: "是否显示在线人数",
                    bottomHelpMessage:
                        "默认显示，哔哩哔哩是否显示在线人数",
                    component: "Switch",
                    required: true,
                },
                {
                    field: "tools.biliDisplaySummary",
                    label: "是否显示总结",
                    bottomHelpMessage:
                        "默认不显示，哔哩哔哩是否显示总结",
                    component: "Switch",
                    required: true,
                },

                // ==================== 抖音 ====================
                {
                    label: '抖音',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "抖音配置",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: "tools.douyinCookie",
                    label: "抖音的Cookie",
                    bottomHelpMessage:
                        "登陆https://www.douyin.com/ - F12 - 自己替换一下：odin_tt=xxx;passport_fe_beating_status=xxx;sid_guard=xxx;uid_tt=xxx;uid_tt_ss=xxx;sid_tt=xxx;sessionid=xxx;sessionid_ss=xxx;sid_ucp_v1=xxx;ssid_ucp_v1=xxx;passport_assist_user=xxx;ttwid=xxx;",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入抖音的Cookie",
                    },
                },
                {
                    field: "tools.douyinCompression",
                    label: "抖音是否使用压缩格式",
                    component: "Switch",
                    required: false,
                },
                {
                    field: "tools.douyinComments",
                    label: "抖音是否开启评论",
                    component: "Switch",
                    required: false,
                },
                {
                    field: "tools.douyinImageBatchThreshold",
                    label: "抖音图片分批阈值",
                    bottomHelpMessage: "超过此数量的图片将分批发送（默认50张），设置为0表示不限制",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入图片分批阈值（默认50）",
                    },
                },

                // ==================== 油管YouTube ====================
                {
                    label: '油管YouTube',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "油管YouTube配置",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: "tools.youtubeDuration",
                    label: "油管最大解析时长",
                    bottomHelpMessage:
                        "超过时长不解析（单位：秒），保护魔法的流量，计算公式：8分钟 x 60秒 = 480秒，默认8分钟，最好不超过30分钟",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入YouTuBe视频最大时长限制",
                    },
                },
                {
                    field: "tools.youtubeClipTime",
                    label: "油管截取时长",
                    bottomHelpMessage:
                        "超过时长会截取指定时间（单位：秒），保护魔法的流量，计算公式：3分钟 x 60秒 = 180秒，默认不开启，最好不超过5分钟,0表无限or不开启",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "请输入截取时长",
                    },
                },
                {
                    field: "tools.youtubeGraphicsOptions",
                    label: "油管最高分辨率",
                    bottomHelpMessage:
                        "油管下载的最高分辨率（默认720p，请根据自己魔法流量和服务器承载能力进行调整）",
                    component: "Select",
                    componentProps: {
                        options: YOUTUBE_GRAPHICS_LIST,
                    }
                },
                {
                    field: "tools.youtubeCookiePath",
                    label: "油管Cookie文件路径",
                    bottomHelpMessage:
                        "【！重要：这里填写的是路径，例如/path/to/cookies.txt】如果无法解析油管就填写这个Cookie",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入Youtube Cookie所在的路径，例如：/path/to/cookies.txt",
                    },
                },

                // ==================== 小红书 ====================
                {
                    label: '小红书',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "小红书配置",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: "tools.xiaohongshuCookie",
                    label: "小红书的Cookie",
                    bottomHelpMessage:
                        "2024-8-2后反馈必须使用ck，不然无法解析",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入小红书的Cookie",
                    },
                },

                // ==================== 网易云音乐 ====================
                {
                    label: '网易云音乐',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "网易云音乐配置",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: "tools.isSendVocal",
                    label: "网易云开启发送音频",
                    bottomHelpMessage:
                        "默认开启，识别音乐之后是否转化群语音发送，关闭将获得一定的性能提升",
                    component: "Switch",
                    required: false,
                },
                {
                    field: "tools.useNeteaseSongRequest",
                    label: "开启网易云点歌功能",
                    bottomHelpMessage:
                        "默认不开启，建议搭配自建网易云API使用，以获得最佳体验",
                    component: "Switch",
                    required: false,
                },
                {
                    field: "tools.songRequestMaxList",
                    label: "点歌列表长度",
                    bottomHelpMessage:
                        "网易云点歌选择列表长度默认10",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "填入长度",
                    },
                },
                {
                    field: "tools.useLocalNeteaseAPI",
                    label: "使用自建网易云API",
                    bottomHelpMessage:
                        "默认不开启，有条件可以查看https://gitlab.com/Binaryify/neteasecloudmusicapi进行搭建",
                    component: "Switch",
                    required: false,
                },
                {
                    field: "tools.neteaseCloudAPIServer",
                    label: "自建网易云API地址",
                    bottomHelpMessage:
                        "填入自建API地址，例：http://localhost:3000",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "填入自建API地址",
                    },
                },
                {
                    field: "tools.neteaseCookie",
                    label: "网易云Cookie",
                    bottomHelpMessage:
                        "可以发送 #RNQ / #rnq 快捷获取 或 者在网易云官网自己获取，格式为：MUSIC_U=xxx",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "使用vip账号登陆获取更高音质解析",
                    },
                },
                {
                    field: "tools.neteaseCloudCookie",
                    label: "网易云云盘Cookie",
                    bottomHelpMessage:
                        "可以发送 #RNCQ / #rncq 快捷获取 或 者在网易云官网自己获取，格式为：MUSIC_U=xxx",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "使用vip账号登陆获取更高音质解析",
                    },
                },
                {
                    field: "tools.neteaseCloudAudioQuality",
                    label: "网易云解析最高音质",
                    bottomHelpMessage:
                        "网易云解析最高音质(目前仅针对自建最新API服务器生效！！需vip账号ck！！默认极高，杜比全景声由于编码特殊需要设备支持，更高请根据登陆的账号和服务器承载能力进行选择)",
                    component: "Select",
                    componentProps: {
                        options: NETEASECLOUD_QUALITY_LIST,
                    }
                },

                // ==================== 其他平台 ====================
                {
                    label: '其他平台',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "其他平台配置",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: "tools.weiboCookie",
                    label: "微博的Cookie",
                    bottomHelpMessage:
                        "登陆https://m.weibo.cn/ - F12 - 格式：_T_WM=xxx; WEIBOCN_FROM=xxx; MLOGIN=xxx; XSRF-TOKEN=xxx; M_WEIBOCN_PARAMS=xxx",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入微博的Cookie",
                    },
                },
                {
                    field: "tools.xiaoheiheCookie",
                    label: "小黑盒的Cookie",
                    bottomHelpMessage:
                        "登陆https://www.xiaoheihe.cn/ - F12 - 格式：x_xhh_tokenid=xxx，小黑盒目前用的硬编码ck，有概率会出现需要验证码的情况，通常使用分享链接而不是web链接即可解决，后续有大佬出手的话可以换成动态ck",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入小黑盒的Cookie",
                    },
                },

                // ==================== AI配置 ====================
                {
                    label: 'AI配置',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "AI配置",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: "tools.aiBaseURL",
                    label: "AI接口地址",
                    bottomHelpMessage:
                        "支持Kimi、OpenAI、Claude等，例如官方的可以填写：https://api.moonshot.cn，如果是本机可以填写：http://localhost:8000",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入AI接口地址",
                    },
                },
                {
                    field: "tools.aiApiKey",
                    label: "AI的key",
                    bottomHelpMessage:
                        "服务商提供的api key，如果是官方的就是sk-....，如果是本机的就是ey...（推荐使用ey因为sk没有联网功能）",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入AI的key",
                    },
                },
                {
                    field: "tools.aiModel",
                    label: "AI的模型",
                    bottomHelpMessage:
                        "默认使用的是moonshot-v1-8k，也可以自定义模型，只要能联网就能使用！",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入AI的模型，例如：moonshot-v1-8k，使用kimi则不用填写",
                    },
                },

                // ==================== 高级配置 ====================
                {
                    label: '高级配置',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "高级配置",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: "tools.deeplApiUrls",
                    label: "DeeplX API地址集合",
                    bottomHelpMessage: "可以参考：https://github.com/OwO-Network/DeepLX，进行搭建，也可以使用内置",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入DeeplX API地址集合",
                    },
                },
                {
                    field: "tools.queueConcurrency",
                    label: "队列长度",
                    bottomHelpMessage:
                        "【目前只涉及哔哩哔哩的下载功能】允许队列下载个数：根据服务器性能设置可以并发下载的个数，如果你的服务器比较强劲，就选择4~12，较弱就一个一个下载，选择1",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "如果你的服务器比较强劲，就写4~12（比如4，就是可以4个人同时下载），较弱就一个一个下载，写1",
                    },
                },
                {
                    field: "tools.videoDownloadConcurrency",
                    label: "下载并发个数",
                    bottomHelpMessage:
                        "【涉及哔哩哔哩、抖音、YouTuBe、tiktok】下载并发个数：与【允许多用户下载个数】不同，这个功能影响下载速度。默认是1表示不使用，使用根据服务器性能进行选择，如果不确定是否可以用1即可，高性能服务器随意4~12都可以，看CPU的实力",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "不确定用1即可，高性能服务器随意4~12都可以，看CPU的实力",
                    },
                },

                // ==================== 帮助与文档 ====================
                {
                    label: '帮助与文档',
                    component: 'SOFT_GROUP_BEGIN'
                },
                {
                    component: "Divider",
                    label: "官方资源",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: 'pluginHome',
                    label: '插件首页（必读）🔥',
                    component: 'Input',
                    componentProps: {
                        readonly: true,
                        defaultValue: 'https://github.com/zhiyu1998/rconsole-plugin'
                    }
                },
                {
                    field: 'helpDoc',
                    label: '官方文档 📚',
                    component: 'Input',
                    componentProps: {
                        readonly: true,
                        defaultValue: 'https://zhiyu1998.github.io/rconsole-plugin/'
                    }
                },
                {
                    component: "Divider",
                    label: "相关项目推荐",
                    componentProps: {
                        orientation: "left",
                        plain: true,
                    },
                },
                {
                    field: 'tgChannel',
                    label: 'TG频道 📢',
                    bottomHelpMessage: '分享日常冲浪互联网看到好玩的网站、app应用',
                    component: 'Input',
                    componentProps: {
                        readonly: true,
                        defaultValue: 'https://t.me/RrOrangeAndFriends'
                    }
                },
                {
                    field: 'orangeSideBar',
                    label: '大橘侧边栏 🍊',
                    bottomHelpMessage: '一个开源的网页侧边栏 AI 对话总结工具，支持 OpenAI、Gemini、Anthropic 规范的 API，支持自动摘要、联网搜索、多轮对话、视频字幕总结、论文模式等功能',
                    component: 'Input',
                    componentProps: {
                        readonly: true,
                        defaultValue: 'https://github.com/zhiyu1998/OrangeSideBar'
                    }
                },
                {
                    field: 'complementarySet',
                    label: 'R插件补集 🎁',
                    bottomHelpMessage: '基于 Yunzai 的 R 插件补集，写给好朋友们的比较好玩的插件！',
                    component: 'Input',
                    componentProps: {
                        readonly: true,
                        defaultValue: 'https://github.com/zhiyu1998/rconsole-plugin-complementary-set'
                    }
                },
            ],
            getConfigData() {
                const toolsData = {
                    tools: model.getConfig("tools"),
                };
                return toolsData;
            },
            setConfigData(data, { Result }) {
                let config = {};
                let cfg = model.getConfig("tools");
                for (let [key, value] of Object.entries(data)) {
                    // 特殊处理这个，需要全覆盖
                    if (key === "tools.globalBlackList") {
                        _.set(cfg, "globalBlackList", value);
                    }
                    _.set(config, key, value);
                }
                // 合并配置项
                config = _.merge({}, cfg, config.tools);
                // 保存
                model.saveAllConfig("tools", config);
                return Result.ok({}, "保存成功~");
            },
        },
    };
}
