// 主库
import Version from '../model/version.js'
import config from '../model/index.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'

import { exec, execSync } from 'node:child_process'

const _path = process.cwd();

/**
 * 处理插件更新
 */
export class update extends plugin {
    constructor () {
        super({
            name: '更新插件',
            dsc: '更新插件代码',
            event: 'message',
            priority: 4000,
            rule: [
                {
                    reg: '^#*R(插件)?版本$',
                    fnc: 'version'
                },
                {
                    /** 命令正则匹配 */
                    reg: '^#(碎月更新|碎月强制更新)$',
                    /** 执行方法 */
                    fnc: 'rconsoleUpdate'
                },
            ]
        })

        this.versionData = config.getConfig('version')
    }

    /**
     * rule - 插件版本信息
     */
    async version () {
        const data = await new Version(this.e).getData(
            this.versionData.slice(0, 3)
        )
        let img = await puppeteer.screenshot('version', data)
        this.e.reply(img)
    }

    /**
     *
     * @param e oicq传递的事件参数e
     */
    async rconsoleUpdate(e) {
        if (!this.e.isMaster) {
            await this.e.reply("您无权操作");
            return true;
        }

        let isForce = !!this.e.msg.includes("强制");

        let command = "git pull";

        if (isForce) {
            command = "git checkout . && git pull";
            await this.e.reply("正在执行强制更新操作，请稍等");
        } else {
            await this.e.reply("正在执行更新操作，请稍等");
        }
        const th = this
        exec(command, { cwd: `${ _path }/plugins/rconsole-plugin/` }, async function (error, stdout, stderr) {
            if (error) {
                let isChanges = error.toString().includes("Your local changes to the following files would be overwritten by merge");

                let isNetwork = error.toString().includes("fatal: unable to access");

                if (isChanges) {
                    //git stash && git pull && git stash pop stash@{0}
                    //需要设置email和username，暂不做处理
                    await me.e.reply(
                        "失败！\nError code: " +
                        error.code +
                        "\n" +
                        error.stack +
                        "\n\n本地代码与远程代码存在冲突,上面报错信息中包含冲突文件名称及路径，请尝试处理冲突\n如果不想保存本地修改请使用【#强制更新】\n(注意：强制更新命令会忽略所有本地对R插件本身文件的修改，本地修改均不会保存，请注意备份)"
                    );
                } else if (isNetwork) {
                    await e.reply(
                        "失败！\nError code: " + error.code + "\n" + error.stack + "\n\n可能是网络问题，请关闭加速器之类的网络工具，或请过一会尝试。"
                    );
                } else {
                    await e.reply("失败！\nError code: " + error.code + "\n" + error.stack + "\n\n出错了。请尝试处理错误");
                }
            } else {
                if (/Already up to date/.test(stdout)) {
                    e.reply("目前已经是最新了~");
                    return true;
                }
                await th.restartApp();
            }
        });
    }

    async restartApp() {
        if (!this.e.isMaster) {
            await this.e.reply("您无权操作");
            return true;
        }
        await this.e.reply("开始执行重启，请稍等...");
        Bot.logger.mark("开始执行重启，请稍等...");

        let data = JSON.stringify({
            isGroup: !!this.e.isGroup,
            id: this.e.isGroup ? this.e.group_id : this.e.user_id,
        });

        try {

            await redis.set("Yunzai:rconsole:restart", data, { EX: 120 });

            let cm = `npm run start`;
            if (process.argv[1].includes("pm2")) {
                cm = `npm run restart`;
            }

            exec(cm, async (error, stdout, stderr) => {
                if (error) {
                    await redis.del(`Yunzai:rconsole:restart`);
                    await this.e.reply(`操作失败！\n${error.stack}`);
                    Bot.logger.error(`重启失败\n${error.stack}`);
                } else if (stdout) {
                    Bot.logger.mark("重启成功，运行已转为后台，查看日志请用命令：npm run log");
                    Bot.logger.mark("停止后台运行命令：npm stop");
                    process.exit();
                }
            });
        } catch (error) {
            redis.del(`Yunzai:rconsole:restart`);
            await this.e.reply(`操作失败！\n${error.stack}`);
        }

        return true;
    }
}
