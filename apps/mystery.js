// 主库
import { segment } from 'oicq'
import common from '../../../lib/common/common.js'
import fetch from 'node-fetch'
// 配置文件
import config from '../model/index.js'
// 其他库
import _ from 'lodash'
import mongodb from 'mongodb'

// Mongodb初始化
function initMongo () {
    const MongoClient = mongodb.MongoClient
    const url = 'mongodb://localhost:27017/'
    return new Promise((resolve, reject) => {
        MongoClient.connect(url, (err, db) => {
            const dbo = db.db('test')
            if (err) {
                throw err // 和调用 reject(err) 效果类似
            }
            let collection = dbo.collection('temp')
            resolve(collection)
        })
    })
}

const mongo = initMongo()
// 60s后撤回
const recallTime = 109

export class mystery extends plugin {
    constructor () {
        super({
            name: '神秘区域',
            dsc: '神秘指令',
            event: 'message.group',
            priority: 500,
            rule: [
                {
                    reg: '^#(雀食|确实)$', fnc: 'mystery'
                },
                {
                    reg: '^#来份涩图$', fnc: 'setu'
                },
                {
                    reg: '^#(累了)$', fnc: 'cospro'
                },
                {
                    reg: '^#(啊?|啊？)$', fnc: 'aaa'
                },
                {
                    reg: '^#沃日吗$', fnc: 'tuiimg'
                }
            ]
        })
        this.mysteryConfig = config.getConfig('mystery')
    }

    // 接受到消息都会先执行一次
    async accept () {
        let oldReply = this.e.reply

        this.e.reply = async function (msgs, quote, data) {
            if (!msgs) return false
            if (!Array.isArray(msgs)) msgs = [ msgs ]
            let result = await oldReply(msgs, quote, data)

            if (!result || !result.message_id) {
                let isxml = false

                for (let msg of msgs) {
                    if (msg && msg?.type == 'xml' && msg?.data) {
                        msg.data = msg.data.replace(/^<\?xml.*update=.*?>/g, '<?xml update="1.0" encoding="utf-8" ?>')
                        isxml = true
                    }
                }

                if (isxml) {
                    result = await oldReply(msgs, quote, data)
                } else {
                    let MsgList = [ {
                        message: msgs, nickname: Bot.nickname, user_id: Bot.user_id
                    } ]

                    let forwardMsg = await Bot.makeForwardMsg(MsgList)

                    forwardMsg.data = forwardMsg.data
                        .replace('<?xml update="1.0" encoding="utf-8"?>', '<?xml update="1.0" encoding="utf-8" ?>')
                        .replace(/\n/g, '')
                        .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
                        .replace(/___+/, '<title color="#777777" size="26">请点击查看内容</title>')
                    msgs = forwardMsg
                    result = await oldReply(msgs, quote, data)
                }

                if (!result || !result.message_id) {
                    logger.error('风控消息处理失败，请登录手机QQ查看是否可手动解除风控！')
                }
            }
            return result
        }
    }

    async mystery (e) {
        // 最大页数
        const maxPage = this.mysteryConfig.mystery.maxPage
        const maxPigObj = this.mysteryConfig.mystery.maxPigObj
        // 限制最大图片数量
        const imageCountLimit = this.mysteryConfig.mystery.imageCountLimit
        // 随机算法
        const page = _.random(1, maxPage)
        const randomIndex = _.random(0, maxPigObj - 1)
        // 回复
        this.reply('确实是吧, 正在探索...')
        // 请求
        let url = `https://www.cos6.net/wp-json/wp/v2/posts?page=${ page }`
        let images = []
        await fetch(url)
            .then((resp) => {
                return resp.json()
            })
            .then((json) => {
                const template = {
                    nickname: this.e.sender.card || this.e.user_id,
                    user_id: this.e.user_id
                }

                const content = json[randomIndex].content
                images = this.getCos6Img(content.rendered)
                // 洗牌
                images = _.shuffle(images)
                // 限制长度
                if (images.length > imageCountLimit) {
                    images = images.slice(1, imageCountLimit + 1)
                }
                // 循环队列
                for (let i = 0; i < images.length; i++) {
                    images[i] = {
                        message: segment.image(images[i]),
                        ...template
                    }
                }
            })
            .catch((err) => {
                this.e.reply('探索失败，你再我去一次吧')
                logger.error(err)
                return false
            })
        return !!(await this.reply(await Bot.makeForwardMsg(images)))
    }

    async cospro (e) {
        let req = [ ...await fetch('https://imgapi.cn/cos2.php?return=jsonpro').then((resp) => resp.json()).then((json) => json.imgurls), ...await fetch('https://imgapi.cn/cos.php?return=jsonpro').then((resp) => resp.json()).then((json) => json.imgurls) ]
        e.reply('哪天克火掉一定是在这个群里面...')
        let images = []
        req.forEach(item => {
            images.push({
                message: segment.image(encodeURI(item)),
                nickname: this.e.sender.card || this.e.user_id,
                user_id: this.e.user_id
            })
        })
        return !!(await this.reply(await Bot.makeForwardMsg(images)))
    }

    async aaa (e) {
        // https://yingtall.com/wp-json/wp/v2/posts?page=64
        // 最大页数
        const maxPage = this.mysteryConfig.aaa.maxPage
        const maxPigObj = this.mysteryConfig.aaa.maxPigObj
        // 限制最大图片数量
        const imageCountLimit = this.mysteryConfig.aaa.imageCountLimit
        // 随机算法
        const page = _.random(1, maxPage)
        const randomIndex = _.random(0, maxPigObj - 1)
        // 回复
        this.reply('真变态啊...')
        // 请求
        let images = []
        let imgData = []
        let url = `https://yingtall.com/wp-json/wp/v2/posts?page=${ page }`
        await fetch(url)
            .then((resp) => {
                return resp.json()
            })
            .then((json) => {
                if (!json.length) {
                    e.reply('探索失败，你再我去一次吧')
                    return false
                }
                const content = json[randomIndex].content
                images = this.getImages2(content.rendered)
                // 如果图片为空直接返回
                if (images.length === 0) {
                    e.reply('探索失败，你再我去一次吧')
                    return false
                }
                // 洗牌
                images = _.shuffle(images)
                // 限制长度
                if (images.length > imageCountLimit) {
                    images = images.slice(1, imageCountLimit + 1)
                }
                // 循环队列
                images.forEach((item) => {
                    imgData.push({
                        message: segment.image(item),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id
                    })
                })
            })
            .catch((err) => logger.error(err))
        return !!(await this.reply(await Bot.makeForwardMsg(imgData)))
    }

    async setu (e) {
        const numb = this.mysteryConfig.setu.count
        // 图源
        const urlList = [ 'https://iw233.cn/api.php?sort=random', 'https://iw233.cn/API/Random.php' ]
        e.reply('探索中...')
        let images = []
        for (let i = numb; i > 0; i--) {
            urlList.forEach(url => {
                images.push({
                    message: segment.image(url), nickname: this.e.sender.card || this.e.user_id, user_id: this.e.user_id
                })
            })
            await common.sleep(200)
        }
        return !!(await this.reply(await Bot.makeForwardMsg(images)))
    }

    async tuiimg (e) {
        const MAX_SIZE = this.mysteryConfig.tuiimg.count
        this.reply('这群早晚被你整没了...')
        let images = []
        const template = {
            nickname: this.e.sender.card || this.e.user_id, user_id: this.e.user_id
        }
        await mongo.then(conn => {
            return conn.aggregate([ { $sample: { size: MAX_SIZE } } ]).toArray()
        }).then((result) => {
            result.forEach((item) => {
                images.push({
                    message: segment.image(item.url), ...template
                })
            })
        })
        return !!(await this.reply(await Bot.makeForwardMsg(images), false, {
            recallMsg: recallTime
        }))
    }

    // 正则：获取图片
    getCos6Img (string) {
        const imgRex = /\/([\w].*?).(jpg|JPG|png|PNG|gif|GIF|jpeg|JPEG|svg)/g
        const images = []
        let img
        while ((img = imgRex.exec(string))) {
            images.push(`https://www.cos6.net/${img[1]}.jpg`)
        }
        return images
    }

    // 正则：获取图片
    getImages2 (string) {
        const imgRex = /<img.*?src="(.*?)"[^>]+>/g
        const images = []
        let img
        while ((img = imgRex.exec(string))) {
            images.push(img[1])
        }
        return images
    }
}
