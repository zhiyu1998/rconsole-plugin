// 获取cookie
import fetch from "node-fetch";
import axios from "axios";

const BASE_URL = "http://cloud-music.pl-fe.cn";

/**
 * 获取cookie
 * @param key
 * @returns {Promise<unknown>}
 */
async function getCookies(key) {
    const cookieUrl = `${BASE_URL}/login/qr/check?key=${key}&timestamp=${Date.now()}`;
    return fetch(cookieUrl).then(async resp => {
        return await resp.json();
    });
}

/**
 * 获取登陆状态
 * @param cookie
 * @returns {Promise<AxiosResponse<any>>}
 */
async function getLoginStatus(cookie) {
    return axios({
        url: `${BASE_URL}/login/status?timestamp=${Date.now()}`,
        method: "post",
        data: {
            cookie,
        },
    }).then(resp => {
        return resp.data.data;
    });
}

/**
 * 获取每日推荐
 * @param cookie
 * @returns {Promise<AxiosResponse<any>>}
 */
async function getDailyRecommend(cookie) {
    return axios({
        url: `${BASE_URL}/recommend/songs?timestamp=${Date.now()}`,
        method: "get",
        data: {
            cookie,
        },
    }).then(resp => {
        return resp.data.data;
    });
}

/**
 * 获取密匙
 * @returns {Promise<*>}
 */
async function getKey() {
    const keyUrl = `${BASE_URL}/login/qr/key?timestamp=${Date.now()}`;
    return await fetch(keyUrl).then(async resp => {
        const respJson = await resp.json();
        return respJson.data.unikey;
    });
}

/**
 * 获取二维码
 * @param key
 * @returns {Promise<*>}
 */
async function getQrCode(key) {
    const qrPicUrl = `${BASE_URL}/login/qr/create?key=${key}&qrimg=true&timestamp=${Date.now()}`;
    return await fetch(qrPicUrl).then(async resp => {
        const respJson = await resp.json();
        return respJson.data.qrimg;
    });
}

/**
 * 获取听歌排行榜
 * @param uid
 * @returns {Promise<AxiosResponse<any>>}
 */
async function getUserRecord(uid) {
    return axios({
        url: `${BASE_URL}/user/record?uid=${uid}&type=1&timestamp=${Date.now()}`,
        method: "get",
    }).then(resp => {
        return resp.data;
    });
}

/**
 * 检查当前歌曲是否可用
 * @param id
 * @returns {Promise<AxiosResponse<any>>} 返回{success:true|false, message: 'ok'}
 */
async function checkMusic(id) {
    return axios({
        url: `${BASE_URL}/check/music?id=${id}&timestamp=${Date.now()}`,
        method: "get",
    }).then(resp => {
        return resp.data;
    });
}

async function getSong(id, cookie) {
    return axios({
        url: `${BASE_URL}/song/url/v1?id=${id}&level=standard&timestamp=${Date.now()}`,
        method: "post",
        data: {
            cookie,
        },
    }).then(resp => {
        return resp.data.data;
    });
}

async function getSongDetail(ids) {
    return axios({
        url: `${BASE_URL}/song/detail?ids=${ids}&timestamp=${Date.now()}`,
        method: "get",
    }).then(resp => {
        return resp.data;
    });
}

async function getCloud(cookie) {
    return axios({
        url: `${BASE_URL}/user/cloud?timestamp=${Date.now()}`,
        method: "get",
        data: {
            cookie,
        },
    }).then(resp => {
        return resp.data.data;
    });
}

async function getCloudMusicDetail(id, cookie) {
    return axios({
        url: `${BASE_URL}/user/cloud/detail?id=${id}&timestamp=${Date.now()}`,
        method: "get",
        data: {
            cookie,
        },
    }).then(resp => {
        return resp.data;
    });
}

export {
    getCookies,
    getLoginStatus,
    getDailyRecommend,
    getKey,
    getQrCode,
    getUserRecord,
    checkMusic,
    getSong,
    getSongDetail,
    getCloud,
    getCloudMusicDetail
};
