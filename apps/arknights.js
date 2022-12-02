
import { segment } from "oicq";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";

export class arknights extends plugin {
    constructor (e) {
        super({
            name: '明日方舟',
            dsc: '明日方舟信息查询',
            event: 'message',
            priority: 500,
            rule: [
                {
                    reg: '^#(明日方舟wiki|arkwiki)(.*)$',
                    fnc: 'arkWiki'
                }
            ]
        })
    }

    async arkWiki (e) {
        const key = e.msg.replace(/#|明日方舟wiki|arkwiki/g, "").trim();
        const browser = await puppeteer.browserInit()
        const page = await browser.newPage()
        await page.goto(`https://wiki.biligame.com/arknights/${ key }`)
        const wikiImg = await page.screenshot({
            fullPage: true, type: 'jpeg', omitBackground: false, quality: 90
        })
        browser.close()
        await e.reply(segment.image(wikiImg))
    }
}