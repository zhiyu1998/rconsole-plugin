import { REDIS_YUNZAI_WEBUI } from "../constants/constant.js";
import config from "../model/config.js";
import { redisSetKey } from "../utils/redis-util.js";
import { getBotLoginInfo, getBotStatus, getBotVersionInfo } from "../utils/yunzai-util.js";

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

    async rWebSwitch(e) {
        config.updateField("tools", "isOpenWebUI", !this.isOpenWebUI);
        const realIsOpenWebUI = config.getConfig("tools").isOpenWebUI;
        if (realIsOpenWebUI) {
            Promise.all([getBotStatus(e), getBotVersionInfo(e), getBotLoginInfo(e)]).then(values => {
                const status = values[0].data;
                const versionInfo = values[1].data;
                const loginInfo = values[2].data;
                redisSetKey(REDIS_YUNZAI_WEBUI, {
                    ...status,
                    ...versionInfo,
                    ...loginInfo
                })
            })
        }
        // 这里有点延迟，需要写反
        e.reply(`R插件 WebUI：${ realIsOpenWebUI ? "开启\n🚀 请重启以启动 WebUI" : "关闭" }`);
        return true;
    }

    async rWebStatus(e) {
        e.reply(`R插件 WebUI：${ this.toolsConfig.isOpenWebUI ? "开启" : "关闭" }`);
        return true;
    }
}
