import path from "path";
import model from "./model/index.js";
import _ from "lodash";

const _path = process.cwd() + "/plugins/rconsole-plugin";
export function supportGuoba() {
    return {
        pluginInfo: {
            name: "R插件",
            title: "rconsole-plugin",
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
            iconPath: path.join(_path, "resources/img/rank/top.png"),
        },
        configInfo: {
            schemas: [
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
                    field: "tools.translateAppId",
                    label: "百度翻译APP ID",
                    bottomHelpMessage: "使用百度翻译需要的APP ID（需要申请）",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入APP ID",
                    },
                },
                {
                    field: "tools.translateSecret",
                    label: "百度翻译密匙",
                    bottomHelpMessage: "使用百度翻译需要的密匙（需要申请）",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入密匙",
                    },
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
                    field: "tools.biliUseBBDown",
                    label: "使用BBDown下载",
                    bottomHelpMessage:
                        "【默认不开启，涉及范围只有哔哩哔哩，开启后默认最高画质发送】如果不爱折腾就使用默认下载方式，如果喜欢折腾就开启，开启后下载更强劲，并且一劳永逸！",
                    component: "Switch",
                    required: false,
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
                {
                    field: "tools.queueConcurrency",
                    label: "（高级）队列长度",
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
                    label: "（高级）下载并发个数",
                    bottomHelpMessage:
                        "【涉及哔哩哔哩、抖音】下载并发个数：与【允许多用户下载个数】不同，这个功能影响下载速度。默认是1表示不使用，使用根据服务器性能进行选择，如果不确定是否可以用1即可，高性能服务器随意4~12都可以，看CPU的实力",
                    component: "InputNumber",
                    required: false,
                    componentProps: {
                        placeholder: "不确定用1即可，高性能服务器随意4~12都可以，看CPU的实力",
                    },
                },
                {
                    field: "tools.lagrangeForwardWebSocket",
                    label: "Lagrange.Core-WebSocket连接地址",
                    bottomHelpMessage:
                        "格式：ws://地址:端口/，拉格朗日正向连接地址，用于适配拉格朗日上传群文件，解决部分用户无法查看视频问题",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入拉格朗日正向WebSocket连接地址",
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
                }
            ],
            getConfigData() {
                const toolsData = {
                    tools: model.getConfig("tools"),
                };
                return toolsData;
            },
            setConfigData(data, { Result }) {
                let config = {};
                for (let [key, value] of Object.entries(data)) {
                    _.set(config, key, value);
                }
                // TODO 目前只有一个文件的配置，暂时这样写
                config = _.merge({}, model.getConfig("tools"), config.tools);
                model.saveSet("tools", config);
                return Result.ok({}, "保存成功~");
            },
        },
    };
}
