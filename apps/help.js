import Help from "../model/help.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import md5 from "md5";

export class help extends plugin {
    constructor(e) {
        super({
            name: "R插件帮助",
            dsc: "R插件帮助插件帮助",
            event: "message",
            priority: 500,
            rule: [
                {
                    reg: "^#*(R|r)(插件)?(命令|帮助|菜单|help|说明|功能|指令|使用说明)$",
                    fnc: "help",
                },
            ],
        });
    }

    async help() {
        let data = await Help.get(this.e);
        if (!data) {
            return;
        }
        let img = await this.cache(data);
        await this.reply(img);
    }

    async cache(data) {
        let tmp = md5(JSON.stringify(data));
        if (help.helpData.md5 === tmp) {
            return help.helpData.img;
        }

        help.helpData.img = await puppeteer.screenshot("help", data);
        help.helpData.md5 = tmp;

        return help.helpData.img;
    }

    static helpData = {
        md5: "",
        img: "",
    };
}
