import axios from "axios";
import { downloadMp3, generateRandomStr } from "./common.js";

/**
 * 获取音频
 * @param id
 * @param path
 * @returns {Promise<any>}
 */
async function getBodianAudio(id, path) {
    // 音乐数据
    const API = `https://bd-api.kuwo.cn/api/service/music/audioUrl/${id}?format=mp3&br=320kmp3&songType=&fromList=&weListenUid=&weListenDevId=`;
    const headers = {
        "User-Agent": "bodian/106 CFNetwork/1399 Darwin/22.1.0",
        devId: `95289318-8847-43D5-8477-85296654785${String.fromCharCode(
            65 + Math.floor(Math.random() * 26),
        )}`,
        Host: "bd-api.kuwo.cn",
        plat: "ip",
        ver: "3.1.0",
        "Cache-Control": "no-cache",
        channel: "appstore",
    };
    return await axios
        .get(API, {
            headers,
        })
        .then(async resp => {
            const respJson = resp.data;
            const audioUrl = respJson.data.audioUrl;
            await downloadMp3(audioUrl, path)
                .catch(err => {
                    console.error(`下载音乐失败，错误信息为: ${err.message}`);
                });
            return respJson;
        });
}

/**
 * 获取MV地址
 * @param id
 * @returns {Promise<(fid: string, pid: string) => Promise<void>>}
 */
async function getBodianMv(id) {
    // mv数据
    const API = `https://bd-api.kuwo.cn/api/service/mv/info?musicId=${id}&wifi=1&noWifi=1&uid=-1&token=`
    const headers = {
        "User-Agent": "Dart/2.18 (dart:io)",
        plat: "ar",
        ver: "3.1.0",
        host: "bd-api.kuwo.cn",
        channel: "aliopen",
        devId: generateRandomStr(16)
    }
    return await axios.get(API, {
        headers
    }).then(async resp => {
        const res = resp.data;
        // 如果没有，直接返回
        if (res.data.lowUrl === null || res.data.highUrl === null) {
            return;
        }
        // 波点音乐信息
        return res.data.mv;
    }).catch(err => {
        logger.error("波点音乐错误");
    });
}

/**
 * 获取音乐信息
 * @returns {Promise<void>}
 */
async function getBodianMusicInfo(id) {
    const API = `https://bd-api.kuwo.cn/api/service/music/info?musicId=${id}&uid=-1&token=`
    const headers = {
        "User-Agent": "Dart/2.18 (dart:io)",
        plat: "ar",
        ver: "3.1.0",
        host: "bd-api.kuwo.cn",
        channel: "aliopen",
        devId: generateRandomStr(16)
    }
    return await axios.get(API, {
        headers
    }).then(async resp => {
       return resp.data?.data;
    }).catch(err => {
        logger.error("波点音乐错误");
    });
}

export {
    getBodianAudio,
    getBodianMv,
    getBodianMusicInfo
}
