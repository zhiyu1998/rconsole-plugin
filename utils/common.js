import axios from "axios";
import { exec } from "child_process";
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from "node-fetch";
import fs from "node:fs";
import os from "os";
import path from 'path';
import { BILI_DOWNLOAD_METHOD, COMMON_USER_AGENT, SHORT_LINKS, TEN_THOUSAND } from "../constants/constant.js";
import { mkdirIfNotExists } from "./file.js";

/**
 * 生成随机字符串
 *
 * @param {number} [randomlength=16] 生成的字符串长度，默认为16
 * @returns {string} 生成的随机字符串
 *
 * @description
 * 此函数生成一个指定长度的随机字符串。
 * 字符串由大小写字母、数字和等号组成。
 * 使用 Array.from 和箭头函数来创建随机字符数组，然后用 join 方法连接。
 *
 * @example
 * const randomString = generateRandomStr(); // 生成默认长度16的随机字符串
 * const randomString20 = generateRandomStr(20); // 生成长度为20的随机字符串
 */
export function generateRandomStr(randomlength = 16) {
    const base_str = 'ABCDEFGHIGKLMNOPQRSTUVWXYZabcdefghigklmnopqrstuvwxyz0123456789=';
    return Array.from({ length: randomlength }, () => base_str.charAt(Math.floor(Math.random() * base_str.length))).join('');
}

/**
 * 下载mp3
 * @param mp3Url    MP3地址
 * @param filePath      下载目录
 * @param title     音乐名
 * @param redirect  是否要重定向
 * @param audioType 建议填写 mp3 / m4a / flac 类型
 * @returns {Promise<unknown>}
 */
export async function downloadAudio(mp3Url, filePath, title = "temp", redirect = "manual", audioType = "mp3") {
    // 如果没有目录就创建一个
    await mkdirIfNotExists(filePath)

    // 补充保存文件名
    filePath += `/${ title }.${ audioType }`;
    if (fs.existsSync(filePath)) {
        logger.info(`音频已存在`);
        fs.unlinkSync(filePath);
    }

    try {
        const response = await axios({
            method: 'get',
            url: mp3Url,
            responseType: 'stream',
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36"
            }
        });

        // 开始下载
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filePath));
            writer.on('error', reject);
        });

    } catch (error) {
        logger.error(`下载音乐失败，错误信息为: ${ error.message }`);
        throw error;
    }
}

/**
 * 下载图片网关
 * @param {Object} options 参数对象
 * @param {string} options.img 图片的URL
 * @param {string} options.dir 保存图片的目录
 * @param {string} [options.fileName] 自定义文件名 (可选)
 * @param {boolean} [options.isProxy] 是否使用代理 (可选)
 * @param {Object} [options.headersExt] 自定义请求头 (可选)
 * @param {Object} [options.proxyInfo] 代理信息 (可选)
 * @returns {Promise<string>}
 */
export async function downloadImg({
                                      img,
                                      dir,
                                      fileName = "",
                                      isProxy = false,
                                      headersExt = {},
                                      proxyInfo = {},
                                      downloadMethod = 0,
                                  }) {
    const downloadImgParams = {
        img,
        dir,
        fileName,
        isProxy,
        headersExt,
        proxyInfo,
    }
    logger.info(logger.yellow(`[R插件][图片下载] 当前使用的方法：${ BILI_DOWNLOAD_METHOD[downloadMethod].label }`));
    if (downloadMethod === 0) {
        return normalDownloadImg(downloadImgParams);
    } else if (downloadMethod >= 1) {
        return downloadImgWithAria2(downloadImgParams);
    }
}

/**
 * 正常下载图片
 * @param {Object} options 参数对象
 * @param {string} options.img 图片的URL
 * @param {string} options.dir 保存图片的目录
 * @param {string} [options.fileName] 自定义文件名 (可选)
 * @param {boolean} [options.isProxy] 是否使用代理 (可选)
 * @param {Object} [options.headersExt] 自定义请求头 (可选)
 * @param {Object} [options.proxyInfo] 代理信息 (可选)
 * @returns {Promise<string>}
 */
async function normalDownloadImg({
                                     img,
                                     dir,
                                     fileName = "",
                                     isProxy = false,
                                     headersExt = {},
                                     proxyInfo = {}
                                 }) {
    if (fileName === "") {
        fileName = img.split("/").pop();
    }
    const filepath = `${ dir }/${ fileName }`;
    await mkdirIfNotExists(dir)
    const writer = fs.createWriteStream(filepath);
    const axiosConfig = {
        headers: {
            "User-Agent": COMMON_USER_AGENT,
            ...headersExt
        },
        responseType: "stream",
    };
    // 添加🪜
    if (isProxy) {
        axiosConfig.httpsAgent = new HttpsProxyAgent({
            host: proxyInfo.proxyAddr,
            port: proxyInfo.proxyPort
        });
    }
    try {
        const res = await axios.get(img, axiosConfig);
        res.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => {
                writer.close(() => {
                    resolve(filepath);
                });
            });
            writer.on("error", err => {
                fs.unlink(filepath, () => {
                    reject(err);
                });
            });
        });
    } catch (err) {
        logger.error(`图片下载失败, 原因：${ err }`);
    }
}

/**
 * 下载一张网络图片(使用aria2加速下载)
 * @param {Object} options 参数对象
 * @param {string} options.img 图片的URL
 * @param {string} options.dir 保存图片的目录
 * @param {string} [options.fileName] 自定义文件名 (可选)
 * @param {boolean} [options.isProxy] 是否使用代理 (可选)
 * @param {Object} [options.headersExt] 自定义请求头 (可选)
 * @param {Object} [options.proxyInfo] 代理信息 (可选)
 * @param {number} [options.numThread] 线程数 (可选)
 * @returns {Promise<unknown>}
 */
async function downloadImgWithAria2({
                                        img,
                                        dir,
                                        fileName = "",
                                        isProxy = false,
                                        headersExt = {},
                                        proxyInfo = {},
                                        numThread = 1,
                                    }) {
    if (fileName === "") {
        fileName = img.split("/").pop();
    }
    const filepath = path.resolve(dir, fileName);
    await mkdirIfNotExists(dir);

    // 构建 aria2c 命令
    let aria2cCmd = `aria2c "${ img }" --dir="${ dir }" --out="${ fileName }" --max-connection-per-server=${ numThread } --split=${ numThread } --min-split-size=1M --continue`;

    // 如果需要代理
    if (isProxy) {
        aria2cCmd += ` --all-proxy="http://${ proxyInfo.proxyAddr }:${ proxyInfo.proxyPort }"`;
    }

    // 添加自定义headers
    if (headersExt && Object.keys(headersExt).length > 0) {
        for (const [headerName, headerValue] of Object.entries(headersExt)) {
            aria2cCmd += ` --header="${ headerName }: ${ headerValue }"`;
        }
    }

    return new Promise((resolve, reject) => {
        exec(aria2cCmd, (error, stdout, stderr) => {
            if (error) {
                logger.error(`图片下载失败, 原因：${ error.message }`);
                reject(error);
                return;
            }
            resolve(filepath);
        });
    });
}

/**
 * 千位数的数据处理
 * @param data
 * @return {string|*}
 */
const dataProcessing = data => {
    return Number(data) >= TEN_THOUSAND ? (data / TEN_THOUSAND).toFixed(1) + "万" : data;
};

/**
 * 哔哩哔哩解析的数据处理
 * @param data
 * @return {string}
 */
export function formatBiliInfo(data) {
    return Object.keys(data).map(key => `${ key }：${ dataProcessing(data[key]) }`).join(' | ');
}

/**
 * 数字转换成具体时间
 * @param seconds
 * @return {string}
 */
export function secondsToTime(seconds) {
    const pad = (num, size) => num.toString().padStart(size, '0');

    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds % 3600) / 60);
    let secs = seconds % 60;

    // 如果你只需要分钟和秒钟，你可以返回下面这行：
    // return `${pad(minutes, 2)}:${pad(secs, 2)}`;

    // 完整的 HH:MM:SS 格式
    return `${ pad(hours, 2) }:${ pad(minutes, 2) }:${ pad(secs, 2) }`;
}

/**
 * 判断字符串是否是中文（全局判断）
 * @param str
 * @returns {boolean}
 */
export function isChinese(str) {
    return /^[\u4e00-\u9fff]+$/.test(str);
}

/**
 * 判断字符串是否包含中文
 * @param str
 * @returns {boolean}
 */
export function containsChinese(str) {
    return /[\u4e00-\u9fff]/.test(str);
}

/**
 * 判断字符串是否包含中文 &&   检测标点符号
 * @param str
 * @returns {boolean}
 */
export function containsChineseOrPunctuation(str) {
    return /[\u4e00-\u9fff\uff00-\uffef]/.test(str);
}

/**
 * 超过某个长度的字符串换为...
 * @param inputString
 * @param maxLength
 * @returns {*|string}
 */
export function truncateString(inputString, maxLength = 50) {
    return maxLength === 0 || maxLength === -1 || inputString.length <= maxLength
        ? inputString
        : inputString.substring(0, maxLength) + '...';
}

/**
 * 测试当前是否存在🪜
 * @returns {Promise<Boolean>}
 */
export async function testProxy(host = '127.0.0.1', port = 7890) {
    // 创建一个代理隧道
    const httpsAgent = new HttpsProxyAgent(`http://${ host }:${ port }`);

    try {
        // 通过代理服务器发起请求
        await axios.get('https://www.google.com', { httpsAgent });
        logger.mark(logger.yellow('[R插件][梯子测试模块] 检测到梯子'));
        return true;
    } catch (error) {
        logger.error('[R插件][梯子测试模块] 检测不到梯子');
        return false;
    }
}

export function formatSeconds(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${ minutes }分${ remainingSeconds }秒`;
}

/**
 * 重试 axios 请求
 * @param requestFunction
 * @param retries
 * @param delay
 * @returns {*}
 */
export async function retryAxiosReq(requestFunction, retries = 3, delay = 1000) {
    try {
        const response = await requestFunction();
        if (!response.data) {
            throw new Error('请求空数据');
        }
        return response.data;
    } catch (error) {
        if (retries > 0) {
            logger.mark(`[R插件][重试模块]重试中... (${ 3 - retries + 1 }/3) 次`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryAxiosReq(requestFunction, retries - 1, delay);
        } else {
            throw error;
        }
    }
}

/**
 * 统计给定文本中的中文字数
 *
 * @param {string} text - The text to count words in
 * @return {number} The number of words in the text
 */
export function countChineseCharacters(text) {
    const chineseCharacterRegex = /[\u4e00-\u9fa5]/g;
    const matches = text.match(chineseCharacterRegex);
    return matches ? matches.length : 0;
}

/**
 * 根据每分钟平均单词数估计给定文本的阅读时间
 *
 * @param {string} text - The text for which the reading time is estimated.
 * @param {number} wpm - The average words per minute for calculating reading time. Default is 200.
 * @return {Object} An object containing the estimated reading time in minutes and the word count.
 */
export function estimateReadingTime(text, wpm = 200) {
    const wordCount = countChineseCharacters(text);
    const readingTimeMinutes = wordCount / wpm;
    return {
        minutes: Math.ceil(readingTimeMinutes),
        words: wordCount
    };
}

/**
 * 检测当前环境是否存在某个命令
 * @param someCommand
 * @returns {Promise<boolean>}
 */
export function checkToolInCurEnv(someCommand) {
    // 根据操作系统选择命令
    return new Promise((resolve, reject) => {
        const command = os.platform() === 'win32' ? `where ${ someCommand }` : `which ${ someCommand }`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                logger.error(`[R插件][命令环境检测]未找到${ someCommand }: ${ stderr || error.message }`);
                resolve(false);
                return;
            }
            logger.info(`[R插件][命令环境检测]找到${ someCommand }: ${ stdout.trim() }`);
            resolve(true);
        });
    });
}

/**
 * debug：将 JSON 数据保存到本地文件
 * eg. saveJsonToFile(data, 'data.json', (err) => {})
 * @param {Object} jsonData - 要保存的 JSON 数据
 * @param {string} filename - 目标文件名
 * @param {function} callback - 可选的回调函数，处理写入完成后的操作
 */
export function saveJsonToFile(jsonData, filename = "data.json") {
    // 转换 JSON 数据为字符串
    const jsonString = JSON.stringify(jsonData, null, 2); // 第二个参数是 replacer，第三个参数是缩进

    // 保存到文件
    return fs.writeFile(filename, jsonString, 'utf8', (err) => {
        if (err) {
            logger.error('Error writing file', err);
        } else {
            logger.info('File successfully written');
        }
    });
}

/**
 * 删除文件名中的特殊符号（待完善）
 * @param filename
 * @returns {string}
 */
export function cleanFilename(filename) {
    // 1. 去除特殊字符
    // 2. 去除特定词汇
    filename = filename.replace(/[\/\?<>\\:\*\|".…《》()]/g, '')
        .replace(/电影|主题曲/g, '')
        .trim();

    return filename;
}

/**
 * 转换短链接
 * @param url
 * @returns {Promise<string>}
 */
export async function urlTransformShortLink(url) {
    const data = {
        url: `${ encodeURI(url) }`
    };

    const resp = await fetch(SHORT_LINKS, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    }).then(response => response.json());
    return await resp.data.short_url;
}
