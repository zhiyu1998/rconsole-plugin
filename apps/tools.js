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

    // 抖音解析
    async douyin(e) {
        const urlRex = /(http:|https:)\/\/v.douyin.com\/[A-Za-z\\d._?%&+\-=\/#]*/g
        puppeteer.launch().then(async browser => {
            const page = await browser.newPage();
            await page.goto(urlRex.exec(e.msg.trim())[0]);
            const headers = page.headers()
            console.log(headers)
            await browser.close();
        });
        const douyinRex = /.*video\/(\d+)\/(.*?)/g
        const resolver = douyinRex.exec(location)
        const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${resolver}`
        e.reply('解析中...')
        const res = fetch(url, {
            headers: {
                'User-Agent': "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36"
            },
            timeout: 10000
        }).then(resp => {
            return resp.body
        })
    }
}
