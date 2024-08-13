import config from "../model/config.js";
import schedule from 'node-schedule';
import { REDIS_YUNZAI_ISOVERSEA, REDIS_YUNZAI_LAGRANGE, REDOS_YUNZAI_WHITELIST } from "../constants/constant.js";
import { deleteFolderRecursive, readCurrentDir } from "../utils/file.js";
import { redisExistAndGetKey, redisExistKey, redisGetKey, redisSetKey } from "../utils/redis-util.js";

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
                {
                    reg: "^#设置R信任用户(.*)",
                    fnc: "setWhiteList",
                    permission: "master",
                },
                {
                    reg: "^#R信任用户$",
                    fnc: "getWhiteList",
                    permission: "master",
                },
                {
                    reg: "^#查询R信任用户(.*)",
                    fnc: "searchWhiteList",
                    permission: "master",
                }
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
        let os = (await redisExistAndGetKey(REDIS_YUNZAI_ISOVERSEA)).os;
        // 设置
        os = ~os
        await redisSetKey(REDIS_YUNZAI_ISOVERSEA, {
            os: os,
        });
        e.reply(`当前服务器：${ os ? '海外服务器' : '国内服务器' }`)
        return true;
    }

    /**
     * 设置拉格朗日
     * @param e
     * @returns {Promise<boolean>}
     */
    async setLagrange(e) {
        // 查看当前设置
        let driver = (await redisExistAndGetKey(REDIS_YUNZAI_LAGRANGE)).driver;
        // 异常检测，之前算法出现问题，如果出现异常就检测纠正
        if (driver === -1) {
            driver = 1;
        }
        // 设置
        driver ^= 1;
        await redisSetKey({
            driver: driver,
        })
        e.reply(`当前驱动：${ driver ? '拉格朗日' : '其他驱动' }`)
        return true;
    }

    /**
     * 手动清理垃圾
     * @param e
     * @returns {Promise<void>}
     */
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

    /**
     * 设置解析信任用户
     * @param e
     * @returns {Promise<void>}
     */
    async setWhiteList(e) {
        let trustUserId;
        // 判断是不是回复用户命令
        if (e?.reply_id !== undefined) {
            trustUserId = (await e.getReply()).user_id;
        } else {
            // 如果不是回复就看发送内容
            trustUserId = e.msg.replace("#设置R信任用户", "");
        }
        // 用户ID检测
        if (trustUserId == null || trustUserId === "") {
            e.reply("无效的R信任用户");
            return;
        }
        let whiteList = await redisExistAndGetKey(REDOS_YUNZAI_WHITELIST);
        // 不存在就创建
        if (whiteList == null) {
            whiteList = [];
        }
        // 重复检测
        if (whiteList.includes(trustUserId)) {
            e.reply("R信任用户已存在，无须添加!");
            return;
        }
        whiteList = [...whiteList, trustUserId];
        // 放置到Redis里
        await redisSetKey(REDOS_YUNZAI_WHITELIST, whiteList);
        e.reply(`成功添加R信任用户：${ trustUserId }`);
    }

    /**
     * 获取信任用户名单
     * @param e
     * @returns {Promise<void>}
     */
    async getWhiteList(e) {
        let whiteList = await redisExistAndGetKey(REDOS_YUNZAI_WHITELIST);
        if (whiteList == null) {
            whiteList = [];
        }
        const message = `R信任用户列表：${ whiteList.join(",\n") }`;
        if (this.e.isGroup) {
            await Bot.pickUser(this.e.user_id).sendMsg(await this.e.runtime.common.makeForwardMsg(this.e, message));
            await this.reply('R插件的信任用户名单已发送至您的私信了~');
        } else {
            await e.reply(await makeForwardMsg(this.e, message));
        }
    }

    /**
     * 查询某个用户是否是信任用户
     * @param e
     * @returns {Promise<void>}
     */
    async searchWhiteList(e) {
        let trustUserId;
        // 判断是不是回复用户命令
        if (e?.reply_id !== undefined) {
            trustUserId = (await e.getReply()).user_id;
        } else {
            // 如果不是回复就看发送内容
            trustUserId = e.msg.replace("#设置R信任用户", "");
        }
        let whiteList = await redisExistAndGetKey(REDOS_YUNZAI_WHITELIST);
        if (whiteList == null) {
            e.reply("R插件当前没有任何信任用户！");
            return;
        }
        const isInWhiteList = whiteList.includes(trustUserId);
        if (isInWhiteList) {
            e.reply(`✅ ${trustUserId}已经是R插件的信任用户哦~`);
        } else {
            e.reply(`⚠️ ${trustUserId}不是R插件的信任用户哦~`);
        }
        return true;
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
