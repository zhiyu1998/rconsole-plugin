// 主库
import fetch from 'node-fetch'
import fs from "node:fs";
import { segment } from 'oicq'
// 其他库
import md5 from 'md5'
import https from 'https'
import axios from 'axios'

export class tools extends plugin {
    constructor() {
        super({
            name: '工具和学习类',
            dsc: '工具相关指令',
            event: 'message.group',
            priority: 500,
            rule: [
                {
                    reg: '^#(翻译)(.*)$', fnc: 'trans'
                },
                {
                    reg: '(.*)(v.douyin.com)', fnc: 'douyin'
                }
            ]
        })
        this.path = "./data/mp4/";
    }

    // 翻译插件
    async trans(e) {
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
        const urlRex = /(http:|https:)\/\/v.douyin.com\/[A-Za-z\d._?%&+\-=\/#]*/g
        const douUrl = urlRex.exec(e.msg.trim())[0]

        await https.request(douUrl, {
            method: 'HEAD', headers: {
                'User-Agent':
                    'Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36'
            }, timeout: 10000
        }, (res) => {
            const location = res.headers['location']
            const douRex = /.*video\/(\d+)\/(.*?)/g
            const douId = douRex.exec(location)[1]
            const url = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${douId}`
            e.reply('解析中...')
            return fetch(url)
                .then(resp => resp.json())
                .then(json => json.item_list[0])
                .then(item => item.video.play_addr.url_list[0])
                .then(async url => {
                    await e.reply(await segment.video(await this.downloadVideo(url)))
                })
        }).on('error', (err) => {
            console.error(err);
        }).end();
        return true;
    }

    // 根URL据下载视频 / 音频
    async downloadVideo (url) {
        const target = `${this.path}${this.e.group_id || this.e.user_id}/temp.mp4`
        if (fs.existsSync(target)) {
            console.log(`视频已存在`);
            fs.unlinkSync(target)
        } else {
            fs.mkdirSync(`${this.path}${this.e.group_id || this.e.user_id}`)
        }
        const res = await axios.get(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36'
            },
            responseType: "stream",
        });
        console.log(`开始下载: ${url}`);
        const writer = fs.createWriteStream(target);
        res.data.pipe(writer);
        new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });
        return target
    };
}
