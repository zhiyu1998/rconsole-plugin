import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Tiktok专属解析链接的Fetch
 * @param url 地址
 * @param isOversea 是否是海外
 * @param proxy 梯子
 */
const fetchTiktokUrl = async (url, isOversea, proxy) => {
    // 处理特殊情况 & 非特殊情况的header
    const headers = url.includes("vm.tiktok") || url.includes("tiktok.com/t")
        ? { "User-Agent": "facebookexternalhit/1.1" }
        : {};

    return fetch(url, {
        headers,
        redirect: "follow",
        follow: 10,
        timeout: 10000,
        agent: isOversea ? undefined : new HttpsProxyAgent(proxy),
    }).then(resp => resp.url);
};

/**
 * 处理Tiktok链接
 * @param url 用户发送的链接，可能存在一些问题，需要正则匹配处理
 * @param isOversea 是否是海外
 * @param proxy 梯子
 */
export const processTikTokUrl = async (url, isOversea, proxy) => {
    // 合并正则表达式
    // const urlShortRex = /(http:|https:)\/\/vt.tiktok.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
    // const urlShortRex2 = /(http:|https:)\/\/vm.tiktok.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
    // const urlShortRex3 = /(http:|https:)\/\/www.tiktok.com\/t\/[A-Za-z\d._?%&+\-=\/#]*/g;
    const tikTokRegex = /(http:|https:)\/\/(www\.tiktok\.com\/|vt\.tiktok\.com\/|vm\.tiktok\.com\/www\.tiktok\.com\/t\/)[A-Za-z\d._?%&+\-=\/#@]*/g;
    const match = tikTokRegex.exec(url);

    if (match) {// 如果URL匹配任何TikTok相关的模式，则进行处理
        url = await fetchTiktokUrl(match[0], isOversea, proxy);
    }

    // 这里可以处理其他逻辑，例如更新URL、记录日志等
    // 或者其他处理结果
    return url;
};