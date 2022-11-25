// 主库
import { segment } from 'oicq'
import fetch from 'node-fetch'
// 爬虫库
import puppeteer from '../../../lib/puppeteer/puppeteer.js'

export class doctor extends plugin {
    constructor () {
        super({
            name: '医药查询',
            dsc: '医药相关指令',
            event: 'message.group',
            priority: 500,
            rule: [
                {
                    reg: '^#*医药查询 (.*)$',
                    fnc: 'doctor'
                }
            ]
        })
    }

    async doctor (e) {
        let keyword = e.msg.split(' ')[1]
        const url = `https://api2.dayi.org.cn/api/search2?keyword=${ keyword }&pageNo=1&pageSize=10`
        let res = await fetch(url)
            .then((resp) => resp.json())
            .then((resp) => resp.list)
        let msg = []
        for (const element of res) {
            const title = this.removeTag(element.title)
            const template = `
        ${ title }\n
        标签：${ element.secondTitle }\n
        介绍：${ element.introduction }
      `
            // 如果完全匹配，直接响应页面
            if (title === keyword) {
                const browser = await puppeteer.browserInit()
                const page = await browser.newPage()
                await page.goto(`https://www.dayi.org.cn/drug/${ element.id }`)
                let buff = await page.screenshot({
                    fullPage: true, type: 'jpeg', omitBackground: false, quality: 90
                })
                browser.close()
                await e.reply(segment.image(buff))
            }
            msg.push({
                message: { type: 'text', text: `${ template }` }, nickname: Bot.nickname, user_id: Bot.uin
            })
        }
        /** 最后回复消息 */
        return !!this.reply(await Bot.makeForwardMsg(msg))
    }

    // 删除标签
    removeTag (title) {
        const titleRex = /<[^>]+>/g
        return title.replace(titleRex, '')
    }
}
