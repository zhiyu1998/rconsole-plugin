import config from "../model/config.js";
import schedule from 'node-schedule';
import { REDIS_YUNZAI_ISOVERSEA, REDIS_YUNZAI_LAGRANGE } from "../constants/constant.js";
import { deleteFolderRecursive, readCurrentDir } from "../utils/file.js";

//自动清理定时
const autotime = config.getConfig("tools").autoclearTrashtime
// 视频保存路径
const defaultPath = config.getConfig("tools").defaultPath

export class switchers extends plugin {
    constructor() {
        super({
            name: "R插件开关类",
            dsc: "内含一些和Redis相关的开关类",
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
                    reg: "^清理垃圾$",
                    fnc: "clearTrash",
                    permission: "master",
                },
            ]
        });
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
        // 异常检测，之前算法出现问题，如果出现异常就检测纠正
        if (driver === -1) {
            driver = 1;
        }
        // 设置
        driver ^= 1;
        await redis.set(
            REDIS_YUNZAI_LAGRANGE,
            JSON.stringify({
                driver: driver,
            }),
        );
        e.reply(`当前驱动：${ driver ? '拉格朗日' : '其他驱动' }`)
        return true;
    }

    //手动清理垃圾
    async clearTrash(e) {
        try {
            const { dataClearFileLen, rTempFileLen } = await autoclearTrash();
            e.reply(`手动清理垃圾完成:\n` +
                `- 清理了${ dataClearFileLen }个垃圾文件\n` +
                `- 清理了${ rTempFileLen }个群临时文件`);
        } catch (err) {
            e.reply(`手动清理垃圾时发生错误: ${ err.message }`);
        }
    }
}


/**
 * 清理垃圾文件
 * @param e
 * @returns {Promise<void>}
 */
async function autoclearTrash(e) {
    const dataDirectory = "./data/";
    try {
        const files = await readCurrentDir(dataDirectory);
        let dataClearFileLen = 0;
        for (const file of files) {
            if (/^[0-9a-f]{32}$/.test(file)) {
                await fs.promises.unlink(dataDirectory + file);
                dataClearFileLen++;
            }
        }
        const rTempFileLen = await deleteFolderRecursive(defaultPath);
        return {
            dataClearFileLen,
            rTempFileLen
        };
    } catch (err) {
        logger.error(err);
        throw err;
    }
}

function autoclear(time) {
    schedule.scheduleJob(time, async function () {
        try {
            const { dataClearFileLen, rTempFileLen } = await autoclearTrash();
            console.log(`自动清理垃圾完成:\n` +
                `- 清理了${ dataClearFileLen }个垃圾文件\n` +
                `- 清理了${ rTempFileLen }个群临时文件`);
        } catch (err) {
            console.error(`自动清理垃圾时发生错误: ${ err.message }`);
        }
    })
}

//自动清理垃圾
autoclear(autotime)
