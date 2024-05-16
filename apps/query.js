// 主库
import fetch from "node-fetch";
// 爬虫库
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
// http库
import axios from "axios";
// url库
import url from 'url';
// 常量
import { CAT_LIMIT } from "../constants/constant.js";
// 配置文件
import config from "../model/index.js";
// 书库
import { getYiBook, getZBook, getZHelper } from "../utils/books.js";
// 工具类
import TokenBucket from '../utils/token-bucket.js'
import { downloadImg } from "../utils/common.js";
import { checkAndRemoveFile, toBase64 } from "../utils/file.js";
import { OpenaiBuilder } from "../utils/openai-builder.js";

export class query extends plugin {
    /**
     * 令牌桶 拿来限流
     * @type {TokenBucket}
     */
    static #tokenBucket = new TokenBucket(1, 1, 60);

    constructor() {
        super({
            name: "R插件查询类",
            dsc: "R插件查询相关指令",
            event: "message.group",
            priority: 500,
            rule: [
                {
                    reg: "^#医药查询(.*)$",
                    fnc: "doctor",
                },
                {
                    reg: "^#cat$",
                    fnc: "cat",
                },
                {
                    reg: "^#推荐软件$",
                    fnc: "softwareRecommended",
                },
                {
                    reg: "^#买家秀$",
                    fnc: "buyerShow",
                },
                {
                    reg: "^#累了$",
                    fnc: "cospro",
                },
                {
                    reg: "^#搜书(.*)$",
                    fnc: "searchBook",
                },
                {
                    reg: "^#竹白(.*)",
                    fnc: "zhubaiSearch",
                },
                {
                    reg: "^#(wiki|百科)(.*)$",
                    fnc: "wiki",
                },
                {
                    reg: "^识图",
                    fnc: "openAiOCR"
                }
            ],
        });
        // 配置文件
        this.toolsConfig = config.getConfig("tools");
        // 视频保存路径
        this.defaultPath = this.toolsConfig.defaultPath;
        // ai接口
        this.aiBaseURL = this.toolsConfig.aiBaseURL;
        // ai api key
        this.aiApiKey = this.toolsConfig.aiApiKey;
        // ai模型
        this.aiModel = this.toolsConfig.aiModel;
    }

    async doctor(e) {
        const keyword = e.msg.replace("#医药查询", "").trim();
        const url = `https://server.dayi.org.cn/api/search2?keyword=${ keyword }&pageNo=1&pageSize=10`;
        try {
            const res = await fetch(url)
                .then(resp => resp.json())
                .then(resp => resp.list);
            const promises = res.map(async element => {
                const title = this.removeTag(element.title);
                const template = `${ title }\n标签：${ element.secondTitle }\n介绍：${ element.introduction }`;

                if (title === keyword) {
                    const browser = await puppeteer.browserInit();
                    const page = await browser.newPage();
                    await page.goto(`https://www.dayi.org.cn/drug/${ element.id }`);
                    const buff = await page.screenshot({
                        fullPage: true,
                        type: "jpeg",
                        omitBackground: false,
                        quality: 90,
                    });
                    await e.reply(segment.image(buff));
                    browser.close();
                }

                return {
                    message: {
                        type: "text",
                        text: template,
                    },
                    nickname: Bot.nickname,
                    user_id: Bot.user_id,
                };
            });
            const msg = await Promise.all(promises);
            e.reply(await Bot.makeForwardMsg(msg));
        } catch (err) {
            logger.error(err);
        }
        return true;
    }

    async cat(e) {
        const [shibes, cats] = await Promise.allSettled([
            fetch(`https://shibe.online/api/cats?count=${ CAT_LIMIT }`).then(data => data.json()),
            fetch(`https://api.thecatapi.com/v1/images/search?limit=${ CAT_LIMIT }`).then(data =>
                data.json(),
            ),
        ]);

        const shibeUrls = shibes.status === "fulfilled" ? shibes.value : [];
        const catUrls = cats.status === "fulfilled" ? cats.value.map(item => item.url) : [];
        const reqRes = [...shibeUrls, ...catUrls];

        e.reply("涩图也不看了,就看猫是吧");

        const images = reqRes.map(item => ({
            message: segment.image(item),
            nickname: this.e.sender.card || this.e.user_id,
            user_id: this.e.user_id,
        }));
        e.reply(await Bot.makeForwardMsg(images));
        return true;
    }

    async softwareRecommended(e) {
        // 接口
        const urls = [
            "https://www.ghxi.com/ghapi?type=query&n=pc",
            "https://www.ghxi.com/ghapi?type=query&n=and",
        ];
        // 一起请求
        const promises = urls.map(url =>
            fetch(url)
                .then(resp => resp.json())
                .catch(err => logger.error(err)),
        );
        const results = await Promise.allSettled(promises);
        const msg = results
            .filter(result => result.status === "fulfilled") // 只保留已解决的 Promise
            .flatMap(result =>
                result.value.data.list.map(element => {
                    const template = `推荐软件：${ element.title }\n地址：${ element.url }\n`;
                    return {
                        message: { type: "text", text: template },
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    };
                }),
            );

        // 异步操作
        e.reply(await Bot.makeForwardMsg(msg));

        return true;
    }

    async buyerShow(e) {
        const p1 = fetch("https://api.vvhan.com/api/tao").then(resp => resp.url);
        const p2 = fetch("https://api.uomg.com/api/rand.img3?format=json")
            .then(resp => resp.json())
            .then(resp => resp.imgurl);

        const results = await Promise.allSettled([p1, p2]);
        const images = results
            .filter(result => result.status === "fulfilled")
            .map(result => result.value);

        for (const img of images) {
            e.reply(segment.image(img));
        }

        return true;
    }

    async cospro(e) {
        let [res1, res2] = (
            await Promise.allSettled([
                fetch("https://imgapi.cn/cos2.php?return=jsonpro").then(resp => resp.json()),
                fetch("https://imgapi.cn/cos.php?return=jsonpro").then(resp => resp.json()),
            ])
        )
            .filter(result => result.status === "fulfilled")
            .map(result => result.value);
        let req = [...res1.imgurls, ...res2.imgurls];
        e.reply("哪天克火掉一定是在这个群里面...");
        let images = req.map(item => ({
            message: segment.image(encodeURI(item)),
            nickname: this.e.sender.card || this.e.user_id,
            user_id: this.e.user_id,
        }));
        e.reply(await Bot.makeForwardMsg(images));
        return true;
    }

    // 搜书
    async searchBook(e) {
        let keyword = e.msg.replace(/#|搜书/g, "").trim();
        if (!keyword) {
            e.reply("请输入书名，例如：#搜书 非暴力沟通");
            return true;
        }

        // 集成易书、zBook
        const searchBookFunc = async () => {
            try {
                const bookList = await Promise.allSettled([
                    getYiBook(e, keyword),
                    getZBook(e, keyword),
                ]);
                // 压缩直链结果
                const combineRet = bookList
                    .filter(item => item.status === "fulfilled" && item.value && item.value.length > 0)
                    .flatMap(item => {
                        return item.value.flat();
                    });
                combineRet.length > 0 && await e.reply(await Bot.makeForwardMsg(combineRet));
                // ZHelper 特殊处理
                const zHelper = await getZHelper(e, keyword);
                zHelper.length > 1 &&
                e.reply(await Bot.makeForwardMsg(zHelper));
            } catch (err) {
                logger.error(err);
                e.reply("部分搜书正在施工🚧");
            }
        }
        await this.limitUserUse(e, searchBookFunc);
        return true;
    }

    // 竹白百科
    async zhubaiSearch(e) {
        const keyword = e.msg.replace("#竹白", "").trim();
        if (keyword === "") {
            e.reply("请输入想了解的内容，例如：#竹白 javascript");
            return true;
        }
        await axios
            .post(
                "https://open.zhubai.wiki/a/zb/s/ep/",
                {
                    content: 1,
                    keyword: keyword,
                },
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    },
                },
            )
            .then(async resp => {
                const res = resp.data.data;
                const content = res
                    .sort((a, b) => b.luSort - a.luSort)
                    .map(item => {
                        const { pn, pa, zn, lu, pu, pq, aa, hl } = item;
                        const template = `标题：${ pn }\n${ pa }\n期刊：${ zn }\n发布日期距今：${ lu }\n链接1：${ pu }\n链接2：${ pq }\n\n 大致描述：${ hl
                            .join("\n")
                            .replace(/<\/?font[^>]*>/g, "") }`;
                        return {
                            message: [segment.image(aa), template],
                            nickname: this.e.sender.card || this.e.user_id,
                            user_id: this.e.user_id,
                        };
                    });
                e.reply(await Bot.makeForwardMsg(content));
            });
        return true;
    }

    // 百科
    async wiki(e) {
        const key = e.msg.replace(/#|百科|wiki/g, "").trim();
        const url = `https://xiaoapi.cn/API/bk.php?m=json&type=sg&msg=${ encodeURI(key) }`;
        const bdUrl = `https://xiaoapi.cn/API/bk.php?m=json&type=bd&msg=${ encodeURI(key) }`;
        const bkRes = await Promise.all([
            axios
                .get(bdUrl, {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    },
                    timeout: 10000,
                })
                .then(resp => {
                    return resp.data;
                }),
            axios
                .get(url, {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    },
                    timeout: 10000,
                })
                .then(resp => {
                    return resp.data;
                }),
        ]).then(async res => {
            return res.map(item => {
                return {
                    message: `
                      解释：${ _.get(item, "msg") }\n
                      详情：${ _.get(item, "more") }\n
                    `,
                    nickname: e.sender.card || e.user_id,
                    user_id: e.user_id,
                };
            });
            // 小鸡解释：${ _.get(data2, 'content') }
        });
        await e.reply(await Bot.makeForwardMsg(bkRes));
        return true;
    }

    // 识图
    async openAiOCR(e) {
        if (e.source) {
            let reply;
            if (e.isGroup) {
                reply = (await e.group.getChatHistory(this.e.source.seq, 1)).pop()?.message;
            } else {
                reply = (await e.friend.getChatHistory(this.e.source.time, 1)).pop()?.message;
            }
            if (reply) {
                for (let val of reply) {
                    if (val.type == "image") {
                        e.img = [val.url];
                        break;
                    }
                }
            }
        }

        if (!e.img) {
            this.setContext('openAiProcess');
            await e.reply("「R插件 x 月之暗面 Kimi」联合识别提醒你：请发送图片！", false, { at: true });
        } else {
            this.openAiProcess();
        }
    }

    /**
     * AI引擎提供图像识别能力
     * @return {Promise<boolean>}
     */
    async openAiProcess() {
        if (!this.e.img) {
            e.reply("「R插件 x 月之暗面 Kimi」联合识别提醒你：无法找到图片！")
            return true;
        }
        const img = this.e.img.find(item => item.startsWith("http"));
        const parsedUrl = url.parse(img);
        const pathArray = parsedUrl.pathname.split('/');
        const filenameWithExtension = pathArray[pathArray.length - 1];
        const path = `${ this.defaultPath }${ this.e.group_id || this.e.user_id }`
        // 下载图片
        const imgPath = await downloadImg(img, path, filenameWithExtension);
        // 构造OpenAI引擎
        try {
            const { model, ans } = await new OpenaiBuilder()
                .setBaseURL(this.aiBaseURL)
                .setApiKey(this.aiApiKey)
                .setModel(this.aiModel)
                .setPath(imgPath)
                .build();
            this.e.reply(`「R插件 x ${ model }」联合识别：\n${ ans }`);
            await checkAndRemoveFile(filenameWithExtension);
        } catch (err) {
            e.reply("「R插件 x 月之暗面 Kimi」联合识别提醒你：无法找到图片路径！")
            logger.error(err);
        }
        return true;
    }

    /**
     * 限制用户调用（默认1分钟1次）
     * @param e
     * @param func
     * @return {Promise<void>}
     */
    async limitUserUse(e, func) {
        if (query.#tokenBucket.consume(e.user_id, 1)) {
            await func();
        } else {
            e.reply(`🙅‍${ e.nickname }你已经被限流，请稍后再试！`, true);
        }
    }

    // 删除标签
    removeTag(title) {
        const titleRex = /<[^>]+>/g;
        return title.replace(titleRex, "");
    }
}
