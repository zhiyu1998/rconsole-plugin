import axios from "axios";
import fetch from "node-fetch";
// 常量
import { CAT_LIMIT, COMMON_USER_AGENT } from "../constants/constant.js";

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
                }
            ],
        });
    }

    async doctor(e) {
        const keyword = e.msg.replace("#医药查询", "").trim();
        const url = `https://server.dayi.org.cn/api/search2?keyword=${ keyword }&pageNo=1&pageSize=10`;
        try {
            const res = await fetch(url)
                .then(resp => resp.json())
                .then(resp => resp.list);
            let msg = [];
            for (let element of res) {
                const title = this.removeTag(element.title);
                const thumbnail = element?.thumbnail || element?.auditDoctor?.thumbnail;
                const doctor = `\n\n👨‍⚕️ 医生信息：${ element?.auditDoctor?.name } - ${ element?.auditDoctor?.clinicProfessional } - ${ element?.auditDoctor?.eduProfessional } - ${ element?.auditDoctor?.institutionName } - ${ element?.auditDoctor?.institutionLevel } - ${ element?.auditDoctor?.departmentName }`
                const template = `📌 ${ title } - ${ element.secondTitle }${ element?.auditDoctor ? doctor : '' }\n\n📝 简介：${ element.introduction }`;
                if (thumbnail) {
                    msg.push({
                        message: [segment.image(thumbnail), { type: "text", text: template, }],
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    });
                } else {
                    msg.push({
                        message: {
                            type: "text",
                            text: template,
                        },
                        nickname: e.sender.card || e.user_id,
                        user_id: e.user_id,
                    })
                }
            }
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

    // 删除标签
    removeTag(title) {
        const titleRex = /<[^>]+>/g;
        return title.replace(titleRex, "");
    }
}
