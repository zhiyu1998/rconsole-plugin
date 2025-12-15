import {
    GENERAL_REQ_LINK,
    GENERAL_REQ_LINK_2,
    GENERAL_REQ_LINK_3,
    GENERAL_REQ_LINK_4
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
        // 这里必须使用{ ...GENERAL_REQ_LINK_2 }赋值，不然就是对象的引用赋值，会造成全局数据问题！
        let reqLink = { ...externalInterface };
        reqLink.link = reqLink.link.replace("{}", requestURL);
        return reqLink;
    }

    async ks(link) {
        // 例子：https://www.kuaishou.com/short-video/3xkfs8p4pnd67p4?authorId=3xkznsztpwetngu&streamSource=find&area=homexxbrilliant
        // https://v.m.chenzhongtech.com/fw/photo/3xburnkmj3auazc
        // https://v.kuaishou.com/1ff8QP
        let msg = /(?:https?:\/\/)?(www|v)\.(kuaishou|m\.chenzhongtech)\.com\/[A-Za-z\d._?%&+\-=\/#]*/g.exec(link)[0];
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
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, `https://www.kuaishou.com/short-video/${video_id}`);
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
        const videoReq = `https://www.ixigua.com/${id}`;
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, videoReq);
        return { name: "西瓜", reqLink };
    }

    async pipixia(link) {
        const msg = /https:\/\/h5\.pipix\.com\/(s|item)\/[A-Za-z0-9_-]+/.exec(link)?.[0];
        // 皮皮虾使用通用解析API
        const reqLink = this.createReqLink(GENERAL_REQ_LINK_2, msg);
        logger.mark('[R插件][皮皮虾解析] 提取的链接:', msg);
        logger.mark('[R插件][皮皮虾解析] 使用API:', reqLink.link);
        return { name: "皮皮虾", reqLink };
    }

    async pipigx(link) {
        const msg = /https:\/\/h5\.pipigx\.com\/pp\/post\/[A-Za-z0-9]+/.exec(link)?.[0];
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, msg);
        return { name: "皮皮搞笑", reqLink };
    }

    async qqSmallWorld(link) {
        const msg = /https:\/\/s.xsj\.qq\.com\/[A-Za-z0-9]+/.exec(link)?.[0];
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, msg);
        return { name: "QQ小世界", reqLink };
    }

    async tieba(link) {
        const msg = /https:\/\/tieba\.baidu\.com\/p\/[A-Za-z0-9]+/.exec(link)?.[0];
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, msg);
        return { name: "贴吧", reqLink };
    }

    async jike(link) {
        // https://m.okjike.com/originalPosts/6583b4421f0812cca58402a6?s=ewoidSI6ICI1YTgzMTY4ZmRmNDA2MDAwMTE5N2MwZmQiCn0=
        const msg = /https:\/\/m.okjike.com\/originalPosts\/[A-Za-z0-9]+/.exec(link)?.[0];
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, msg);
        return { name: "即刻", reqLink };
    }

    async douyinBackup(link) {
        const msg = /(http:\/\/|https:\/\/)v.douyin.com\/[A-Za-z\d._?%&+\-=\/#]*/.exec(link)?.[0];
        const reqLink = this.createReqLink(GENERAL_REQ_LINK, msg);
        return { name: "抖音动图", reqLink };
    }

    /**
     * 初始化通用适配器
     * @param link 通用链接
     * @returns {Promise<*>}
     */
    async init(link) {
        logger.mark("[R插件][通用解析]", link)
        const handlers = new Map([
            [/(kuaishou.com|chenzhongtech.com)/, this.ks.bind(this)],
            [/ixigua.com/, this.xigua.bind(this)],
            [/h5.pipix.com/, this.pipixia.bind(this)],
            [/h5.pipigx.com/, this.pipigx.bind(this)],
            [/tieba.baidu.com/, this.tieba.bind(this)],
            [/xsj.qq.com/, this.qqSmallWorld.bind(this)],
            [/m.okjike.com/, this.jike.bind(this)],
            [/v.douyin.com/, this.douyinBackup.bind(this)],
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
     * @param sign     通用解析标识
     * @returns {Promise<object>}
     */
    async resolve(adapter, sign) {
        // 通用解析日志 - 显示平台、API和请求格式
        logger.mark(`[R插件][通用解析] ========== 开始解析 ==========`);
        logger.mark(`[R插件][通用解析] 平台名称: ${adapter.name}`);
        logger.mark(`[R插件][通用解析] Sign标识: ${sign}`);
        logger.mark(`[R插件][通用解析] 请求URL: ${adapter.reqLink.link}`);
        logger.mark(`[R插件][通用解析] ================================`);

        // 发送GET请求
        const resp = await fetch(adapter.reqLink.link, {
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
        });

        const data = await resp.json();
        logger.mark(`[R插件][通用解析] API响应状态: ${resp.status}`);
        logger.mark(`[R插件][通用解析] 完整返回数据: ${JSON.stringify(data, null, 2)}`);

        // 检测API是否返回失败（code=-2/400/404 或 data为null）
        const isApiSuccess = this.isApiResponseSuccess(data);

        if (!isApiSuccess) {
            logger.mark(`[R插件][通用解析] API返回失败或不支持，code=${data.code}, msg=${data.msg}`);
            return {
                name: adapter.name,
                success: false,
                code: data.code,
                msg: data.msg
            };
        }

        // 通用字段提取 - 适配所有API返回格式
        const videoUrl = data.data?.url || data.data?.playAddr;
        const images = data.data?.images?.length > 0 ? data.data.images :
            (data.data?.imageUrl?.length > 0 ? data.data.imageUrl :
                (data.data?.pics?.length > 0 ? data.data.pics :
                    (data.data?.imgurl?.length > 0 ? data.data.imgurl : undefined)));
        const desc = data.data?.title || data.data?.desc || '';

        logger.mark(`[R插件][通用解析] Sign=${sign} 提取结果 - video: ${videoUrl}, images: ${images?.length || 0}, desc: ${desc}`);

        return {
            name: adapter.name,
            success: true,
            images: images,
            video: videoUrl,
            desc: desc
        };
    }

    /**
     * 检测API响应是否成功
     * @param data API返回数据
     * @returns {boolean}
     */
    isApiResponseSuccess(data) {
        // 失败的code值列表
        const failCodes = [-2, 400, 404, -1, 500];
        if (failCodes.includes(data.code)) {
            return false;
        }
        // 检查data是否为null或没有有效内容
        if (!data.data || (data.data.url === undefined && data.data.images === undefined && data.data.imageUrl === undefined)) {
            return false;
        }
        return true;
    }

    /**
     * 通过工厂方式创建一个通用解析的JSON对象（支持API轮换）
     * @param link
     * @returns {Promise<*>}
     */
    static async create(link) {
        const adapter = new GeneralLinkAdapter();
        const adapterHandler = await adapter.init(link);

        if (!adapterHandler) {
            logger.mark(`[R插件][通用解析] 未匹配到任何平台处理器`);
            return null;
        }

        // API轮换列表
        const apiList = [
            GENERAL_REQ_LINK,
            GENERAL_REQ_LINK_2,
            GENERAL_REQ_LINK_3,
            GENERAL_REQ_LINK_4
        ];

        // 获取原始链接
        const originalLink = adapterHandler.originalLink || adapterHandler.reqLink.link.split('content=')[1] || adapterHandler.reqLink.link.split('url=')[1];

        // 尝试当前API
        let result = await adapter.resolve(adapterHandler, adapterHandler.reqLink.sign);

        // 如果成功或有视频/图片，直接返回
        if (result.success && (result.video || result.images)) {
            return result;
        }

        // 失败则轮换尝试其他API
        logger.mark(`[R插件][通用解析] 主API失败，开始轮换尝试其他API...`);

        for (const api of apiList) {
            // 跳过已经尝试过的API
            if (api.sign === adapterHandler.reqLink.sign) {
                continue;
            }

            logger.mark(`[R插件][通用解析] 尝试备用API: ${api.link.split('?')[0]}... (sign=${api.sign})`);

            // 构造新的请求链接
            const backupReqLink = adapter.createReqLink(api, originalLink);
            const backupAdapter = {
                ...adapterHandler,
                reqLink: backupReqLink
            };

            try {
                result = await adapter.resolve(backupAdapter, api.sign);

                if (result.success && (result.video || result.images)) {
                    logger.mark(`[R插件][通用解析] 备用API成功！sign=${api.sign}`);
                    return result;
                }
            } catch (err) {
                logger.mark(`[R插件][通用解析] 备用API失败: ${err.message}`);
            }
        }

        // 所有API都失败
        logger.mark(`[R插件][通用解析] 所有API都无法解析此链接`);
        return result;
    }
}

export default GeneralLinkAdapter
