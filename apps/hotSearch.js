import _ from 'lodash'
import fetch from 'node-fetch'

export class hotSearch extends plugin {
    constructor () {
        super({
            name: '热搜查询',
            dsc: '热搜相关指令',
            event: 'message.group',
            priority: 500,
            rule: [
                {
                    reg: '^#(热搜)(.*)$', fnc: 'hotSearch'
                }
            ]
        })
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
}
