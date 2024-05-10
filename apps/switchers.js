import config from "../model/index.js";
import { REDIS_YUNZAI_ISOVERSEA, REDIS_YUNZAI_LAGRANGE } from "../constants/constant.js";
import { deleteFolderRecursive, readCurrentDir } from "../utils/file.js";

export class switchers extends plugin {
    constructor() {
        super({
            name: "R插件开关类",
            dsc: "内含一些和Redis相关的开关类",
            event: "message.group",
            priority: 300,
            rule: [
                {
                    reg: "^#设置海外解析$",
                    fnc: "setOversea",
                    permission: "master",
                },
                {
                    reg: "^#设置拉格朗日$",
                    fnc: "setLagrange",
                    permission: "master",
                },
                {
                    reg: "^清理data垃圾$",
                    fnc: "clearTrash",
                    permission: "master",
                },
            ]
        });
        // 配置文件
        this.toolsConfig = config.getConfig("tools");
        // 视频保存路径
        this.defaultPath = this.toolsConfig.defaultPath;
    }

    /**
     * 设置海外模式
     * @param e
     * @returns {Promise<boolean>}
     */
    async setOversea(e) {
        // 查看当前设置
        let os;
        if ((await redis.exists(REDIS_YUNZAI_ISOVERSEA))) {
            os = JSON.parse(await redis.get(REDIS_YUNZAI_ISOVERSEA)).os;
        }
        // 设置
        os = ~os
        await redis.set(
            REDIS_YUNZAI_ISOVERSEA,
            JSON.stringify({
                os: os,
            }),
        );
        e.reply(`当前服务器：${ os ? '海外服务器' : '国内服务器' }`)
        return true;
    }

    async setLagrange(e) {
        // 查看当前设置
        let driver;
        if ((await redis.exists(REDIS_YUNZAI_LAGRANGE))) {
            driver = JSON.parse(await redis.get(REDIS_YUNZAI_LAGRANGE)).driver;
        }
        // 设置
        driver = ~driver
        await redis.set(
            REDIS_YUNZAI_LAGRANGE,
            JSON.stringify({
                driver: driver,
            }),
        );
        e.reply(`当前驱动：${ driver ? '拉格朗日' : '其他驱动' }`)
        return true;
    }

    /**
     * 清理垃圾文件
     * @param e
     * @returns {Promise<void>}
     */
    async clearTrash(e) {
        const dataDirectory = "./data/";

        // 删除Yunzai遗留问题的合成视频垃圾文件
        try {
            const files = await readCurrentDir(dataDirectory);
            let dataClearFileLen = 0;
            for (const file of files) {
                // 如果文件名符合规则，执行删除操作
                if (/^[0-9a-f]{32}$/.test(file)) {
                    await fs.promises.unlink(dataDirectory + file);
                    dataClearFileLen++;
                }
            }
            // 删除R插件临时文件
            const rTempFileLen = await deleteFolderRecursive(this.defaultPath)
            e.reply(
                `数据统计：\n` +
                `- 当前清理了${ dataDirectory }下总计：${ dataClearFileLen } 个垃圾文件\n` +
                `- 当前清理了${ this.toolsConfig.defaultPath }下文件夹：${ rTempFileLen } 个群的所有临时文件`
            );
        } catch (err) {
            logger.error(err);
            await e.reply("清理失败，重试或者手动清理即可");
        }
    }
}