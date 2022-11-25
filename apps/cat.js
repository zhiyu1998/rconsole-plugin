// 主库
import { segment } from 'oicq'
import fetch from 'node-fetch'
// 配置文件库
import config from '../model/index.js'

export class cat extends plugin {
    constructor () {
        super({
            name: '猫',
            dsc: '猫相关指令',
            event: 'message.group',
            priority: 500,
            rule: [
                {
                    reg: '^#(cat)$', fnc: 'cat'
                }
            ]
        })
        this.catConfig = config.getConfig('cat')
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
}
