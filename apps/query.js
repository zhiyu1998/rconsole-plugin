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
import {CAT_LIMIT} from "../utils/constant.js";

export class query extends plugin {
    constructor() {
        super({
            name: "R插件查询类",
            dsc: "R插件查询相关指令",
            event: "message.group",
            priority: 500,
            rule: [
                {
                    reg: "^#*医药查询 (.*)$",
                    fnc: "doctor",
                },
                {
                    reg: "^#*评分 (.*)",
                    fnc: "videoScore",
                },
                {
                    reg: "^#(cat)$",
                    fnc: "cat",
                },
                {
                    reg: "^#电脑软件推荐$" /** 执行方法 */,
                    fnc: "computerRecommended",
                },
                {
                    reg: "^#安卓软件推荐$" /** 执行方法 */,
                    fnc: "androidRecommended",
                },
                {
                    reg: "^#(热搜)(.*)$",
                    fnc: "hotSearch",
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
            ],
        });
    }

    async doctor(e) {
        let keyword = e.msg.split(" ")[1];
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

    async videoScore(e) {
        let keyword = e.msg.split(" ")[1];
        const api = `https://movie.douban.com/j/subject_suggest?q=${encodeURI(keyword)}`;

        let movieId = 30433417;
        fetch(api, {
            Headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                "Content-Type": "application/json",
            },
        })
            .then(resp => resp.json())
            .then(resp => {
                if (resp.length === 0 || resp === "") {
                    e.reply("没找到！");
                    return true;
                }
                movieId = resp[0].id;
                const doubanApi = `https://movie.querydata.org/api?id=${movieId}`;
                fetch(doubanApi, {
                    Headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                        "Content-Type": "application/json",
                    },
                })
                    .then(resp => resp.json())
                    .then(resp => {
                        if (resp.length === 0 || resp === "") {
                            e.reply("没找到！");
                            return true;
                        }
                        e.reply(
                            `识别：${resp.data[0].name}\n烂番茄评分：${resp.imdbRating}\n豆瓣评分：${resp.doubanRating}\n评分：${resp.imdbRating}`,
                        );
                    });
            });
        return true;
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
        e.reply("涩图也不看了,就看猫是吧, 探索中...");
        reqRes.forEach(item => {
            images.push({
                message: segment.image(item),
                nickname: this.e.sender.card || this.e.user_id,
                user_id: this.e.user_id,
            });
        });
        return !!(await this.reply(await Bot.makeForwardMsg(images)));
    }

    async computerRecommended(e) {
        let url = "https://www.ghxi.com/ghapi?type=query&n=pc";
        /** 调用接口获取数据 */
        let res = await fetch(url).catch(err => logger.error(err));

        /** 接口结果，json字符串转对象 */
        res = await res.json();
        let msg = [];
        res.data.list.forEach(element => {
            const template = `推荐软件：${element.title}\n地址：${element.url}\n`;
            msg.push({
                message: { type: "text", text: `${template}` },
                nickname: Bot.nickname,
                user_id: Bot.user_id,
            });
        });
        /** 最后回复消息 */
        return !!this.reply(await Bot.makeForwardMsg(msg));
    }

    async androidRecommended(e) {
        let url = "https://www.ghxi.com/ghapi?type=query&n=and";
        let res = await fetch(url).catch(err => logger.error(err));
        res = await res.json();
        let msg = [];
        res.data.list.forEach(element => {
            const template = `推荐软件：${element.title}\n地址：${element.url}\n`;
            msg.push({
                message: { type: "text", text: `${template}` },
                nickname: Bot.nickname,
                user_id: Bot.user_id,
            });
        });
        return !!this.reply(await Bot.makeForwardMsg(msg));
    }

    async hotSearch(e) {
        let keyword = e.msg.replace(/#|热搜/g, "").trim();
        let url = "https://api.vvhan.com/api/hotlist?type=";
        switch (keyword) {
            case "知乎":
                url += "zhihuHot";
                break;
            case "百度":
                url += "baiduRD";
                break;
            case "哔哩哔哩":
                url += "bili";
                break;
            case "贴吧":
                url += "baiduRY";
                break;
            case "微博":
                url += "wbHot";
                break;
            case "抖音":
                url += "douyinHot";
                break;
            default:
                url += "bili";
                break;
        }
        let sendTemplate = {
            nickname: this.e.sender.card || this.e.user_id,
            user_id: this.e.user_id,
        };
        let msg = [];
        await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                "Content-Type": "application/json",
            },
        })
            .then(resp => resp.json())
            .then(resp => {
                for (let element of resp.data) {
                    if (_.isUndefined(element)) {
                        continue;
                    }
                    const template = `
                      标题：${_.isNull(element.title) ? "暂无" : element.title}\n
                      简介：${_.isNull(element.desc) ? "暂无" : element.desc}\n
                      热度：${_.isNull(element.hot) ? "暂无" : element.hot}\n
                      访问详情：${_.isNull(element.url) ? "暂无" : element.url}\n
                    `;
                    msg.push({
                        message: { type: "text", text: `${template}` },
                        ...sendTemplate,
                    });
                }
            })
            .catch(err => logger.error(err));
        return !!this.reply(await Bot.makeForwardMsg(msg));
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
        const sendTemplate = {
            nickname: this.e.sender.card || this.e.user_id,
            user_id: this.e.user_id,
        };
        // 主要数据来源
        axios
            .post("https://api.ylibrary.org/api/search/", {
                headers: {
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1660.14",
                    "referer": "https://search.zhelper.net/"
                },
                keyword: keyword,
                page: 1,
                sensitive: false,
            })
            .then(async resp => {
                const dataBook = resp.data.data;
                let bookMsg = [];
                await dataBook.forEach(item => {
                    const {
                        title,
                        author,
                        publisher,
                        isbn,
                        extension,
                        filesize,
                        year,
                        id,
                        source,
                    } = item;
                    // 数据组合
                    bookMsg.push({
                        message: {
                            type: "text",
                            text:
                                `${id}: <${title}>\n` +
                                `作者：${author}\n` +
                                `书籍类型：${extension}\n` +
                                `出版年月：${year}\n` +
                                `来源：${source}\n` +
                                `ISBN：${isbn||"暂无"}\n` +
                                `出版社：${publisher}\n` +
                                `文件大小：${(Number(filesize)/1024/1024).toFixed(2)}MB`
                        },
                        ...sendTemplate,
                    });
                });
                await e.reply(await Bot.makeForwardMsg(bookMsg));
                await e.reply(
                    "请选择一个你想要的ID、来源，例如：11918807 superlib（只回复11918807默认zlibrary）书源若不对应则回复无效链接",
                );

                thisBookMethod.setContext("searchBookContext");
            });
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
        await this.getBookDetail(e, id, source);
    }

    /**
     * 获取直接下载的来源
     * @param keyword 书名
     * @returns {Promise<void>}
     */
    async getDirectDownload(keyword) {
        // 下载字典（异步去执行）
        return  axios
            .post("https://worker.zlib.app/api/search/", {
                headers: {
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1660.14",
                    "referer": "https://search.zhelper.net/"
                },
                keyword: keyword,
                page: 1,
                sensitive: false,
            }).then(resp => {
                // 标题去重
                return resp.data.data.filter(item => {
                    return item.title === keyword
                }).map(item => `https://worker.zlib.app/download/${item.id}`)
            })
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
        await this.getBookDetail(curMsg, id, source);
        this.finish("searchBookContext");
    }

    /**
     * 获取书籍下载方式
     * @param e
     * @param id
     * @param source
     * @returns {Promise<AxiosResponse<any>>}
     */
    async getBookDetail(e, id, source) {
        return axios
            .post("https://api.ylibrary.org/api/detail/", {
                headers: {
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1660.14",
                    referer: "https://search.zhelper.net/",
                },
                id: id,
                source: source || "zlibrary",
            })
            .then(async resp => {
                const {
                    author,
                    extension,
                    filesize,
                    id,
                    in_libgen,
                    ipfs_cid,
                    md5,
                    publisher,
                    source,
                    title,
                    year,
                } = resp.data;
                const Libgen = `https://libgendown.1kbtool.com/${md5}`;
                const ipfs = `https://ipfs-checker.1kbtool.com/${ipfs_cid}?filename=${encodeURIComponent(title)}_${source}-search.${extension}`;
                const reqUrl = `${md5}#${filesize}#${encodeURIComponent(title)}_${encodeURIComponent(author)}_${id}_${source}-search.${extension}`;
                const cleverPass = `https://rapidupload.1kbtool.com/${reqUrl}`;
                const cleverPass2 = `https://rulite.1kbtool.com/${reqUrl}`;
                let bookMethods = [
                    `Libgen：${Libgen}`,
                    `ipfs：${ipfs}`,
                    `秒传：${cleverPass}`,
                    `秒传Lite：${cleverPass2}`,
                ].map(item => {
                    return {
                        message: {type: "text", text: item},
                        nickname: this.e.sender.card || this.e.user_id,
                        user_id: this.e.user_id,
                    }
                })
                await this.reply(await Bot.makeForwardMsg(bookMethods))
                // 异步获取直连
                console.log(source);
                console.log(source === Buffer.from("ei1saWJyYXJ5", "base64").toString("utf8"));
                if (source === Buffer.from("ei1saWJyYXJ5", "base64").toString("utf8")) {
                    this.getDirectDownload(title).then(async res => {
                        const directDownloadUrls = res.map(item => {
                            return {
                                message: {type: "text", text: item},
                                nickname: this.e.sender.card || this.e.user_id,
                                user_id: this.e.user_id,
                            }
                        })
                        if (directDownloadUrls.length) {
                            await this.reply(await Bot.makeForwardMsg(directDownloadUrls))
                        }
                    })
                }
            });
    }

    // 删除标签
    removeTag(title) {
        const titleRex = /<[^>]+>/g;
        return title.replace(titleRex, "");
    }
}