import axios from 'axios'
import { exec, spawn } from 'child_process';
import child_process from 'node:child_process'
import fs from "node:fs";
import path from "path";
import qrcode from "qrcode"
import util from "util";
import { BILI_RESOLUTION_LIST } from "../constants/constant.js";
import {
    BILI_BVID_TO_CID,
    BILI_DYNAMIC,
    BILI_PLAY_STREAM,
    BILI_SCAN_CODE_DETECT,
    BILI_SCAN_CODE_GENERATE,
    BILI_VIDEO_INFO
} from "../constants/tools.js";
import { mkdirIfNotExists } from "./file.js";

export const BILI_HEADER = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    referer: 'https://www.bilibili.com',
}

/**
 * 下载单个bili文件
 * @param url                       下载链接
 * @param fullFileName              文件名
 * @param progressCallback          下载进度
 * @param biliDownloadMethod        下载方式 {BILI_DOWNLOAD_METHOD}
 * @param videoDownloadConcurrency  视频下载并发
 * @returns {Promise<any>}
 */
export async function downloadBFile(url, fullFileName, progressCallback, biliDownloadMethod = 0, videoDownloadConcurrency = 1) {
    if (biliDownloadMethod === 0) {
        // 原生
        return normalDownloadBFile(url, fullFileName, progressCallback);
    }
    if (biliDownloadMethod === 1) {
        // 性能 Aria2
        return aria2DownloadBFile(url, fullFileName, progressCallback, videoDownloadConcurrency);
    } else {
        // 轻量
        return axelDownloadBFile(url, fullFileName, progressCallback, videoDownloadConcurrency);
    }
}

/**
 * 正常下载
 * @param url
 * @param fullFileName
 * @param progressCallback
 * @returns {Promise<{fullFileName: string, totalLen: number}>}
 */
async function normalDownloadBFile(url, fullFileName, progressCallback) {
    return axios
        .get(url, {
            responseType: 'stream',
            headers: {
                ...BILI_HEADER
            },
        })
        .then(({ data, headers }) => {
            let currentLen = 0;
            const totalLen = headers['content-length'];

            return new Promise((resolve, reject) => {
                data.on('data', ({ length }) => {
                    currentLen += length;
                    progressCallback?.(currentLen / totalLen);
                });

                data.pipe(
                    fs.createWriteStream(fullFileName).on('finish', () => {
                        resolve({
                            fullFileName,
                            totalLen,
                        });
                    }),
                );
            });
        });
}

/**
 * 使用Aria2下载
 * @param url
 * @param fullFileName
 * @param progressCallback
 * @param videoDownloadConcurrency
 * @returns {Promise<{fullFileName: string, totalLen: number}>}
 */
async function aria2DownloadBFile(url, fullFileName, progressCallback, videoDownloadConcurrency) {
    return new Promise((resolve, reject) => {
        logger.info(`[R插件][Aria2下载] 正在使用Aria2进行下载!`);
        // 构建aria2c命令
        const aria2cArgs = [
            '--file-allocation=none',  // 避免预分配文件空间
            '--continue',              // 启用暂停支持
            '-o', fullFileName,        // 指定输出文件名
            '--console-log-level=warn', // 减少日志 verbosity
            '--download-result=hide',   // 隐藏下载结果概要
            '--header', 'referer: https://www.bilibili.com', // 添加自定义标头
            `--max-connection-per-server=${ videoDownloadConcurrency }`, // 每个服务器的最大连接数
            `--split=${ videoDownloadConcurrency }`,               // 分成 6 个部分进行下载
            url
        ];

        // Spawn aria2c 进程
        const aria2c = spawn('aria2c', aria2cArgs);

        let totalLen = 0;
        let currentLen = 0;

        // 处理aria2c标准输出数据以捕获进度（可选）
        aria2c.stdout.on('data', (data) => {
            const output = data.toString();
            const match = output.match(/\((\d+)\s*\/\s*(\d+)\)/);
            if (match) {
                currentLen = parseInt(match[1], 10);
                totalLen = parseInt(match[2], 10);
                progressCallback?.(currentLen / totalLen);
            }
        });

        // 处理aria2c的stderr以捕获错误
        aria2c.stderr.on('data', (data) => {
            console.error(`aria2c error: ${ data }`);
        });

        // 处理进程退出
        aria2c.on('close', (code) => {
            if (code === 0) {
                resolve({ fullFileName, totalLen });
            } else {
                reject(new Error(`aria2c exited with code ${ code }`));
            }
        });
    });
}

/**
 * 使用 C 语言写的轻量级下载工具 Axel 进行下载
 * @param url
 * @param fullFileName
 * @param progressCallback
 * @param videoDownloadConcurrency
 * @returns {Promise<{fullFileName: string, totalLen: number}>}
 */
async function axelDownloadBFile(url, fullFileName, progressCallback, videoDownloadConcurrency) {
    return new Promise((resolve, reject) => {
        // 构建路径
        fullFileName = path.resolve(fullFileName);

        // 构建 -H 参数
        const headerParams = Object.entries(BILI_HEADER).map(
            ([key, value]) => `--header="${ key }: ${ value }"`
        ).join(' ');

        let command = '';
        let downloadTool = 'wget';
        if (videoDownloadConcurrency === 1) {
            // wget 命令
            command = `${ downloadTool } -O ${ fullFileName } ${ headerParams } '${ url }'`;
        } else {
            // AXEL 命令行
            downloadTool = 'axel';
            command = `${ downloadTool } -n ${ videoDownloadConcurrency } -o ${ fullFileName } ${ headerParams } '${ url }'`;
        }

        // 执行命令
        const axel = exec(command);
        logger.info(`[R插件][axel/wget] 执行命令：${ downloadTool } 下载方式为：${ downloadTool === 'wget' ? '单线程' : '多线程' }`);

        axel.stdout.on('data', (data) => {
            const match = data.match(/(\d+)%/);
            if (match) {
                const progress = parseInt(match[1], 10) / 100;
                progressCallback?.(progress);
            }
        });

        axel.stderr.on('data', (data) => {
            logger.info(`[R插件][${ downloadTool }]: ${ data }`);
        });

        axel.on('close', (code) => {
            if (code === 0) {
                resolve({
                    fullFileName,
                    totalLen: fs.statSync(fullFileName).size,
                });
            } else {
                reject(new Error(`[R插件][${ downloadTool }] 错误：${ code }`));
            }
        });
    });
}

/**
 * 获取下载链接
 * @param url
 * @param SESSDATA
 * @returns {Promise<any>}
 */
export async function getDownloadUrl(url, SESSDATA, qn) {
    const videoInfo = await getVideoInfo(url);
    const { bvid, cid } = videoInfo;

    if (!bvid || !cid) {
        logger.error(`[R插件][BILI下载] 无法从视频信息中获取bvid或cid`);
        throw new Error("获取bvid或cid失败");
    }
    
    // 转换画质数字为分辨率
    let qualityText;
    switch(parseInt(qn)) {
        case 80: qualityText = "1080P"; break;
        case 64: qualityText = "720P"; break;
        case 32: qualityText = "480P"; break;
        case 16: qualityText = "360P"; break;
        default: qualityText = "480P"; break;
    }
    logger.info(`[R插件][BILI下载] 开始获取视频下载链接，视频ID: ${bvid}, 请求画质: ${qualityText}`);
    const dash = await getBiliVideoWithSession(bvid, cid, SESSDATA, qn);
    // 获取关键信息
    const { video, audio } = dash;
    
    // 根据请求的画质选择对应的视频流
    let targetHeight;
    switch(parseInt(qn)) {
        case 80: targetHeight = 1080; break;  // 1080P
        case 64: targetHeight = 720; break;   // 720P
        case 32: targetHeight = 480; break;   // 480P
        case 16: targetHeight = 360; break;   // 360P
        default: targetHeight = 480;         // 默认480P
    }
    
    // 获取目标分辨率的所有视频流
    let matchingVideos = video.filter(v => v.height === targetHeight);
    
    // 如果找不到完全匹配的，找最接近但不超过目标分辨率的
    if (matchingVideos.length === 0) {
        matchingVideos = video
            .filter(v => v.height <= targetHeight)
            .sort((a, b) => b.height - a.height);
        
        // 获取最高的可用分辨率的所有视频流
        if (matchingVideos.length > 0) {
            const maxHeight = matchingVideos[0].height;
            matchingVideos = matchingVideos.filter(v => v.height === maxHeight);
        }
    }
    
    // 如果还是找不到，使用所有可用的最低分辨率视频流
    if (matchingVideos.length === 0) {
        const minHeight = Math.min(...video.map(v => v.height));
        matchingVideos = video.filter(v => v.height === minHeight);
    }

    // 在相同分辨率中选择编码优先级：hevc > av1 > avc
    let videoData;
    if (matchingVideos.length > 0) {
        // 记录编码信息
        const codecInfo = matchingVideos.map(v => 
            `${v.height}p(${v.codecs}): ${Math.round(v.bandwidth / 1024)}kbps`
        ).join(', ');
        logger.debug(`[R插件][BILI下载] 可选编码: ${codecInfo}`);

        // 按照编码和码率排序
        const codecPriority = { hevc: 1, av1: 2, avc: 3 };
        videoData = matchingVideos.sort((a, b) => {
            const codecA = a.codecs.toLowerCase();
            const codecB = b.codecs.toLowerCase();
            // 获取编码类型的优先级
            const priorityA = Object.entries(codecPriority).find(([key]) => codecA.includes(key))?.[1] || 999;
            const priorityB = Object.entries(codecPriority).find(([key]) => codecB.includes(key))?.[1] || 999;
            // 如果编码优先级相同，选择码率较低的
            if (priorityA === priorityB) {
                return a.bandwidth - b.bandwidth;
            }
            return priorityA - priorityB;
        })[0];
    }
    
    if (!videoData) {
        logger.error(`[R插件][BILI下载] 获取视频数据失败，请检查画质参数是否正确`);
        return { videoUrl: null, audioUrl: null };
    }

    logger.debug(`[R插件][BILI下载] 请求画质: ${qualityText}, 实际获取画质: ${videoData.height}p，分辨率: ${videoData.width}x${videoData.height}, 编码: ${videoData.codecs}, 码率: ${Math.round(videoData.bandwidth / 1024)}kbps`);
    
    // 提取信息
    const { backupUrl: videoBackupUrl, baseUrl: videoBaseUrl } = videoData;
    const videoUrl = selectAndAvoidMCdnUrl(videoBaseUrl, videoBackupUrl);
    
    // 音频处理 - 选择对应画质的音频流
    const audioData = audio?.[0];
    let audioUrl = null;
    if (audioData != null && audioData !== undefined) {
        const { backupUrl: audioBackupUrl, baseUrl: audioBaseUrl } = audioData;
        audioUrl = selectAndAvoidMCdnUrl(audioBaseUrl, audioBackupUrl);
        logger.debug(`[R插件][BILI下载] 音频码率: ${Math.round(audioData.bandwidth / 1024)}kbps`);
    }
    
    return { videoUrl, audioUrl };
}

/**
 * 合并视频和音频
 * @param vFullFileName
 * @param aFullFileName
 * @param outputFileName
 * @param shouldDelete
 * @returns {Promise<{outputFileName}>}
 */
export async function mergeFileToMp4(vFullFileName, aFullFileName, outputFileName, shouldDelete = true) {
    // 判断当前环境
    let env;
    if (process.platform === "win32") {
        env = process.env
    } else if (process.platform === "linux") {
        env = {
            ...process.env,
            PATH: '/usr/local/bin:' + child_process.execSync('echo $PATH').toString(),
        };
    } else {
        logger.warn("[R插件][合并视频和音频] 检测到未知系统，可能是MacOS.");
    }
    const execFile = util.promisify(child_process.execFile);
    try {
        const cmd = 'ffmpeg';
        const args = ['-y', '-i', vFullFileName, '-i', aFullFileName, '-c', 'copy', outputFileName];
        await execFile(cmd, args, { env });

        if (shouldDelete) {
            await fs.promises.unlink(vFullFileName);
            await fs.promises.unlink(aFullFileName);
        }

        return { outputFileName };
    } catch (err) {
        logger.error(err);
    }
}

/**
 * 下载m4s文件，通过ffmpeg转换成mp3
 * @param m4sUrl
 * @returns {Promise<void>}
 */
export async function m4sToMp3(m4sUrl, path) {
    return axios
        .get(m4sUrl, {
            responseType: 'stream',
            headers: {
                ...BILI_HEADER
            },
        }).then(async res => {
            // 如果没有目录就创建一个
            await mkdirIfNotExists(path)
            // 补充保存文件名
            path += "/temp.m4s";
            if (fs.existsSync(path)) {
                fs.unlinkSync(path);
            }
            // 开始下载
            const fileStream = fs.createWriteStream(path);
            res.data.pipe(fileStream);
            // 下载完成
            return new Promise((resolve, reject) => {
                fileStream.on("finish", () => {
                    fileStream.close(() => {
                        const transformCmd = `ffmpeg -i ${ path } ${ path.replace(".m4s", ".mp3") } -y -loglevel quiet`;
                        child_process.execSync(transformCmd)
                        logger.mark("bili: mp3下载完成")
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

/**
 * 哔哩哔哩音乐下载
 * @param bvid BVID
 * @param cid  （选项）CID
 * @returns {Promise<any>}
 */
export async function getBiliAudio(bvid, cid) {
    // 转换cid
    if (!cid)
        cid = await fetchCID(bvid).catch((err) => console.log(err))

    // 返回一个fetch的promise
    return (new Promise((resolve, reject) => {
        fetch(BILI_PLAY_STREAM.replace("{bvid}", bvid).replace("{cid}", cid), {
            headers: {
                ...BILI_HEADER,
            }
        })
            .then(res => res.json())
            .then(json => resolve(json.data.dash.audio[0].baseUrl));
    }))
}

export async function getBiliVideoWithSession(bvid, cid, SESSDATA, qn) {
    if (!cid) {
        cid = await fetchCID(bvid).catch((err) => logger.error(err))
    }
    const apiUrl = BILI_PLAY_STREAM
        .replace("{bvid}", bvid)
        .replace("{cid}", cid)
        .replace("{qn}", qn);
    logger.debug(`[R插件][BILI请求审计] 请求URL: ${apiUrl}`);
    
    return (new Promise((resolve, reject) => {
        fetch(apiUrl, {
            headers: {
                ...BILI_HEADER,
                Cookie: `SESSDATA=${SESSDATA}`
            }
        })
            .then(res => res.json())
            .then(json => {
                if (json.code !== 0) {
                    logger.error(`[R插件][BILI请求审计] 请求失败: ${json.message}`);
                    reject(new Error(json.message));
                } else {
                    // 记录每个视频流的画质信息
                    const qualityInfo = json.data.dash.video
                        .sort((a, b) => b.height - a.height)  // 按分辨率从高到低排序
                        .map(v => `${v.height}p(${v.codecs}): ${Math.round(v.bandwidth / 1024)}kbps`)
                        .join(', ');
                    logger.debug(`[R插件][BILI请求审计] 请求成功，可用画质列表: ${qualityInfo}`);
                    resolve(json.data.dash);
                }
            })
            .catch(err => {
                logger.error(`[R插件][BILI请求审计] 请求异常: ${err.message}`);
                reject(err);
            });
    }))
}

/**
 * bvid转换成cid
 * @param bvid
 * @returns {Promise<*>}
 */
export const fetchCID = async (bvid) => {
    //console.log('Data.js Calling fetchCID:' + URL_BVID_TO_CID.replace("{bvid}", bvid))
    const res = await fetch(BILI_BVID_TO_CID.replace("{bvid}", bvid))
    const json = await res.json()
    const cid = json.data[0].cid
    return cid
}

/**
 * 获取视频信息
 * @param url
 * @returns {Promise<{duration: *, owner: *, bvid: *, stat: *, pages: *, dynamic: *, pic: *, title: *, aid: *, desc: *, cid: *}>}
 */
export async function getVideoInfo(url) {
    const videoId = /video\/[^\?\/ ]+/.exec(url)[0].split("/")[1];
    let apiUrl;

    if (videoId.toLowerCase().startsWith('av')) {
        const aid = videoId.substring(2);
        apiUrl = `${BILI_VIDEO_INFO}?aid=${aid}`;
    } else {
        apiUrl = `${BILI_VIDEO_INFO}?bvid=${videoId}`;
    }

    // 获取视频信息，然后发送
    return fetch(apiUrl)
        .then(async resp => {
            const respJson = await resp.json();
            if (respJson.code !== 0) {
                logger.error(`[R插件] 获取视频信息失败: ${respJson.message}`, `ID: ${videoId}`);
                throw new Error(`获取视频信息失败: ${respJson.message || '请求错误'}`);
            }
            const respData = respJson.data;
            return {
                title: respData.title,
                pic: respData.pic,
                desc: respData.desc,
                duration: respData.duration,
                dynamic: respData.dynamic,
                stat: respData.stat,
                bvid: respData.bvid,
                aid: respData.aid,
                cid: respData.pages?.[0].cid,
                owner: respData.owner,
                pages: respData?.pages,
            };
        });
}

/**
 * 获取动态
 * @param dynamicId
 * @returns {Promise<any>}
 */
export async function getDynamic(dynamicId, SESSDATA) {
    const dynamicApi = BILI_DYNAMIC.replace("{}", dynamicId);
    return axios.get(dynamicApi, {
        headers: {
            ...BILI_HEADER,
            Cookie: `SESSDATA=${ SESSDATA }`
        },
    }).then(resp => {
        const innerCardObject = resp.data.data.card;
        const card = JSON.parse(innerCardObject.card);
        const dynamicType = innerCardObject.desc?.type;

        let dynamicDesc = '';
        let pictures = [];
        // 目前的api只有返回专栏部分文字以及专栏封面
        if (dynamicType === 64) {
            dynamicDesc = `【专栏】${card.title || ''}\n${card.summary || ''}`;
            pictures = card.image_urls || [];
        } else {
            const dynamicOrigin = card.item;
            dynamicDesc = dynamicOrigin?.description || dynamicOrigin?.content;
            pictures = dynamicOrigin?.pictures || [];
        }

        let dynamicSrc = [];
        if (Array.isArray(pictures)) {
            for (let pic of pictures) {
                const img_src = typeof pic === 'string' ? pic : pic?.img_src;
                if (img_src) {
                    dynamicSrc.push(img_src);
                }
            }
        }
        // console.log(dynamic_src)
        return {
            dynamicSrc,
            dynamicDesc
        }
    })
}

/**
 * 扫码
 * @param qrcodeSavePath      【必须】QR保存位置
 * @param detectTime          【可选】检测时间（默认10s检测一次）
 * @param hook                【可选】钩子函数，目前只用来人机交互
 * @returns {Promise<{
 *             SESSDATA,
 *             refresh_token
 *         }>}
 */
export async function getScanCodeData(qrcodeSavePath = 'qrcode.png', detectTime = 10, hook = () => {
}) {
    try {
        const resp = await axios.get(BILI_SCAN_CODE_GENERATE, { ...BILI_HEADER });
        // 保存扫码的地址、扫码登录秘钥
        const { url: scanUrl, qrcode_key } = resp.data.data;
        await qrcode.toFile(qrcodeSavePath, scanUrl);

        let code = 1;

        // 设置最大尝试次数
        let attemptCount = 0;
        const maxAttempts = 3;

        let loginResp;
        // 钩子函数，目前用于发送二维码给用户
        hook();
        // 检测扫码情况默认 10s 检测一次，并且尝试3次，没扫就拜拜
        while (code !== 0 && attemptCount < maxAttempts) {
            loginResp = await axios.get(BILI_SCAN_CODE_DETECT.replace("{}", qrcode_key), { ...BILI_HEADER });
            code = loginResp.data.data.code;
            await new Promise(resolve => setTimeout(resolve, detectTime * 1000)); // Wait for detectTime seconds
        }
        // 获取刷新令牌
        const { refresh_token } = loginResp.data.data;

        // 获取cookie
        const cookies = loginResp.headers['set-cookie'];
        const SESSDATA = cookies
            .map(cookie => cookie.split(';').find(item => item.trim().startsWith('SESSDATA=')))
            .find(item => item !== undefined)
            ?.split('=')[1];

        return {
            SESSDATA,
            refresh_token
        };
    } catch (err) {
        logger.error(err);
        // 可能需要处理错误或返回一个默认值
        return {
            SESSDATA: '',
            refresh_token: ''
        };
    }
}

/**
 * 过滤简介中的一些链接
 * @param link
 * @returns {Promise<string>}
 */
export async function filterBiliDescLink(link) {
    // YouTube链接
    const regex = /(?:https?:\/\/)?(?:www\.|music\.)?youtube\.com\/[A-Za-z\d._?%&+\-=\/#]*/g;
    if (regex.test(link)) {
        // 使用replace方法过滤掉匹配的链接
        return link.replace(regex, '').replace(/\n/g, '').trim();
    }
    return link;
}

/**
 * 动态规避哔哩哔哩cdn中的mcdn
 * @param baseUrl
 * @param backupUrls
 * @returns {string}
 */
function selectAndAvoidMCdnUrl(baseUrl, backupUrls) {
    // 判断BaseUrl
    if (!baseUrl.includes(".mcdn.bilivideo.cn")) {
        return baseUrl;
    }
    // backUrls, 找不到返回undefined
    const backupUrl = backupUrls.find(backupUrl => {
        return !backupUrl.includes(".mcdn.bilivideo.cn");
    })
    // 找到直接返回
    if (backupUrl !== undefined) {
        return backupUrl;
    }
    logger.info("[R插件][bili-MCDN] 检测到 mcdn 开始替换为源站的 cdn");
    // 找不到替换 backupUrls 的第一个链接
    return replaceP2PUrl(backupUrls?.[0]);
}

/**
 * 动态替换哔哩哔哩 CDN
 * @param url
 * @param cdnSelect
 * @returns {*|string}
 */
function replaceP2PUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostName = urlObj.hostname;
        if (urlObj.hostname.match(/upos-sz-mirror08[ch]\.bilivideo\.com/) || urlObj.hostname.match(/upos-hz-mirrorakam\.akamaized\.net/)) {
            urlObj.host = 'upos-sz-mirrorhwo1.bilivideo.com'
            urlObj.port = 443;
            logger.info(`更换视频源: ${ hostName } -> ${ urlObj.host }`);
            return urlObj.toString();
        } else if (urlObj.hostname.match(/upos-sz-estgoss\.bilivideo\.com/) || urlObj.hostname.match(/upos-sz-mirrorali(ov|b)?\.bilivideo\.com/)) {
            urlObj.host = 'upos-sz-mirroralio1.bilivideo.com'
            urlObj.port = 443;
            logger.info(`更换视频源: ${ hostName } -> ${ urlObj.host }`);
            return urlObj.toString();
        } else if (urlObj.hostname.endsWith(".mcdn.bilivideo.cn") || urlObj.hostname.match(/cn(-[a-z]+){2}(-\d{2}){2}\.bilivideo\.com/)) {
            urlObj.host = 'upos-sz-mirrorcoso1.bilivideo.com';
            urlObj.port = 443;
            logger.info(`更换视频源: ${ hostName } -> ${ urlObj.host }`);
            return urlObj.toString();
        } else if (urlObj.hostname.endsWith(".szbdyd.com")) {
            urlObj.host = urlObj.searchParams.get('xy_usource');
            urlObj.port = 443;
            logger.info(`更换视频源: ${ hostName } -> ${ urlObj.host }`);
            return urlObj.toString();
        }
        return url;
    } catch (e) {
        return url;
    }
}

/**
 * 拼接分辨率，例如："720P 高清, 480P 清晰, 360P 流畅"
 * @param selectedValue
 * @returns {*}
 */
export function getResolutionLabels(selectedValue) {
    // 过滤出 value 大于等于 selectedValue 的所有对象
    const filteredResolutions = BILI_RESOLUTION_LIST.filter(resolution => resolution.value >= selectedValue);

    // 将这些对象的 label 拼接成一个字符串
    return filteredResolutions.map(resolution => resolution.label).join(', ');
}