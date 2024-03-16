import { GENERAL_REQ_LINK } from "../constants/tools.js";

/**
 * 第三方接口适配器，用户大面积覆盖解析视频的内容
 */
class GeneralLinkAdapter {
    #url;

    constructor(link) {
        console.log("============",link)
        if (/share.xiaochuankeji.cn/.test(link)) {
            this.#url = this.zuiyou(link);
        } else if (/kuaishou.com/.test(link)) {
            this.#url = this.ks(link);
        } else if (/ixigua.com/.test(link)) {
            this.#url = this.xigua(link);
        } else if (/h5.pipix.com/.test(link)) {
            this.#url = this.pipixia(link);
        } else if (/h5.pipigx.com/.test(link)) {
            this.#url = this.pipigx(link);
        }
    }

    async ks(link) {
        // 例子：https://www.kuaishou.com/short-video/3xkfs8p4pnd67p4?authorId=3xkznsztpwetngu&streamSource=find&area=homexxbrilliant
        // https://v.m.chenzhongtech.com/fw/photo/3xburnkmj3auazc
        // https://v.kuaishou.com/1ff8QP
        let msg = /(?:https?:\/\/)?(www|v)\.kuaishou\.com\/[A-Za-z\d._?%&+\-=\/#]*/g.exec(link)[0];
        // 跳转短号
        if (msg.includes("v.kuaishou")) {
            await fetch(msg, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
                }
            }).then(resp => {
                msg = resp.url;
            })
        }
        let video_id;
        if (msg.includes('/fw/photo/')) {
            video_id = msg.match(/\/fw\/photo\/([^/?]+)/)[1];
        } else if (msg.includes("short-video")) {
            video_id = msg.match(/short-video\/([^/?]+)/)[1];
        } else {
            throw "无法提取快手的信息，请重试或者换一个视频！";
        }
        // 提取视频
        return {
            name: "快手",
            link: GENERAL_REQ_LINK.replace("{}", `https://www.kuaishou.com/short-video/${ video_id }`)
        };
    }

    async zuiyou(link) {
        // #最右#分享一条有趣的内容给你，不好看算我输。请戳链接>>https://share.xiaochuankeji.cn/hybrid/share/post?pid=365367131&zy_to=applink&share_count=1&m=dc114ccc8e55492642f6a702b510c1f6&d=9e18ca2dace030af656baea96321e0ea353fe5c46097a7f3962b93f995641e962796dd5faa231feea5531ac65547045f&app=zuiyou&recommend=r0&name=n0&title_type=t0
        const msg = /(?:https?:\/\/)?(share|share.xiaochuankeji)\.cn\/[A-Za-z\d._?%&+\-=\/#]*/.exec(link)[0];
        return {name: "最右", link: GENERAL_REQ_LINK.replace("{}", msg)};
    }

    async xigua(link) {
        // 1. https://v.ixigua.com/ienrQ5bR/
        // 2. https://www.ixigua.com/7270448082586698281
        // 3. https://m.ixigua.com/video/7270448082586698281
        let msg = /(?:https?:\/\/)?(www|v|m)\.ixigua\.com\/[A-Za-z\d._?%&+\-=\/#]*/g.exec(link)[0];
        // 跳转短号
        if (msg.includes("v.ixigua")) {
            await fetch(msg, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
                }
            }).then(resp => {
                msg = resp.url;
            })
        }

        const id = /ixigua\.com\/(\d+)/.exec(msg)[1] || /\/video\/(\d+)/.exec(msg)[1];
        const videoReq = `https://www.ixigua.com/${ id }`;
        return {name: "西瓜", link: GENERAL_REQ_LINK.replace("{}", videoReq)};
    }

    async pipixia(link) {
        const msg = /https:\/\/h5\.pipix\.com\/s\/[A-Za-z0-9]+/.exec(link)?.[0];
        return {name: "皮皮虾", link: GENERAL_REQ_LINK.replace("{}", msg)};
    }

    async pipigx(link) {
        const msg = /https:\/\/h5\.pipigx\.com\/pp\/post\/[A-Za-z0-9]+/.exec(link)?.[0];
        return {name: "皮皮搞笑", link: GENERAL_REQ_LINK.replace("{}", msg)};
    }

    async build() {
        return this.#url;
    }
}

export default GeneralLinkAdapter
