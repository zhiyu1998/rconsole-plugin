import schedule from "node-schedule";
import common from "../../../lib/common/common.js";
import axios from "axios";
import fs from "node:fs";
import fetch from "node-fetch";
import { mkdirIfNotExists } from "./file.js";

/**
 * 请求模板
 */
class jFeatch {
    async get(url) {
        const r = await fetch(url);
        return await r.json();
    }
    async post(url, params) {
        const r = await fetch(url, { ...params, method: "POST" });
        return await r.json();
    }
}

/**
 * 每日推送函数
 * @param func 回调函数
 * @param time cron
 * @param isAutoPush 是否推送（开关）
 */
function autoTask(func, time, groupList, isAutoPush = false) {
    if (isAutoPush) {
        schedule.scheduleJob(time, () => {
            // 正常传输
            if (groupList instanceof Array) {
                for (let i = 0; i < groupList.length; i++) {
                    const group = Bot.pickGroup(groupList[i]);
                    func(group);
                    common.sleep(1000);
                }
                // 防止恶意破坏函数
            } else if (groupList instanceof String) {
                const group = Bot.pickGroup(groupList[i]);
                func(group);
                common.sleep(1000);
            } else {
                throw Error("错误传入每日推送参数！");
            }
        });
    }
}

/**
 * 重试函数（暂时只用于抖音的api）
 * @param func
 * @param maxRetries
 * @param delay
 * @returns {Promise<unknown>}
 */
function retry(func, maxRetries = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
        const attempt = (remainingTries) => {
            func()
                .then(resolve)
                .catch(error => {
                    if (remainingTries === 1) {
                        reject(error);
                    } else {
                        console.log(`错误: ${error}. 重试将在 ${delay/1000} 秒...`);
                        setTimeout(() => attempt(remainingTries - 1), delay);
                    }
                });
        };
        attempt(maxRetries);
    });
}

/**
 * 工具：下载pdf文件
 * @param url
 * @param filename
 * @returns {Promise<unknown>}
 */
function downloadPDF (url, filename) {
    return axios({
        url: url,
        responseType: "stream",
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36",
        },
    }).then(response => {
        const writer = fs.createWriteStream(filename);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });
    });
}

/**
 * 找到tiktok的视频id
 * @param url
 * @returns {Promise<string|string|null>}
 */
async function getIdVideo(url) {
    const matching = url.includes("/video/");
    if (!matching) {
        this.e.reply("没找到，正在获取随机视频！");
        return null;
    }
    const idVideo = url.substring(url.indexOf("/video/") + 7, url.length);
    return idVideo.length > 19 ? idVideo.substring(0, idVideo.indexOf("?")) : idVideo;
}

function generateRandomStr(randomlength = 16){
    const base_str = 'ABCDEFGHIGKLMNOPQRSTUVWXYZabcdefghigklmnopqrstuvwxyz0123456789='
    let random_str = ''
    for (let i = 0; i < randomlength; i++) {
        random_str += base_str.charAt(Math.floor(Math.random() * base_str.length))
    }
    return random_str
}

/**
 * 下载mp3
 * @param mp3Url    MP3地址
 * @param path      下载目录
 * @param redirect  是否要重定向
 * @returns {Promise<unknown>}
 */
async function downloadMp3(mp3Url, path, redirect = "manual") {
    return fetch(mp3Url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
        },
        responseType: "stream",
        redirect: redirect,
    }).then(async res => {
        // 如果没有目录就创建一个
        await mkdirIfNotExists(path)

        // 补充保存文件名
        path += "/temp.mp3";
        if (fs.existsSync(path)) {
            console.log(`音频已存在`);
            fs.unlinkSync(path);
        }
        // 开始下载
        const fileStream = fs.createWriteStream(path);
        res.body.pipe(fileStream);
        return new Promise((resolve, reject) => {
            fileStream.on("finish", () => {
                fileStream.close(() => {
                    resolve(path);
                });
            });
            fileStream.on("error", err => {
                fs.unlink(path, () => {
                    reject(err);
                });
            });
        });
    });
}

export { jFeatch, autoTask, retry, getIdVideo, generateRandomStr, downloadMp3 };
