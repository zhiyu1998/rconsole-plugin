import { REDIS_YUNZAI_WEBUI } from "../constants/constant.js";
import config from "../model/config.js";
import { constructPublicIPsMsg } from "../utils/network.js";
import { redisSetKey } from "../utils/redis-util.js";
import { getBotLoginInfo, getBotStatus, getBotVersionInfo, sendPrivateMsg } from "../utils/yunzai-util.js";

export class WebUI extends plugin {
    constructor() {
        super({
            name: "R插件 WebUI 开关",
            dsc: "R插件 WebUI 开关",
            event: "message",
            priority: 4000,
            rule: [
                {
                    reg: "^#(r|R)wss$",
                    fnc: "rWebSwitch",
                    permission: "master",
                },
                {
                    reg: "^#(r|R)ws$",
                    fnc: "rWebStatus",
                    permission: "master",
                }
            ]
        });
        // 配置文件
        this.toolsConfig = config.getConfig("tools");
        // 加载WebUI开关
        this.isOpenWebUI = this.toolsConfig.isOpenWebUI;
    }

    async initData(e, realIsOpenWebUI) {
        if (realIsOpenWebUI) {
            Promise.all([getBotStatus(e), getBotVersionInfo(e), getBotLoginInfo(e)]).then(values => {
                const status = values[0].data;
                const versionInfo = values[1].data;
                const loginInfo = values[2].data;
                redisSetKey(REDIS_YUNZAI_WEBUI, {
                    ...status,
                    ...versionInfo,
                    ...loginInfo
                });
            });
        }
    }

    async rWebSwitch(e) {
        config.updateField("tools", "isOpenWebUI", !this.isOpenWebUI);
        const realIsOpenWebUI = config.getConfig("tools").isOpenWebUI;
        // 初始化数据
        await this.initData(e, realIsOpenWebUI);
        // 这里有点延迟，需要写反
        e.reply(`R插件可视化面板：${ realIsOpenWebUI ? "✅已开启" : "❌已关闭" }，重启后生效`);
        if (realIsOpenWebUI) {
            await sendPrivateMsg(e, constructPublicIPsMsg());
        }
        return true;
    }

    async rWebStatus(e) {
        e.reply(`R插件可视化面板：\n状态：${ this.toolsConfig.isOpenWebUI ? "✅开启" : "❌关闭" }\n地址：******:4016`);
        return true;
    }
}
