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
        return {
            title: respData.title,
            desc: respData.desc,
            dynamic: respJson.data.dynamic,
            stat: respData.stat,
            aid: respData.aid,
            cid: respData.pages?.[0].cid,
        };
    });
}

export { getVideoInfo };
