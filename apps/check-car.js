import _ from 'lodash'
import { createRequire } from 'module'

const setimetu = 60  //消息撤回时间

//作者MiX
//使用前请用电脑浏览器打开https://whatslink.info/，然后获取到cookie填入第45行以获得更高的请求。

export class checkCar extends plugin {
    constructor() {
        super({
            name: '验车',
            dsc: '验车',
            event: 'message',
            priority: -100,
            rule: [
                {
                    reg: '^#验车(.*?)',
                    fnc: 'yc'
                },
            ]
        })
    }


    async yc(e) {
        // 检查用户是否为管理员，如果不是则回复相应消息并返回。取消注释即仅主人可用
        //if (!e.isMaster) {
        //  e.reply("涩批！不给你看😡", true);
        //  return true;
        //}

        // 从消息中提取关键词
        let tag = e.msg.replace(/#验车/g, "");
        const tags = `磁力：${tag}`;

        // 构造获取涩图的URL
        const api = `https://whatslink.info/api/v1/link?url=${tag}`;
        const options = {
            method: 'GET',
            headers: ({
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Connection': 'keep-alive',
                'Cookie': 'aliyungf_tc=786a8710254a682250630ad426a4b444be3d405cfbdaa1e6e9b98f6d94487eb1',
                'Host': 'whatslink.info',
                'Referer': 'https://whatslink.info/',
                'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            })
        };

        // 使用fetch获取数据
        const response = await fetch(api, options);
        const data = await response.json();
        logger.info('验车data----------', data)
        const screenshots = data.screenshots
        if (screenshots === null) {
            await e.reply(data.name, false, { recallMsg: setimetu })
            return true
        } else {
            const jsonusedata = data.screenshots.map(item => ({
                url: item.screenshot,
            }));
            const image = []
            for (const { url } of jsonusedata) {
                image.push({
                    urls: segment.image(url),
                }
                );
            }

            // 构造回复消息
            let type = `文件类型：${data.file_type}`
            let Msg = await this.makeForwardMsg(e, [tags, data.name, type, image]);
            // e.reply(await Bot.makeForwardMsg(image))
            await e.reply(Msg);
            // await e.reply(Msg, false, { recallMsg: setimetu });
            return true;
        }
    }

    async makeForwardMsg(e, msg = [], dec = '') {
        let userInfo = {
            nickname: e.nickname,
            user_id: e.user_id
        }

        let forwardMsg = []
        msg.forEach(v => {
            if (Array.isArray(v)) {
                v.forEach(vv => {
                    forwardMsg.push({
                        ...userInfo,
                        message: vv.urls
                    })
                })
            } else {
                forwardMsg.push({
                    ...userInfo,
                    message: v
                })
            }
        })

        if (e.isGroup) {
            forwardMsg = await e.group.makeForwardMsg(forwardMsg)
        } else if (e.friend) {
            forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
        } else {
            return false
        }

        if (dec) {
            if (typeof (forwardMsg.data) === 'object') {
                let detail = forwardMsg.data?.meta?.detail
                if (detail) {
                    detail.news = [{ text: dec }]
                }
            } else {
                forwardMsg.data = forwardMsg.data
                    .replace('<?xml version="1.0" encoding="utf-8"?>', '<?xml version="1.0" encoding="utf-8" ?>')
                    .replace(/\n/g, '')
                    .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
                    .replace(/___+/, `<title color="#777777" size="26">${dec}</title>`)
            }

        }
        return forwardMsg
    }
}
