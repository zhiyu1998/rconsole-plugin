import config from "../model/config.js";
import schedule from 'node-schedule';
import { REDIS_YUNZAI_ISOVERSEA, REDIS_YUNZAI_LAGRANGE, REDIS_YUNZAI_WHITELIST } from "../constants/constant.js";
import { deleteFolderRecursive, readCurrentDir } from "../utils/file.js";
import { redisExistAndGetKey, redisGetKey, redisSetKey } from "../utils/redis-util.js";

// 自动清理定时
const autotime = config.getConfig("tools").autoclearTrashtime;
// 视频保存路径
const defaultPath = config.getConfig("tools").defaultPath;

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
                },
                {
                    reg: "^#删除R信任用户(.*)",
                    fnc: "deleteWhiteList",
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
        try {
            // 查看当前设置
            let os = (await redisGetKey(REDIS_YUNZAI_ISOVERSEA))?.os;
            // 如果是第一次
            if (os === undefined) {
                await redisSetKey(REDIS_YUNZAI_ISOVERSEA, { os: false });
                os = false;
            }
            // 设置
            os = ~os;
            await redisSetKey(REDIS_YUNZAI_ISOVERSEA, { os });
            e.reply(`当前服务器：${ os ? '海外服务器' : '国内服务器' }`);
            return true;
        } catch (err) {
            e.reply(`设置海外模式时发生错误: ${ err.message }`);
            return false;
        }
    }

    /**
     * 设置拉格朗日
     * @param e
     * @returns {Promise<boolean>}
     */
    async setLagrange(e) {
        try {
            // 查看当前设置
            let driver = (await redisGetKey(REDIS_YUNZAI_LAGRANGE))?.driver;
            // 如果是第一次
            if (driver === undefined) {
                await redisSetKey(REDIS_YUNZAI_LAGRANGE, { driver: 1 });
                driver = 1;
            }
            // 异常检测，之前算法出现问题，如果出现异常就检测纠正
            if (driver === -1) {
                driver = 1;
            }
            // 设置
            driver ^= 1;
            await redisSetKey(REDIS_YUNZAI_LAGRANGE, { driver });
            e.reply(`当前驱动：${ driver ? '拉格朗日' : '其他驱动' }`);
            return true;
        } catch (err) {
            e.reply(`设置拉格朗日时发生错误: ${ err.message }`);
            return false;
        }
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
        try {
            let trustUserId = e?.reply_id !== undefined ? (await e.getReply()).user_id : e.msg.replace("#设置R信任用户", "").trim();
            trustUserId = trustUserId.toString();
            // 用户ID检测
            if (!trustUserId) {
                e.reply("无效的R信任用户");
                return;
            }
            let whiteList = await redisExistAndGetKey(REDIS_YUNZAI_WHITELIST) || [];
            // 重复检测
            if (whiteList.includes(trustUserId)) {
                e.reply("R信任用户已存在，无须添加!");
                return;
            }
            whiteList.push(trustUserId);
            // 放置到Redis里
            await redisSetKey(REDIS_YUNZAI_WHITELIST, whiteList);
            e.reply(`成功添加R信任用户：${ trustUserId }`);
        } catch (err) {
            e.reply(`设置R信任用户时发生错误: ${ err.message }`);
        }
    }

    /**
     * 获取信任用户名单
     * @param e
     * @returns {Promise<void>}
     */
    async getWhiteList(e) {
        try {
            let whiteList = await redisExistAndGetKey(REDIS_YUNZAI_WHITELIST) || [];
            const message = `R信任用户列表：\n${ whiteList.join(",\n") }`;
            if (this.e.isGroup) {
                await Bot.pickUser(this.e.user_id).sendMsg(await this.e.runtime.common.makeForwardMsg(this.e, message));
                await this.reply('R插件的信任用户名单已发送至您的私信了~');
            } else {
                await e.reply(await makeForwardMsg(this.e, message));
            }
        } catch (err) {
            e.reply(`获取R信任用户时发生错误: ${ err.message }`);
        }
    }

    /**
     * 查询某个用户是否是信任用户
     * @param e
     * @returns {Promise<void>}
     */
    async searchWhiteList(e) {
        try {
            let trustUserId = e?.reply_id !== undefined ? (await e.getReply()).user_id : e.msg.replace("#查询R信任用户", "").trim();
            let whiteList = await redisExistAndGetKey(REDIS_YUNZAI_WHITELIST) || [];
            const isInWhiteList = whiteList.includes(trustUserId);
            e.reply(isInWhiteList ? `✅ ${ trustUserId }已经是R插件的信任用户哦~` : `⚠️ ${ trustUserId }不是R插件的信任用户哦~`);
        } catch (err) {
            e.reply(`查询R信任用户时发生错误: ${ err.message }`);
        }
    }

    /**
     * 删除信任用户
     * @param e
     * @returns {Promise<void>}
     */
    async deleteWhiteList(e) {
        try {
            let trustUserId = e?.reply_id !== undefined ? (await e.getReply()).user_id : e.msg.replace("#删除R信任用户", "").trim();
            // 校准不是string的用户
            let whiteList = (await redisExistAndGetKey(REDIS_YUNZAI_WHITELIST))?.map(item => item.toString()) || [];
            // 重复检测
            if (!whiteList.includes(trustUserId)) {
                e.reply("R信任用户不存在，无须删除！");
                return;
            }
            whiteList = whiteList.filter(item => item !== trustUserId);
            // 放置到Redis里
            await redisSetKey(REDIS_YUNZAI_WHITELIST, whiteList);
            e.reply(`成功删除R信任用户：${ trustUserId }`);
        } catch (err) {
            e.reply(`删除R信任用户时发生错误: ${ err.message }`);
        }
    }
}

/**
 * 清理垃圾文件
 * @returns {Promise<Object>}
 */
async function autoclearTrash() {
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
        return { dataClearFileLen, rTempFileLen };
    } catch (err) {
        logger.error(err);
        throw err;
    }
}

function autoclear(time) {
    schedule.scheduleJob(time, async function () {
        try {
            const { dataClearFileLen, rTempFileLen } = await autoclearTrash();
            logger.info(`自动清理垃圾完成:\n` +
                `- 清理了${ dataClearFileLen }个垃圾文件\n` +
                `- 清理了${ rTempFileLen }个群临时文件`);
        } catch (err) {
            logger.error(`自动清理垃圾时发生错误: ${ err.message }`);
        }
    });
}

// 自动清理垃圾
autoclear(autotime);
