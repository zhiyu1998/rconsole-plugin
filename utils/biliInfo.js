import fetch from "node-fetch";
import { TEN_THOUSAND } from "./constant.js";

async function getVideoInfo(url) {
    const baseVideoInfo = "http://api.bilibili.com/x/web-interface/view";
    const videoId = /video\/[^\?\/ ]+/.exec(url)[0].split("/")[1];
    // 获取视频信息，然后发送
    return fetch(
        videoId.startsWith("BV")
            ? `${baseVideoInfo}?bvid=${videoId}`
            : `${baseVideoInfo}?aid=${videoId}`,
    ).then(async resp => {
        const respJson = await resp.json();
        const respData = respJson.data;
        // 视频标题
        const title = "识别：哔哩哔哩，" + respData.title + "\n";
        // 视频图片(暂时不加入，影响性能)
        // const videoCover = respData.pic;
        // 视频信息
        let { view, danmaku, reply, favorite, coin, share, like } = respData.stat;
        // 数据处理
        const dataProcessing = data => {
            return Number(data) >= TEN_THOUSAND ? (data / TEN_THOUSAND).toFixed(1) + "万" : data;
        };
        // 组合内容
        const combineContent = `总播放量：${dataProcessing(view)}, 弹幕数量：${dataProcessing(
            danmaku,
        )}, 回复量：${dataProcessing(reply)}, 收藏数：${dataProcessing(
            favorite,
        )}, 投币：${dataProcessing(coin)}, 分享：${dataProcessing(share)}, 点赞：${dataProcessing(
            like,
        )}\n`;
        return {
            title,
            combineContent,
            aid: respData.aid,
            cid: respData.pages?.[0].cid,
        };
    });
}

export { getVideoInfo };
