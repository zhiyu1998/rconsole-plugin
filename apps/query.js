// 主库
import fetch from "node-fetch";
// 爬虫库
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
// http库
import axios from "axios";
import fs from "node:fs";
// 常量
import { CAT_LIMIT } from "../utils/constant.js";
// 书库
import { getZHelper, getBookDetail, getYiBook, getZBook } from "../utils/books.js";
// 工具类
import _ from "lodash";

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
                    reg: "^#青年大学习$",
                    fnc: "youthLearning",
                },
                {
                    reg: "^#搜书(.*)$$",
                    fnc: "searchBook",
                },
                {
                    reg: "^#bookid(.*)$$",
                    fnc: "searchBookById",
                },
                {
                    reg: "^#竹白(.*)",
                    fnc: "zhubaiSearch",
                },
            ],
        });
    }

    async doctor(e) {
        const keyword = e.msg.replace("#医药查询", "").trim();
        const url = `https://api2.dayi.org.cn/api/search2?keyword=${keyword}&pageNo=1&pageSize=10`;
        try {
            const res = await fetch(url)
                .then(resp => resp.json())
                .then(resp => resp.list);
            const promises = res.map(async element => {
                const title = this.removeTag(element.title);
                const template = `${title}\n标签：${element.secondTitle}\n介绍：${element.introduction}`;

                if (title === keyword) {
                    const browser = await puppeteer.browserInit();
                    const page = await browser.newPage();
                    await page.goto(`https://www.dayi.org.cn/drug/${element.id}`);
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
            fetch(`https://shibe.online/api/cats?count=${CAT_LIMIT}`).then(data => data.json()),
            fetch(`https://api.thecatapi.com/v1/images/search?limit=${CAT_LIMIT}`).then(data =>
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
                    const template = `推荐软件：${element.title}\n地址：${element.url}\n`;
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

    // 青年大学习
    async youthLearning(e) {
        await axios
            .get(
                "https://qczj.h5yunban.com/qczj-youth-learning/cgi-bin/common-api/course/current",
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36 Edg/95.0.1020.53",
                    },
                },
            )
            .then(resp => {
                // logger.info(resp.data);
                return resp.data.result.uri.replace("index.html", "m.html");
            })
            .then(async uri => {
                axios
                    .get(uri, {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36 Edg/95.0.1020.53",
                        },
                    })
                    .then(resp => {
                        const content = resp.data;
                        const resList = content.match(/<div class="w\d option" (.*)><\/div>/g);
                        const valueList = resList.map(item => {
                            return item.match(/data-a="(\d+)"/)[1];
                        });
                        let result = [];
                        // 转换ABCD
                        const digitToLetter = {
                            0: "A",
                            1: "B",
                            2: "C",
                            3: "D",
                        };
                        for (let i = 0; i < valueList.length; i += 4) {
                            const group = valueList.slice(i, i + 4);
                            if (group.length < 4) {
                                continue;
                            }

                            const letters = group
                                .map((d, indx) => {
                                    if (d === "1") {
                                        return digitToLetter[indx];
                                    }
                                })
                                .join("");
                            result.push(letters);
                        }
                        // 封装答案
                        let ans = "";
                        for (let i = 0; i < result.length; i++) {
                            ans += `${i + 1}. ${result[i]}\n`;
                        }
                        e.reply(ans);
                        const imgMatch = uri.match(/[^\/]+/g);
                        const imgId = imgMatch[imgMatch.length - 2];

                        axios
                            .get(`https://h5.cyol.com/special/daxuexi/${imgId}/images/end.jpg`, {
                                headers: {
                                    "User-Agent":
                                        "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                                },
                                responseType: "stream",
                            })
                            .then(resp => {
                                const filePath = "./youthLearning.png";
                                const writer = fs.createWriteStream(filePath);
                                resp.data.pipe(writer);
                                return new Promise((resolve, reject) => {
                                    writer.on("finish", () => {
                                        writer.close(() => {
                                            resolve(filePath);
                                        });
                                    });
                                    writer.on("error", err => {
                                        fs.unlink(filePath, () => {
                                            reject(err);
                                        });
                                    });
                                });
                            })
                            .then(filePath => {
                                e.reply(segment.image(fs.readFileSync(filePath)));
                                fs.unlinkSync(filePath, err => {
                                    if (err) throw err;
                                    logger.error("删除青年大学习文件失败");
                                });
                            });
                    });
            });
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

        const replyMessage = async msg => {
            if (msg && msg.length > 0) {
                await e.reply(await Bot.makeForwardMsg(msg));
            }
        };

        // 集成易书、zBook
        try {
            const bookList = await Promise.allSettled([getYiBook(e, keyword), getZBook(e, keyword)]);
            bookList
                .filter(one => one.status === "fulfilled")
                .map(item => {
                    replyMessage(item.value);
                });

            const zHelper = await getZHelper(e, keyword);
            if (zHelper && zHelper.length > 0) {
                await replyMessage(zHelper);
                const replyText =
                    "请选择一个你想要的ID、来源，例如：\n" +
                    "11918807 superlib\n" +
                    "只回复11918807 默认zlibrary\n" +
                    "书源若不对应则回复无效链接，数字字母之间空格";
                await e.reply(replyText);
                this.setContext("searchBookContext");
            }
        } catch (err) {
            logger.error(err);
            e.reply("搜书正在施工🚧");
        }
        return true;
    }

    // 通过id搜书
    async searchBookById(e) {
        let keyword = e.msg.replace(/#bookid/, "").trim();
        if (_.isEmpty(keyword)) {
            e.reply(`请输入书名，例如：#搜书 12`);
            return true;
        }

        let id, source;
        if (keyword.includes(" ")) {
            [id, source] = keyword.split(" ");
        } else {
            id = /\d+/.exec(keyword)[0];
            source = "";
        }
        try {
            const res = await getBookDetail(e, id, source);
            await this.reply(await Bot.makeForwardMsg(res));
        } catch (err) {
            logger.error(err);
            e.reply("搜书正在施工🚧");
        }
        return true;
    }

    /**
     * @link searchBook 的上下文
     * @returns {Promise<void>}
     */
    async searchBookContext() {
        // 当前消息
        const curMsg = this.e;
        // 上一个消息
        // const preMsg = this.getContext();
        if (!curMsg.msg) {
            this.e.reply("请回复id和来源！");
            return;
        }
        // 获取id和来源
        let id, source;
        if (curMsg.msg.includes(" ")) {
            [id, source] = curMsg.msg.split(" ");
        } else {
            id = /\d+/.exec(curMsg.msg)[0];
            source = "";
        }
        const res = await getBookDetail(curMsg, id, source);
        await this.reply(await Bot.makeForwardMsg(res));
        this.finish("searchBookContext");
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
                const content = await res.map(item => {
                    const { pn, pa, zn, lu, pu, pq, aa, hl } = item;
                    const template = `标题：${pn}\n${pa}\n期刊：${zn}\n发布日期距今：${lu}\n链接1：${pu}\n链接2：${pq}\n\n 大致描述：${hl
                        .join("\n")
                        .replace(/<\/?font[^>]*>/g, "")}`;
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

    // 删除标签
    removeTag(title) {
        const titleRex = /<[^>]+>/g;
        return title.replace(titleRex, "");
    }
}
