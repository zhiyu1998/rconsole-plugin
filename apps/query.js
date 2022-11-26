// 主库
import { segment } from 'oicq'
import fetch from 'node-fetch'
// 配置文件
import config from '../model/index.js'
// 爬虫库
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import _ from 'lodash'

export class query extends plugin {
    constructor () {
        super({
            name: '查询类',
            dsc: '查询相关指令',
            event: 'message.group',
            priority: 500,
            rule: [
                {
                    reg: '^#*医药查询 (.*)$',
                    fnc: 'doctor'
                },
                {
                    reg: '^#(cat)$',
                    fnc: 'cat'
                },
                {
                    reg: '^#电脑软件推荐$', /** 执行方法 */
                    fnc: 'computerRecommended'
                },
                {
                    reg: '^#安卓软件推荐$', /** 执行方法 */
                    fnc: 'androidRecommended'
                },
                {
                    reg: '^#(热搜)(.*)$',
                    fnc: 'hotSearch'
                }
            ]
        })
        this.catConfig = config.getConfig('query')
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
                message: { type: 'text', text: `${ template }` }, nickname: Bot.nickname, user_id: Bot.user_id
            })
        }
        /** 最后回复消息 */
        return !!this.reply(await Bot.makeForwardMsg(msg))
    }

    async cat (e) {
        const numb = this.catConfig.count
        let images = []
        let reqRes = [ ...await fetch(`https://shibe.online/api/cats?count=${ numb }`).then(data => data.json()), ...await fetch(`https://api.thecatapi.com/v1/images/search?limit=${ numb }`).then(data => data.json()).then(json => json.map(item => item.url)) ]
        e.reply('涩图也不看了,就看猫是吧, 探索中...')
        reqRes.forEach(item => {
            images.push({
                message: segment.image(item), nickname: this.e.sender.card || this.e.user_id, user_id: this.e.user_id
            })
        })
        return !!(await this.reply(await Bot.makeForwardMsg(images)))
    }

    async computerRecommended (e) {
        let url = 'https://www.ghxi.com/ghapi?type=query&n=pc'
        /** 调用接口获取数据 */
        let res = await fetch(url).catch((err) => logger.error(err))

        /** 接口结果，json字符串转对象 */
        res = await res.json()
        let msg = []
        res.data.list.forEach((element) => {
            const template = `推荐软件：${ element.title }\n地址：${ element.url }\n`
            msg.push({
                message: { type: 'text', text: `${ template }` }, nickname: Bot.nickname, user_id: Bot.user_id
            })
        })
        /** 最后回复消息 */
        return !!this.reply(await Bot.makeForwardMsg(msg))
    }

    async androidRecommended (e) {
        let url = 'https://www.ghxi.com/ghapi?type=query&n=and'
        let res = await fetch(url).catch((err) => logger.error(err))
        res = await res.json()
        let msg = []
        res.data.list.forEach((element) => {
            const template = `推荐软件：${ element.title }\n地址：${ element.url }\n`
            msg.push({
                message: { type: 'text', text: `${ template }` }, nickname: Bot.nickname, user_id: Bot.user_id
            })
        })
        return !!this.reply(await Bot.makeForwardMsg(msg))
    }

    async hotSearch (e) {
        let keyword = e.msg.replace(/#|热搜/g, '').trim()
        console.log(keyword)
        // 虎扑/知乎/36氪/百度/哔哩哔哩/贴吧/微博/抖音/豆瓣/少数派/IT资讯/微信
        let url = 'https://api.vvhan.com/api/hotlist?type='
        switch (keyword) {
            case '虎扑':
                url += 'hupu'
                break
            case '知乎':
                url += 'zhihuHot'
                break
            case '36氪':
                url += '36Ke'
                break
            case '百度':
                url += 'baiduRD'
                break
            case '哔哩哔哩':
                url += 'bili'
                break
            case '贴吧':
                url += 'baiduRY'
                break
            case '微博':
                url += 'wbHot'
                break
            case '抖音':
                url += 'douyinHot'
                break
            case '豆瓣':
                url += 'douban'
                break
            case '少数派':
                url += 'ssPai'
                break
            case 'IT资讯':
                url += 'itInfo'
                break
            case '微信':
                url += 'wxHot'
                break
            default:
                url += 'history'
                break
        }
        let sendTemplate = {
            nickname: this.e.sender.card || this.e.user_id, user_id: this.e.user_id
        }
        let msg = []
        await fetch(url)
            .then((resp) => resp.json())
            .then((resp) => {
                for (let element of resp.data) {
                    if (_.isUndefined(element)) {
                        continue
                    }
                    const template = `
                      标题：${ _.isNull(element.title)  ? '暂无' : element.title}\n
                      简介：${ _.isNull(element.desc) ? '暂无' : element.desc }\n
                      热度：${ _.isNull(element.hot)  ? '暂无' : element.hot}\n
                      访问详情：${ _.isNull(element.url)  ? '暂无' : element.url}\n
                    `;
                    msg.push({
                        message: { type: 'text', text: `${ template }` },
                        ...sendTemplate
                    })
                }
            })
            .catch((err) => logger.error(err))
        return !!this.reply(await Bot.makeForwardMsg(msg))
    }


    // 删除标签
    removeTag (title) {
        const titleRex = /<[^>]+>/g
        return title.replace(titleRex, '')
    }
}
