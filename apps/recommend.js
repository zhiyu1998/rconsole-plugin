import fetch from 'node-fetch'

export class recommend extends plugin {
    constructor () {
        super({
            name: '推荐软件',
            dsc: '推荐相关指令',
            event: 'message.group',
            priority: 500,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: '^#电脑软件推荐$', /** 执行方法 */
                    fnc: 'computerRecommended'
                }, {
                    /** 命令正则匹配 */
                    reg: '^#安卓软件推荐$', /** 执行方法 */
                    fnc: 'androidRecommended'
                }
            ]
        })
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
                message: { type: 'text', text: `${ template }` }, nickname: Bot.nickname, user_id: Bot.uin
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
                message: { type: 'text', text: `${ template }` }, nickname: Bot.nickname, user_id: Bot.uin
            })
        })
        return !!this.reply(await Bot.makeForwardMsg(msg))
    }
}
