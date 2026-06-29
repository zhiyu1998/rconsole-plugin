import schedule from 'node-schedule';
import { REDIS_YUNZAI_ISOVERSEA, REDIS_YUNZAI_WHITELIST } from "../constants/constant.js";
import config from "../model/config.js";
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
                },
                {
                    reg: "^#设置视频号[Cc]ookie\\s*(.*)$",
                    fnc: "setWeixinChannelCookie",
                    permission: "master",
                },
                {
                    reg: "^#微信文章解析模式\\s*(通用|元宝)?$",
                    fnc: "setWeixinArticleResolveMode",
                    permission: "master",
                }
            ]
        });
    }

    /**
     * 设置视频号解析所需的腾讯元宝 Cookie
     * 出于安全考虑，仅限私聊触发，避免在群里暴露 Cookie
     * 用法：
     *   1. 私聊发送 `#设置视频号Cookie`（不带参数）→ 查看当前状态与获取方法
     *   2. 私聊发送 `#设置视频号Cookie <cookie值>`→ 更新 Cookie
     *   3. 私聊发送 `#设置视频号Cookie 清除` → 清空 Cookie
     * 获取方法：浏览器登录 https://yuanbao.tencent.com → F12 → Network → 任意请求 → Request Headers → Cookie
     * @param e
     * @returns {Promise<boolean>}
     */
    async setWeixinChannelCookie(e) {
        // 强制私聊，防止群里泄露 Cookie（群消息一定有 group_id，私聊没有）
        if (e.group_id) {
            e.reply('⚠️ 该命令涉及 Cookie 安全，仅限私聊使用，请在私聊窗口发送');
            return true;
        }

        try {
            // 提取参数（去掉命令前缀，清理换行与首尾空白，避免粘贴带换行导致 Cookie 无效）
            const arg = e.msg.replace(/^#设置视频号[Cc]ookie\s*/i, '').replace(/\r?\n/g, '').trim();

            // 无参数：查看状态与帮助
            if (!arg) {
                const current = config.getConfig("tools").weixinChannelYuanbaoCookie;
                const masked = current ? `${current.slice(0, 10)}...（共${current.length}字符）` : '未设置';
                e.reply(
                    `视频号解析 Cookie 设置\n` +
                    `当前状态：${masked}\n\n` +
                    `使用方法：\n` +
                    `1. 更新 Cookie：#设置视频号Cookie <你的Cookie值>\n` +
                    `2. 清除 Cookie：#设置视频号Cookie 清除\n\n` +
                    `Cookie 获取方法：\n` +
                    `1. 浏览器访问并登录 https://yuanbao.tencent.com\n` +
                    `2. 按 F12 打开开发者工具 → Network 标签\n` +
                    `3. 刷新页面，点击任意请求 → Request Headers\n` +
                    `4. 复制 Cookie 字段的完整值`
                );
                return true;
            }

            // 清除 Cookie
            if (arg === '清除' || arg.toLowerCase() === 'clear') {
                config.updateField("tools", "weixinChannelYuanbaoCookie", "");
                e.reply('已清除视频号解析 Cookie');
                return true;
            }

            // 校验 Cookie 长度（元宝 Cookie 通常较长）
            if (arg.length < 20) {
                e.reply('⚠️ Cookie 长度过短，请检查是否复制完整（应包含多个 key=value 用分号分隔）');
                return true;
            }

            // 更新配置（config.updateField 会写入 tools.yaml，需重启插件后生效，与 weibo/douyin cookie 一致）
            config.updateField("tools", "weixinChannelYuanbaoCookie", arg);
            logger.mark(`[R插件][视频号] 管理员 ${e.user_id} 更新了腾讯元宝 Cookie（长度 ${arg.length}）`);
            e.reply(`✅ 视频号解析 Cookie 已写入配置文件（长度 ${arg.length}）\n⚠️ 需重启插件后生效，重启后发送视频号分享链接即可解析`);
            return true;
        } catch (err) {
            logger.error(`[R插件][视频号] 设置 Cookie 失败: ${err.message}`);
            e.reply(`设置视频号 Cookie 失败: ${err.message}`);
            return false;
        }
    }

    /**
     * 切换微信文章（mp.weixin.qq.com）解析模式
     *   - 通用模式 general：浏览器抓取页面正文 + 自配 AI（kimi/openai）总结（默认，现有逻辑）
     *   - 元宝模式 yuanbao：直接把链接发给腾讯元宝让其抓取并总结，与视频号共用元宝 Cookie
     *     优点：规避微信页面风控（"环境异常"），元宝服务器抓取不走用户服务器 IP
     *     注意：元宝对话接口有 IP 风控，部署服务器 IP 需与元宝登录 IP 一致，否则会 401
     *
     * 用法：
     *   1. `#微信文章解析模式`（不带参数）→ 查看当前模式
     *   2. `#微信文章解析模式 通用` → 切换到通用模式
     *   3. `#微信文章解析模式 元宝` → 切换到元宝模式
     * @param e
     * @returns {Promise<boolean>}
     */
    async setWeixinArticleResolveMode(e) {
        try {
            const arg = (e.msg.replace(/^#微信文章解析模式\s*/i, '').trim() || '').toLowerCase();
            const current = config.getConfig("tools").weixinArticleResolveMode || 'general';

            // 无参数：查看当前状态
            if (!arg) {
                const modeText = current === 'yuanbao' ? '元宝模式（走腾讯元宝抓取+总结）' : '通用模式（浏览器抓取+自配AI总结）';
                e.reply(
                    `微信文章解析模式\n` +
                    `当前模式：${modeText}\n\n` +
                    `可选模式：\n` +
                    `• 通用：浏览器抓取页面正文 + 自配 AI（kimi/openai）总结（默认）\n` +
                    `• 元宝：直接把链接发给腾讯元宝抓取总结，与视频号共用元宝 Cookie，规避微信页面风控\n\n` +
                    `切换命令：\n` +
                    `#微信文章解析模式 通用\n` +
                    `#微信文章解析模式 元宝\n\n` +
                    `注意：元宝模式依赖元宝 Cookie，请先通过 #设置视频号Cookie 配置；且元宝对话接口有 IP 风控，部署服务器 IP 需与元宝登录 IP 一致`
                );
                return true;
            }

            // 参数校验
            if (arg !== 'general' && arg !== 'yuanbao' && arg !== '通用' && arg !== '元宝') {
                e.reply('⚠️ 参数错误，仅支持「通用」或「元宝」');
                return true;
            }

            // 统一映射到英文枚举值
            const newMode = (arg === 'yuanbao' || arg === '元宝') ? 'yuanbao' : 'general';

            // 切到元宝模式时校验 Cookie 是否已配置（友好提示，但不阻止切换）
            if (newMode === 'yuanbao') {
                const cookie = config.getConfig("tools").weixinChannelYuanbaoCookie;
                if (!cookie) {
                    e.reply(
                        `⚠️ 已切换到元宝模式，但尚未配置腾讯元宝 Cookie\n` +
                        `请私聊发送 #设置视频号Cookie 进行设置\n` +
                        `（元宝 Cookie 同时用于视频号解析与微信文章元宝模式）`
                    );
                    config.updateField("tools", "weixinArticleResolveMode", newMode);
                    return true;
                }
            }

            config.updateField("tools", "weixinArticleResolveMode", newMode);
            const modeText = newMode === 'yuanbao' ? '元宝模式' : '通用模式';
            logger.mark(`[R插件][微信文章] 管理员 ${e.user_id} 切换解析模式为 ${modeText}`);
            e.reply(`✅ 微信文章解析模式已切换为：${modeText}\n⚠️ 需重启插件后生效`);
            return true;
        } catch (err) {
            logger.error(`[R插件][微信文章] 切换解析模式失败: ${err.message}`);
            e.reply(`切换解析模式失败: ${err.message}`);
            return false;
        }
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
            e.reply(`当前服务器：${os ? '海外服务器' : '国内服务器'}`);
            return true;
        } catch (err) {
            e.reply(`设置海外模式时发生错误: ${err.message}`);
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
            const { dataClearFileLen, rTempFileLen, rTempFolderLen } = await autoclearTrash();
            e.reply(`手动清理垃圾完成:\n` +
                `- 清理了${dataClearFileLen}个垃圾文件\n` +
                `- 清理了${rTempFolderLen}个空文件夹\n` +
                `- 清理了${rTempFileLen}个群临时文件`);
        } catch (err) {
            e.reply(`手动清理垃圾时发生错误: ${err.message}`);
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
            e.reply(`成功添加R信任用户：${trustUserId}`);
        } catch (err) {
            e.reply(`设置R信任用户时发生错误: ${err.message}`);
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
            const message = `R信任用户列表：\n${whiteList.join(",\n")}`;
            if (this.e.isGroup) {
                await Bot.pickUser(this.e.user_id).sendMsg(await this.e.runtime.common.makeForwardMsg(this.e, message));
                await this.reply('R插件的信任用户名单已发送至您的私信了~');
            } else {
                await e.reply(await makeForwardMsg(this.e, message));
            }
        } catch (err) {
            e.reply(`获取R信任用户时发生错误: ${err.message}`);
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
            e.reply(isInWhiteList ? `✅ ${trustUserId}已经是R插件的信任用户哦~` : `⚠️ ${trustUserId}不是R插件的信任用户哦~`);
        } catch (err) {
            e.reply(`查询R信任用户时发生错误: ${err.message}`);
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
            e.reply(`成功删除R信任用户：${trustUserId}`);
        } catch (err) {
            e.reply(`删除R信任用户时发生错误: ${err.message}`);
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
        const { files: rTempFileLen, folders: rTempFolderLen } = await deleteFolderRecursive(defaultPath);
        return { dataClearFileLen, rTempFileLen, rTempFolderLen };
    } catch (err) {
        logger.error(err);
        throw err;
    }
}

function autoclear(time) {
    schedule.scheduleJob(time, async function () {
        try {
            const { dataClearFileLen, rTempFileLen, rTempFolderLen } = await autoclearTrash();
            logger.info(`自动清理垃圾完成:\n` +
                `- 清理了${dataClearFileLen}个垃圾文件\n` +
                `- 清理了${rTempFolderLen}个空文件夹\n` +
                `- 清理了${rTempFileLen}个群临时文件`);
        } catch (err) {
            logger.error(`自动清理垃圾时发生错误: ${err.message}`);
        }
    });
}

// 自动清理垃圾
autoclear(autotime);
