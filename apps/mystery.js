// 主库
import { segment } from "oicq";
import fetch from "node-fetch";
// 配置文件
import config from "../model/index.js";
// 其他库
import _ from "lodash";

export class mystery extends plugin {
    constructor() {
        super({
            name: "神秘区域",
            dsc: "神秘指令",
            event: "message.group",
            priority: 500,
            rule: [
                {
                    reg: "^#(雀食|确实)$",
                    fnc: "mystery",
                },
                {
                    reg: "^#*来份涩图(.*)$",
                    fnc: "setu",
                },
                {
                    reg: "^#(累了)$",
                    fnc: "cospro",
                },
                {
                    reg: "^#(啊)$",
                    fnc: "aaa",
                },
            ],
        });
        this.mysteryConfig = config.getConfig("mystery");
    }

    /** 接受到消息都会先执行一次 */
    async accept() {
        if (this.e.isGroup) {
            let group = this.e.group;
            if (!group.is_owner && group.is_admin && group.mute_left > 0) return;
            if (!(group.is_owner || group.is_admin) && (group.all_muted || group.mute_left > 0))
                return;
        }

        let old_reply = this.e.reply;

        this.e.reply = async function (msgs, quote, data) {
            if (!msgs) return false;
            if (!Array.isArray(msgs)) msgs = [msgs];
            let result = await old_reply(msgs, quote, data);

            if (!result || !result.message_id) {
                let isxml = false;

                for (let msg of msgs) {
                    if (msg && msg?.type == "xml" && msg?.data) {
                        msg.data = msg.data.replace(
                            /^<\?xml.*version=.*?>/g,
                            '<?xml version="1.0" encoding="utf-8" ?>'
                        );
                        isxml = true;
                    }
                }

                if (isxml) {
                    result = await old_reply(msgs, quote, data);
                } else {
                    let MsgList = [
                        {
                            message: msgs,
                            nickname: Bot.nickname,
                            user_id: Bot.uin,
                        },
                    ];

                    let forwardMsg = await Bot.makeForwardMsg(MsgList);

                    forwardMsg.data = forwardMsg.data
                        .replace(
                            '<?xml version="1.0" encoding="utf-8"?>',
                            '<?xml version="1.0" encoding="utf-8" ?>'
                        )
                        .replace(/\n/g, "")
                        .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, "___")
                        .replace(/___+/, '<title color="#777777" size="26">请点击查看内容</title>');
                    msgs = forwardMsg;
                    result = await old_reply(msgs, quote, data);
                }

                if (!result || !result.message_id) {
                    logger.error("风控消息处理失败，请登录手机QQ查看是否可手动解除风控！");
                }
            }
            return result;
        };
    }

    async mystery(e) {
        // 最大页数
        const maxPage = this.mysteryConfig.mystery.maxPage;
        const maxPigObj = this.mysteryConfig.mystery.maxPigObj;
        // 限制最大图片数量
        const imageCountLimit = this.mysteryConfig.mystery.imageCountLimit;
        // 随机算法
        const page = _.random(1, maxPage);
        const randomIndex = _.random(0, maxPigObj - 1);
        // 回复
        this.reply("确实是吧, 正在探索...");
        // 请求
        let url = `https://www.cos6.net/wp-json/wp/v2/posts?page=${page}`;
        let images = [];
        await fetch(url)
            .then(resp => {
                return resp.json();
            })
            .then(json => {
                const template = {
                    nickname: this.e.sender.card || this.e.user_id,
                    user_id: this.e.user_id,
                };

                const content = json[randomIndex].content;
                images = this.getCos6Img(content.rendered);
                // 洗牌
                images = _.shuffle(images);
                // 限制长度
                if (images.length > imageCountLimit) {
                    images = images.slice(1, imageCountLimit + 1);
                }
                // 循环队列
                for (let i = 0; i < images.length; i++) {
                    images[i] = {
                        message: segment.image(images[i]),
                        ...template,
                    };
                }
            })
            .catch(err => {
                this.e.reply("探索失败，你再我去一次吧");
                logger.error(err);
                return false;
            });
        return !!(await this.reply(await Bot.makeForwardMsg(images)));
    }

    async cospro(e) {
        let req = [
            ...(await fetch("https://imgapi.cn/cos2.php?return=jsonpro")
                .then(resp => resp.json())
                .then(json => json.imgurls)),
            ...(await fetch("https://imgapi.cn/cos.php?return=jsonpro")
                .then(resp => resp.json())
                .then(json => json.imgurls)),
        ];
        e.reply("哪天克火掉一定是在这个群里面...");
        let images = [];
        req.forEach(item => {
            images.push({
                message: segment.image(encodeURI(item)),
                nickname: this.e.sender.card || this.e.user_id,
                user_id: this.e.user_id,
            });
        });
        return !!(await this.reply(await Bot.makeForwardMsg(images)));
    }

    async aaa(e) {
        // https://yingtall.com/wp-json/wp/v2/posts?page=64
        // 最大页数
        const maxPage = this.mysteryConfig.aaa.maxPage;
        const maxPigObj = this.mysteryConfig.aaa.maxPigObj;
        // 限制最大图片数量
        const imageCountLimit = this.mysteryConfig.aaa.imageCountLimit;
        // 随机算法
        const page = _.random(1, maxPage);
        const randomIndex = _.random(0, maxPigObj - 1);
        // 回复
        this.reply("真变态啊...");
        // 请求
        let images = [];
        let imgData = [];
        let url = `https://yingtall.com/wp-json/wp/v2/posts?page=${page}`;
        await fetch(url)
            .then(resp => {
                return resp.json();
            })
            .then(json => {
                if (!json.length) {
                    e.reply("请求失败，你再试一次吧");
                    return false;
                }
                const content = json[randomIndex].content;
                images = this.getImages2(content.rendered);
                // 如果图片为空直接返回
                if (images.length === 0) {
                    e.reply("请求失败，你再试一次吧");
                    return false;
                }
                // 洗牌
                images = _.shuffle(images);
                // 限制长度
                if (images.length > imageCountLimit) {
                    images = images.slice(1, imageCountLimit + 1);
                }
                // 循环队列
                images.forEach(item => {
                    imgData.push({
                        message: segment.image(item),
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    });
                });
            })
            .catch(err => logger.error(err));
        return !!(await this.reply(await Bot.makeForwardMsg(imgData)));
    }

    async setu(e) {
        const keyword = e.msg.split(" ")[1];
        const numb = this.mysteryConfig.setu.count;
        await e.reply("真变态啊...", true, { recallMsg: 7 });

        let url = `https://api.lolicon.app/setu/v2?r18=${keyword}&num=${numb}`; //←此处修改图片类型，0为非18，1为18，2为18非18混合
        const response = await fetch(url);
        const imgJson = await response.json();

        const images = [];
        for (let image of imgJson.data) {
            images.push({
                message: segment.image(image.urls.original),
                nickname: e.sender.card || e.user_id,
                user_id: e.user_id,
            });
        }

        const res = await this.reply(await Bot.makeForwardMsg(images), false, { recallMsg: 60 });

        if (!res) {
            return e.reply("请求失败，你再试一次吧", true, {
                recallMsg: 60,
            });
        }

        return true;
    }

    // 正则：获取图片
    getCos6Img(string) {
        const imgRex = /\/([\w].*?).(jpg|JPG|png|PNG|gif|GIF|jpeg|JPEG|svg)/g;
        const images = [];
        let img;
        while ((img = imgRex.exec(string))) {
            images.push(`https://www.cos6.net/${img[1]}.jpg`);
        }
        return images;
    }

    // 正则：获取图片
    getImages2(string) {
        const imgRex = /<img.*?src="(.*?)"[^>]+>/g;
        const images = [];
        let img;
        while ((img = imgRex.exec(string))) {
            images.push(img[1]);
        }
        return images;
    }
}
