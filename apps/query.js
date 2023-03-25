// 主库
import { segment } from "oicq";
import fetch from "node-fetch";
// 爬虫库
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import _ from "lodash";
// http库
import axios from "axios";
import fs from "node:fs";
// 常量
import { CAT_LIMIT } from "../utils/constant.js";
// 书库
import { getZHelper, getYiBook, getBookDetail } from "../utils/books.js";

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
                    reg: "^#(cat)$",
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
                    reg: "^#(累了)$",
                    fnc: "cospro",
                },
                {
                    reg: "^#青年大学习$",
                    fnc: "youthLearning",
                },
                {
                    reg: "^#(搜书)(.*)$$",
                    fnc: "searchBook",
                },
                {
                    reg: "^#(bookid)(.*)$$",
                    fnc: "searchBookById",
                },
                {
                    reg: "^#epic",
                    fnc: "epicGame",
                }
            ],
        });
    }

    async doctor(e) {
        let keyword = e.msg.replace("#医药查询", "").trim();
        const url = `https://api2.dayi.org.cn/api/search2?keyword=${keyword}&pageNo=1&pageSize=10`;
        let res = await fetch(url)
            .then(resp => resp.json())
            .then(resp => resp.list);
        let msg = [];
        for (const element of res) {
            const title = this.removeTag(element.title);
            const template = `
        ${title}\n
        标签：${element.secondTitle}\n
        介绍：${element.introduction}
      `;
            // 如果完全匹配，直接响应页面
            if (title === keyword) {
                const browser = await puppeteer.browserInit();
                const page = await browser.newPage();
                await page.goto(`https://www.dayi.org.cn/drug/${element.id}`);
                let buff = await page.screenshot({
                    fullPage: true,
                    type: "jpeg",
                    omitBackground: false,
                    quality: 90,
                });
                browser.close();
                await e.reply(segment.image(buff));
            }
            msg.push({
                message: { type: "text", text: `${template}` },
                nickname: Bot.nickname,
                user_id: Bot.user_id,
            });
        }
        /** 最后回复消息 */
        return !!this.reply(await Bot.makeForwardMsg(msg));
    }

    async cat(e) {
        let images = [];
        let reqRes = [
            ...(await fetch(`https://shibe.online/api/cats?count=${CAT_LIMIT}`).then(data =>
                data.json(),
            )),
            ...(await fetch(`https://api.thecatapi.com/v1/images/search?limit=${CAT_LIMIT}`)
                .then(data => data.json())
                .then(json => json.map(item => item.url))),
        ];
        e.reply("涩图也不看了,就看猫是吧");
        reqRes.forEach(item => {
            images.push({
                message: segment.image(item),
                nickname: this.e.sender.card || this.e.user_id,
                user_id: this.e.user_id,
            });
        });
        return !!(await this.reply(await Bot.makeForwardMsg(images)));
    }

    async softwareRecommended(e) {
        // 接口
        const pcUrl = "https://www.ghxi.com/ghapi?type=query&n=pc";
        const andUrl = "https://www.ghxi.com/ghapi?type=query&n=and";
        // 一起请求
        const res = [
            await fetch(pcUrl)
                .then(resp => resp.json())
                .catch(err => logger.error(err)),
            await fetch(andUrl)
                .then(resp => resp.json())
                .catch(err => logger.error(err)),
        ];
        // 时间复杂度(n^2) 待优化
        const msg = res.map(async recommend => {
            return recommend.data.list.map(element => {
                const template = `推荐软件：${element.title}\n地址：${element.url}\n`;
                return {
                    message: { type: "text", text: template },
                    nickname: e.sender.card || e.user_id,
                    user_id: e.user_id,
                };
            });
        });
        await Promise.all(msg).then(res => {
            res.forEach(async item => {
                e.reply(await Bot.makeForwardMsg(item));
            });
        });
        return true;
    }

    async buyerShow(e) {
        // http://3650000.xyz/api/?type=img
        // https://api.vvhan.com/api/tao
        // https://api.uomg.com/api/rand.img3?format=json
        // const randomIndex = Math.floor(Math.random() * urls.length);
        // const randomElement = urls.splice(randomIndex, 1)[0];
        const p1 = new Promise((resolve, reject) => {
            fetch("https://api.vvhan.com/api/tao")
                .then(resp => {
                    return resolve(resp.url);
                })
                .catch(err => reject(err));
        });
        const p2 = new Promise((resolve, reject) => {
            fetch("https://api.uomg.com/api/rand.img3?format=json")
                .then(resp => resp.json())
                .then(resp => {
                    return resolve(resp.imgurl);
                })
                .catch(err => reject(err));
        });
        Promise.all([p1, p2]).then(res => {
            res.forEach(item => {
                e.reply(segment.image(item));
            });
        });
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
                // console.log(resp.data);
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
                                    console.error("删除青年大学习文件失败");
                                });
                            });
                    });
            });
        return true;
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

    // 搜书
    async searchBook(e) {
        let keyword = e.msg.replace(/#|搜书/g, "").trim();
        const thisBookMethod = this;
        // 主要数据来源
        await Promise.all([getZHelper(e, keyword), getYiBook(e, keyword)]).then(async allRes => {
            const [zHelper, yiBook] = allRes;
            if (!_.isUndefined(yiBook) && yiBook.length > 0) {
                await e.reply(await Bot.makeForwardMsg(yiBook));
            }
            if (!_.isUndefined(zHelper) && zHelper.length > 0) {
                await e.reply(await Bot.makeForwardMsg(zHelper));
                await e.reply(
                    "请选择一个你想要的ID、来源，例如：\n" +
                        "11918807 superlib\n" +
                        "只回复11918807 默认zlibrary\n" +
                        "书源若不对应则回复无效链接，数字字母之间空格",
                );
                thisBookMethod.setContext("searchBookContext");
            }
        });
        return true;
    }

    // 通过id搜书
    async searchBookById(e) {
        let keyword = e.msg.replace(/#bookid/, "").trim();
        let id, source;
        if (keyword.includes(" ")) {
            [id, source] = keyword.split(" ");
        } else {
            id = /\d+/.exec(keyword)[0];
            source = "";
        }
        const res = await getBookDetail(e, id, source);
        await this.reply(await Bot.makeForwardMsg(res));
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

    // epic游戏查询：逻辑来自于https://github.com/monsterxcn/nonebot_plugin_epicfree/blob/main/nonebot_plugin_epicfree/data_source.py
    async epicGame(e) {
        const API = `https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=zh-CN&country=CN&allowCountries=CN`;
        const res = await fetch(API, {
            headers: {
                Referer: "https://www.epicgames.com/store/zh-CN/",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36",
            },
            timeout: 10000,
        }).then((resp) => resp.json());
        const games = res.data.Catalog.searchStore.elements;
// console.log(games);
        e.reply(
            `获取到${games.length}个游戏，${games.map((item) => item.title).join(", ")}`
        );
        for (const game of games) {
            const gameName = game?.title || "未知";
            if (game?.promotions === undefined) {
                continue;
            }
            const game_promotions = game.promotions?.promotionalOffers;
            const upcoming_promotions = game.promotions?.upcomingPromotionalOffers;
            const originalPrice = game.price.totalPrice.fmtPrice.originalPrice;
            const discount_price = game.price.totalPrice.fmtPrice.discountPrice;
            if (!game_promotions && upcoming_promotions) {
                logger.mark(`跳过即将推出免费游玩的游戏：${gameName}(${discount_price})`);
                continue;
            } else if (game.price.totalPrice.fmtPrice.discountPrice != "0") {
                logger.mark(`跳过促销但不免费的游戏：${gameName}(${discount_price})`);
                continue;
            }
            // 图片处理
            let availableImgUrl = [];
            const available = [
                "Thumbnail",
                "VaultOpened",
                "DieselStoreFrontWide",
                "OfferImageWide",
            ];
            for (const image of game.keyImages) {
                if ((image.url != null) && available.includes(image.type)) {
                    availableImgUrl.push(image.url);
                }
            }
            // 处理游戏发行信息
            let gameDev = game.seller.name;
            let gamePub = game.seller.name;
            for (const pair of game.customAttributes) {
                if (pair.key === "developerName") {
                    gameDev = pair.value;
                } else if (pair.key === "publisherName") {
                    gamePub = pair.value;
                }
            }
            const dev_com = gameDev != gamePub ? `${gameDev} 开发、` : "";
            const companies =
                gamePub != "Epic Dev Test Account" ? `由 ${dev_com}${gamePub} 发行，` : "";
            //处理游戏限免结束时间
            const dateRfc3339 = game_promotions?.[0].promotionalOffers[0].endDate;
            let endDate = "不明确";
            if (dateRfc3339 !== undefined) {
                const date = new Date(dateRfc3339);
                const options = {
                    timeZone: "Asia/Shanghai",
                    month: "long",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                };
                endDate = date
                    .toLocaleString("zh-CN", options)
                    .replace(/(\d{1,2})\s/, "$1日 ");
            }
            const resMsg = `${gameName} (${originalPrice})\n\n${game.description}\n\n游戏${companies}\n${game?.url}\n将在 ${endDate} 结束免费游玩，戳上方链接领取吧~`;
            e.reply([resMsg, ...availableImgUrl.map(url => segment.image(url))])
        }
    }

    // 删除标签
    removeTag(title) {
        const titleRex = /<[^>]+>/g;
        return title.replace(titleRex, "");
    }
}
