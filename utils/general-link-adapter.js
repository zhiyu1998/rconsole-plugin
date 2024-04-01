import {
    GENERAL_REQ_LINK,
    GENERAL_REQ_LINK_2, GENERAL_REQ_LINK_3
} from "../constants/tools.js";

/**
 * 第三方接口适配器，用于大面积覆盖解析视频的内容
 */
class GeneralLinkAdapter {

    constructor() {
    }

    /**
     * 暂时用这个来处理短链接
     * @param url
     * @param includeRedirect
     * @returns {Promise<string|Response>}
     */
    async fetchUrl(url, includeRedirect = false) {
        let response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
            }
        });
        return includeRedirect ? response.url : response;
    }

    /**
     * 【辅助函数】创造一个第三方接口的链接
     * @param externalInterface  第三方接口：这个链接来自常量 constants/tools.js @GENERAL_REQ_LINK / ...
     * @param requestURL         请求的链接
     * @returns {*}
     */
    createReqLink(externalInterface, requestURL) {
        let reqLink = { ...externalInterface };
        reqLink.link = reqLink.link.replace("{}", requestURL);
        return reqLink;
    }

    async ks(link) {
        // 例子：https://www.kuaishou.com/short-video/3xkfs8p4pnd67p4?authorId=3xkznsztpwetngu&streamSource=find&area=homexxbrilliant
        // https://v.m.chenzhongtech.com/fw/photo/3xburnkmj3auazc
        // https://v.kuaishou.com/1ff8QP
        let msg = /(?:https?:\/\/)?(www|v)\.kuaishou\.com\/[A-Za-z\d._?%&+\-=\/#]*/g.exec(link)[0];
        // 跳转短号
        if (msg.includes("v.kuaishou")) {
            msg = await this.fetchUrl(msg, true);
        }
        let video_id;
        if (msg.includes('/fw/photo/')) {
            video_id = msg.match(/\/fw\/photo\/([^/?]+)/)[1];
        } else if (msg.includes("short-video")) {
            video_id = msg.match(/short-video\/([^/?]+)/)[1];
        } else {
            throw Error("无法提取快手的信息，请重试或者换一个视频！");
        }
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, `https://www.kuaishou.com/short-video/${ video_id }`);
        // 提取视频
        return {
            name: "快手",
            reqLink
        };
    }

    async xigua(link) {
        // 1. https://v.ixigua.com/ienrQ5bR/
        // 2. https://www.ixigua.com/7270448082586698281
        // 3. https://m.ixigua.com/video/7270448082586698281
        let msg = /(?:https?:\/\/)?(www|v|m)\.ixigua\.com\/[A-Za-z\d._?%&+\-=\/#]*/g.exec(link)[0];
        // 跳转短号
        if (msg.includes("v.ixigua")) {
            msg = await this.fetchUrl(msg, true);
        }

        const id = /ixigua\.com\/(\d+)/.exec(msg)[1] || /\/video\/(\d+)/.exec(msg)[1];
        const videoReq = `https://www.ixigua.com/${ id }`;
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, videoReq);
        return { name: "西瓜", reqLink };
    }

    async pipixia(link) {
        const msg = /https:\/\/h5\.pipix\.com\/s\/[A-Za-z0-9]+/.exec(link)?.[0];
        // 这里必须使用{ ...GENERAL_REQ_LINK_2 }赋值，不然就是对象的引用赋值，会造成全局数据问题！
        const reqLink = this.createReqLink(GENERAL_REQ_LINK_2, msg);
        return { name: "皮皮虾", reqLink };
    }

    async pipigx(link) {
        const msg = /https:\/\/h5\.pipigx\.com\/pp\/post\/[A-Za-z0-9]+/.exec(link)?.[0];
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, msg);
        return { name: "皮皮搞笑", reqLink };
    }

    async tieba(link) {
        const msg = /https:\/\/tieba\.baidu\.com\/p\/[A-Za-z0-9]+/.exec(link)?.[0];
        // 这里必须使用{ ...GENERAL_REQ_LINK_2 }赋值，不然就是对象的引用赋值，会造成全局数据问题！
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, msg)
        return { name: "贴吧", reqLink };
    }

    async qqSmallWorld(link) {
        const msg = /https:\/\/s.xsj\.qq\.com\/[A-Za-z0-9]+/.exec(link)?.[0];
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, msg);
        return { name: "QQ小世界", reqLink };
    }

    async jike(link) {
        // https://m.okjike.com/originalPosts/6583b4421f0812cca58402a6?s=ewoidSI6ICI1YTgzMTY4ZmRmNDA2MDAwMTE5N2MwZmQiCn0=
        const msg = /https:\/\/m.okjike.com\/originalPosts\/[A-Za-z0-9]+/.exec(link)?.[0];
        const reqLink = this.createReqLink(GENERAL_REQ_LINK_3, msg);
        return { name: "即刻", reqLink };
    }

    /**
     * 初始化通用适配器
     * @param link 通用链接
     * @returns {Promise<*>}
     */
    async init(link) {
        logger.mark("[R插件][通用解析]", link)
        const handlers = new Map([
            [/kuaishou.com/, this.ks.bind(this)],
            [/ixigua.com/, this.xigua.bind(this)],
            [/h5.pipix.com/, this.pipixia.bind(this)],
            [/h5.pipigx.com/, this.pipigx.bind(this)],
            [/tieba.baidu.com/, this.tieba.bind(this)],
            [/xsj.qq.com/, this.qqSmallWorld.bind(this)],
            [/m.okjike.com/, this.jike.bind(this)],
        ]);

        for (let [regex, handler] of handlers) {
            if (regex.test(link)) {
                return handler(link);
            }
        }
    }

    /**
     * 通用解析适配器，将其他的第三方接口转换为统一的接口
     * @param adapter  通用解析适配器
     * @param sign     通用解析标识：1、2 【在适配器的reqLink中】
     * @returns {Promise<void>}
     */
    async resolve(adapter, sign) {
        // 发送GET请求
        return fetch(adapter.reqLink.link, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',

            },
            timeout: 10000
        }).then(async resp => {
            const data = await resp.json();
            if (sign === 1) {
                // @link GENERAL_REQ_LINK
                return {
                    name: adapter.name,
                    images: data.data?.imageUrl,
                    video: data.data?.url,
                }
            } else if (sign === 2) {
                // @link GENERAL_REQ_LINK_2
                return {
                    name: adapter.name,
                    images: data.data?.images,
                    video: data.data?.videoUrl,
                    desc: data.data?.desc
                }
            } else if (sign === 3) {
                console.log(data)
                return {
                    name: adapter.name,
                    images: data?.images.map(item => item.url),
                }
            } else {
                throw Error("[R插件][通用解析]错误Sign标识");
            }
        })
    }

    /**
     * 通过工厂方式创建一个通用解析的JSON对象
     * @param link
     * @returns {Promise<*>}
     */
    static async create(link) {
        // 先正则匹配到函数进行出策略处理
        const adapter = await new GeneralLinkAdapter();
        const adapterHandler = await adapter.init(link);
        // 对处理完的信息进行通用解析
        return adapter.resolve(adapterHandler, adapterHandler.reqLink.sign);
    }
}

export default GeneralLinkAdapter
