import fetch from "node-fetch";

async function getVideoInfo(url) {
    const baseVideoInfo = "http://api.bilibili.com/x/web-interface/view";
    const videoId = /video\/[^\?\/ ]+/.exec(url)[0].split("/")[1];
    // 获取视频信息，然后发送
    return fetch(`${baseVideoInfo}?bvid=${videoId}`)
        .then(async resp => {
            const respJson = await resp.json();
            const respData = respJson.data;
            return {
                title: respData.title,
                desc: respData.desc,
                duration: respData.duration,
                dynamic: respJson.data.dynamic,
                stat: respData.stat,
                aid: respData.aid,
                cid: respData.pages?.[0].cid,
        };
    });
}

export { getVideoInfo };
