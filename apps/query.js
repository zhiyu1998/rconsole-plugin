// 主库
// http库
import axios from "axios";
import fetch from "node-fetch";
import _ from "lodash";
// 爬虫库
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
// 常量
import { CAT_LIMIT, COMMON_USER_AGENT, REDIS_YUNZAI_ANIMELIST } from "../constants/constant.js";
import { LINUX_AI_PROMPT, LINUX_QUERY, REDIS_YUNZAI_LINUX } from "../constants/query.js";
// 配置文件
import config from "../model/config.js";
import { OpenaiBuilder } from "../utils/openai-builder.js";
import { redisExistAndGetKey, redisExistAndInsertObject, redisExistAndUpdateObject } from "../utils/redis-util.js";
import { textArrayToMakeForward } from "../utils/yunzai-util.js";

export class query extends plugin {

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
                    reg: "^#竹白(.*)",
                    fnc: "zhubaiSearch",
                },
                {
                    reg: "^#(linux|Linux)(.*)",
                    fnc: "linuxQuery"
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
                        "User-Agent": COMMON_USER_AGENT,
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

    async linuxQuery(e) {
        const order = e.msg.replace(/^#([lL])inux/, "").trim();
        // 查询 Redis 中是否存在这个命令如果存在直接返回没有的话就发起网络请求
        const linuxInRedis = await redisExistAndGetKey(REDIS_YUNZAI_LINUX)
        let linuxOrderData;
        // 判断这个命令是否在缓存里
        const isOrderInRedis = linuxInRedis && Object.keys(linuxInRedis).includes(order);
        if (!isOrderInRedis) {
            // 没有在缓存里，直接发起网络请求
            const resp = await fetch(LINUX_QUERY.replace("{}", order), {
                headers: {
                    "User-Agent": COMMON_USER_AGENT
                }
            });
            linuxOrderData = (await resp.json()).data;
            // 如果缓存里没有就保存一份到缓存里
            linuxOrderData && await redisExistAndInsertObject(REDIS_YUNZAI_LINUX, { [order]: linuxOrderData });
        } else {
            // 在缓存里就取出
            linuxOrderData = linuxInRedis[order];
        }
        try {
            const builder = await new OpenaiBuilder()
                .setBaseURL(this.aiBaseURL)
                .setApiKey(this.aiApiKey)
                .setModel(this.aiModel)
                .setPrompt(LINUX_AI_PROMPT)
                .build();
            let aiBuilder;
            if (linuxOrderData) {
                const { linux, content, link } = linuxOrderData;
                // 发送消息
                e.reply(`识别：Linux命令 <${ linux }>\n\n功能：${ content }`);
                aiBuilder = await builder.kimi(`能否帮助根据${ link }网站的Linux命令内容返回一些常见的用法，内容简洁明了即可`)
            } else {
                aiBuilder = await builder.kimi(`我现在需要一个Linux命令去完成：“${ order }”，你能否帮助我查询到相关的一些命令用法和示例，内容简洁明了即可`);
            }
            // 如果填了写 AI 才总结
            if (this.aiApiKey && this.aiBaseURL) {
                const { ans: kimiAns, model } = aiBuilder;
                const Msg = await Bot.makeForwardMsg(textArrayToMakeForward(e, [`「R插件 x ${ model }」联合为您总结内容：`, kimiAns]));
                await e.reply(Msg);
                // 提取AI返回的内容并进行解析
                if (_.isEmpty(linuxInRedis[order]?.content.trim())) {
                    const parsedData = this.parseAiResponse(order, kimiAns);
                    await redisExistAndUpdateObject(REDIS_YUNZAI_LINUX, order, parsedData);
                    e.reply(`已重新学习命令 ${ order } 的用法，当前已经更新功能为：${ parsedData.content }`);
                }
            }
        } catch (err) {
            e.reply(`暂时无法查询到当前命令！`);
            logger.error(logger.red(`[R插件][linux]: ${ err }`));
        }
        return true;
    }

    /**
     * AI响应解析函数
     * @param order
     * @param aiResponse
     * @returns {{linux, link: string, content: (*|string)}}
     */
    parseAiResponse(order, aiResponse) {
        // 检查 aiResponse 是否为有效字符串
        if (!aiResponse || typeof aiResponse !== 'string') {
            return {
                linux: order,
                content: '',
                link: `https://www.linuxcool.com/${order}` // 默认参考链接
            };
        }

        // 初始化保存数据的对象
        let parsedData = {
            linux: order,
            content: '',
            link: `https://www.linuxcool.com/${order}`  // 默认参考链接
        };

        // 清理多余的换行符，避免意外的分隔问题
        const lines = aiResponse.split('\n').map(line => line.trim()).filter(line => line);

        // 遍历每一行查找命令相关的描述
        lines.forEach(line => {
            // 允许命令带有可选的路径，修改正则表达式以适应路径变化
            const match = line.match(/[`'“](.+?)[`'”]\s*[:：—-]?\s*(.*)/);

            if (match) {
                logger.info(match)
                const command = match[1].trim();  // 提取命令部分
                const description = match[2].trim();  // 提取描述部分// 同样忽略路径

                // 如果命令和参数部分匹配，保存描述
                if (command.includes(order)) {
                    parsedData.content = description;
                }
            }
        });

        // 如果没有找到具体的描述内容，则给出默认提示
        if (!parsedData.content) {
            parsedData.content = '';
        }

        return parsedData;
    }
    // 删除标签
    removeTag(title) {
        const titleRex = /<[^>]+>/g;
        return title.replace(titleRex, "");
    }
}
