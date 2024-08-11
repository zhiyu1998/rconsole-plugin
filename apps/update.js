// 主库
import Version from "../model/version.js";
import config from "../model/config.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import lodash from "lodash";
import YAML from "yaml";
import fs from "node:fs";
import path from "path";

import { exec, execSync } from "node:child_process";
import { copyFiles, deleteFolderRecursive, readCurrentDir } from "../utils/file.js";

/**
 * 处理插件更新1
 */
export class Update extends plugin {
    static pluginName = (() => {
        const packageJsonPath = path.join('./plugins', 'rconsole-plugin', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return packageJson.name;
    })();
    constructor() {
        super({
            name: "R插件更新插件",
            dsc: "R插件更新插件代码",
            event: "message",
            priority: 4000,
            rule: [
                {
                    reg: "^#*R(插件)?版本$",
                    fnc: "version",
                },
                {
                    /** 命令正则匹配 */
                    reg: "^#*R(插件)?(强制更新|更新)$",
                    /** 执行方法 */
                    fnc: "rconsoleUpdate",
                },
            ],
        });

        this.versionData = config.getConfig("version");
    }

    /**
     * rule - 插件版本信息
     */
    async version() {
        const data = await new Version(this.e).getData(this.versionData.slice(0, 3));
        let img = await puppeteer.screenshot("version", data);
        this.e.reply(img);
    }

    /**
     * 更新主程序
     * @param e
     * @returns {Promise<boolean>}
     */
    async rconsoleUpdate(e) {
        if (!e.isMaster) {
            await e.reply("您无权操作");
            return true;
        }

        let isForce = !!e.msg.includes("强制");

        // 保存配置文件
        await copyFiles(`./plugins/${Update.pluginName}/config`, "./temp/rconsole-update-tmp");

        let command = `git -C ./plugins/${Update.pluginName}/ pull --no-rebase`;
        if (isForce) {
            command = `git -C ./plugins/${Update.pluginName}/ checkout . && ${command}`;
        }
        this.oldCommitId = await this.getCommitId(Update.pluginName);
        await e.reply("正在执行更新操作，请稍等");

        let ret = await this.execSync(command);
        if (ret.error) {
            e.reply(`更新失败！重试一下！`);
            await this.gitErr(ret.error, ret.stdout);
            return false;
        }
        const time = await this.getTime(Update.pluginName);
        if (/Already up|已经是最新/g.test(ret.stdout)) {
            e.reply(`R插件已经是最新: ${this.versionData[0].version}`);
        } else {
            this.isUp = true;
            e.reply(`R插件更新成功，最后更新时间：${time}`);
            e.reply(await this.getLog(Update.pluginName));
        }

        // 读取配置文件比对更新
        const confFiles = await readCurrentDir("./temp/rconsole-update-tmp");
        for (let confFile of confFiles) {
            await this.compareAndUpdateYaml(
                `./temp/rconsole-update-tmp/${confFile}`,
                `./plugins/${Update.pluginName}/config/${confFile}`
            );
        }
        // 删除临时文件
        await deleteFolderRecursive("./temp/rconsole-update-tmp");

        return true;
    }

    async getCommitId(pluginName) {
        // let cm = 'git rev-parse --short HEAD'
        const command = `git -C ./plugins/${pluginName}/ rev-parse --short HEAD`;
        let commitId = execSync(command, { encoding: "utf-8" });
        commitId = lodash.trim(commitId);
        return commitId;
    }

    async execSync(cmd) {
        return new Promise((resolve, reject) => {
            exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
                resolve({ error, stdout, stderr });
            });
        });
    }

    async getTime(pluginName) {
        const cm = `cd ./plugins/${pluginName}/ && git log -1 --oneline --pretty=format:"%cd" --date=format:"%m-%d %H:%M"`;
        let time = "";
        try {
            time = execSync(cm, { encoding: "utf-8" });
            time = lodash.trim(time);
        } catch (error) {
            time = "获取时间失败";
        }
        return time;
    }

    async getLog(pluginName) {
        let cm =
            'git log  -20 --oneline --pretty=format:"%h||[%cd]  %s" --date=format:"%m-%d %H:%M"';
        if (pluginName) {
            cm = `cd ./plugins/${pluginName}/ && ${cm}`;
        }
        let logAll;
        try {
            logAll = execSync(cm, { encoding: "utf-8" });
        } catch (error) {
            this.reply(error.toString(), true);
        }
        if (!logAll) return false;
        logAll = logAll.split("\n");
        let log = [];
        for (let str of logAll) {
            str = str.split("||");
            if (str[0] === this.oldCommitId) break;
            if (str[1].includes("Merge branch")) continue;
            log.push(str[1]);
        }
        let line = log.length;
        log = log.join("\n");
        if (log.length <= 0) return "";
        logger.info(`${pluginName || "Yunzai-Bot"}更新日志，共${line}条\n${log}`);
        return log;
    }

    async gitErr(err, stdout) {
        let msg = "更新失败！";
        let errMsg = err.toString();
        stdout = stdout.toString();
        if (errMsg.includes("Timed out")) {
            await this.reply(msg + `\n连接超时：${errMsg.match(/'(.+?)'/g)[0].replace(/'/g, "")}`);
        } else if (/Failed to connect|unable to access/g.test(errMsg)) {
            await this.reply(msg + `\n连接失败：${errMsg.match(/'(.+?)'/g)[0].replace(/'/g, "")}`);
        } else if (errMsg.includes("be overwritten by merge")) {
            await this.reply(
                msg +
                `存在冲突：\n${errMsg}\n` +
                "请解决冲突后再更新，或者执行#R强制更新，放弃本地修改",
            );
        } else if (stdout.includes("CONFLICT")) {
            await this.reply([
                msg + "存在冲突\n",
                errMsg,
                stdout,
                "\n请解决冲突后再更新，或者执行#R强制更新，放弃本地修改",
            ]);
        } else {
            await this.reply([errMsg, stdout]);
        }
    }

    async compareAndUpdateYaml(sourcePath, updatedPath) {
        try {
            // Step 1 & 2: Read and parse YAML files
            const sourceContent = await fs.readFileSync(sourcePath, 'utf8');
            const updatedContent = await fs.readFileSync(updatedPath, 'utf8');
            const sourceObj = YAML.parse(sourceContent);
            const updatedObj = YAML.parse(updatedContent);

            // Step 3: Compare objects and merge changes
            Object.keys(updatedObj).forEach(key => {
                if (!sourceObj.hasOwnProperty(key)) {
                    sourceObj[key] = updatedObj[key]; // Add new keys with updated values
                }
            });

            Object.keys(sourceObj).forEach(key => {
                if (!updatedObj.hasOwnProperty(key)) {
                    delete sourceObj[key]; // Remove keys not present in updated object
                }
            });

            // Step 4 & 5: Convert object back to YAML
            const newYamlContent = YAML.stringify(sourceObj);

            // Step 6: Write the updated YAML back to the updatedPath
            await fs.writeFileSync(updatedPath, newYamlContent, 'utf8');

            logger.info(`[R插件更新配置文件记录]${updatedPath}`);
        } catch (error) {
            logger.error(error);
        }
    }
}
