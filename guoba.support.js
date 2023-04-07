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
            // 显示图标，此为个性化配置
            // 图标可在 https://icon-sets.iconify.design 这里进行搜索
            // icon: "mdi:share-reviews-sharp",
            // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
            // iconColor: "#3498db",
            // 如果想要显示成图片，也可以填写图标路径（绝对路径）
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
                    field: "tools.biliSessData",
                    label: "哔哩哔哩SESSDATA",
                    bottomHelpMessage:
                        "如何获取具体参考我的文档说明：https://gitee.com/kyrzy0416/rconsole-plugin",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入哔哩哔哩SESSDATA",
                    },
                },
                {
                    field: "tools.openaiAccessToken",
                    label: "OpenAI的AccessToken",
                    bottomHelpMessage:
                        "ey....，先登录：https://chat.openai.com/，再复制里面的accessToken：https://chat.openai.com/api/auth/session",
                    component: "Input",
                    required: false,
                    componentProps: {
                        placeholder: "请输入OpenAI的AccessToken（ey.....）",
                    },
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
