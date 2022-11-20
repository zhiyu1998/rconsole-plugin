import fetch from 'node-fetch'
import md5 from 'md5'

export class tools extends plugin {
    constructor () {
        super({
            name: '工具和学习类',
            dsc: '工具相关指令',
            event: 'message.group',
            priority: 500,
            rule: [
                {
                    reg: '^#(翻译)(.*)$', fnc: 'trans'
                }
            ]
        })
    }

    // 翻译插件
    async trans (e) {
        let place = e.msg.replace(/#|翻译/g, '').trim()
        let url = /[\u4E00-\u9FFF]+/g.test(place) ? `http://api.fanyi.baidu.com/api/trans/vip/translate?from=zh&to=en&appid=20210422000794040&salt=542716863&sign=${md5('20210422000794040' + place + '542716863' + 'HooD_ndgwcGH6SAnxGrM')}&q=${place}` : `http://api.fanyi.baidu.com/api/trans/vip/translate?from=en&to=zh&appid=20210422000794040&salt=542716863&sign=${md5('20210422000794040' + place + '542716863' + 'HooD_ndgwcGH6SAnxGrM')}&q=${place}`
        await fetch(url)
            .then(resp => resp.json())
            .then(text => text.trans_result)
            .then(res => this.reply(`${res[0].dst}`, true))
            .catch((err) => logger.error(err))
        return true
    }
}
