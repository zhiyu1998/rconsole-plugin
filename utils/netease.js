// 获取cookie
import fetch from "node-fetch";
import axios from "axios";

const BASE_URL = "http://127.0.0.1:3000"

/**
 * 获取cookie
 * @param key
 * @returns {Promise<unknown>}
 */
async function getCookies(key) {
    const cookieUrl = `${BASE_URL}/login/qr/check?key=${key}&timestamp=${Date.now()}`;
    return fetch(cookieUrl).then(async (resp) => {
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
        method: 'post',
        data: {
            cookie,
        },
    })
        .then(resp => {
            console.log(resp.data.data)
            return resp.data.data
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
        method: 'get',
        data: {
            cookie,
        },
    })
        .then(resp => {
            return resp.data.data
        });
}

/**
 * 获取密匙
 * @returns {Promise<*>}
 */
async function getKey() {
    const keyUrl = `${BASE_URL}/login/qr/key?timestamp=${Date.now()}`;
    return await fetch(keyUrl).then(async (resp) => {
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
    return await fetch(qrPicUrl).then(async (resp) => {
        const respJson = await resp.json();
        return respJson.data.qrimg;
    });
}

export {
    getCookies,
    getLoginStatus,
    getDailyRecommend,
    getKey,
    getQrCode,
}