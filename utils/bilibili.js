import fs from "node:fs";
import axios from 'axios'
import child_process from 'node:child_process'
import util from "util";
import { BILI_BVID_TO_CID, BILI_DYNAMIC, BILI_PLAY_STREAM, BILI_VIDEO_INFO } from "../constants/tools.js";
import { mkdirIfNotExists } from "./file.js";

/**
 * 下载单个bili文件
 * @param url
 * @param fullFileName
 * @param progressCallback
 * @returns {Promise<any>}
 */
export async function downloadBFile(url, fullFileName, progressCallback) {
    return axios
        .get(url, {
            responseType: 'stream',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: 'https://www.bilibili.com',
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
 * 获取下载链接
 * @param url
 * @returns {Promise<any>}
 */
export async function getDownloadUrl(url) {
    return axios
        .get(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: 'https://www.bilibili.com',
            },
        })
        .then(({ data }) => {
            const info = JSON.parse(
                data.match(/<script>window\.__playinfo__=({.*})<\/script><script>/)?.[1],
            );
            // 如果是大视频直接最低分辨率
            const videoUrl =
                info?.data?.dash?.video?.[0]?.baseUrl ?? info?.data?.dash?.video?.[0]?.backupUrl?.[0];

            const audioUrl =
                info?.data?.dash?.audio?.[0]?.baseUrl ?? info?.data?.dash?.audio?.[0]?.backupUrl?.[0];
            const title = data.match(/title="(.*?)"/)?.[1]?.replaceAll?.(/\\|\/|:|\*|\?|"|<|>|\|/g, '');


            if (videoUrl && audioUrl) {
                return { videoUrl, audioUrl, title };
            }

            return Promise.reject('获取下载地址失败');
        });
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
        logger.error("暂时不支持当前操作系统！")
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
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: 'https://www.bilibili.com',
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
        fetch(BILI_PLAY_STREAM.replace("{bvid}", bvid).replace("{cid}", cid))
            .then(res => res.json())
            .then(json => resolve(json.data.dash.audio[0].baseUrl));
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
    // const baseVideoInfo = "http://api.bilibili.com/x/web-interface/view";
    const videoId = /video\/[^\?\/ ]+/.exec(url)[0].split("/")[1];
    // 获取视频信息，然后发送
    return fetch(`${ BILI_VIDEO_INFO }?bvid=${ videoId }`)
        .then(async resp => {
            const respJson = await resp.json();
            const respData = respJson.data;
            return {
                title: respData.title,
                pic: respData.pic,
                desc: respData.desc,
                duration: respData.duration,
                dynamic: respJson.data.dynamic,
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
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
            'referer': 'https://www.bilibili.com',
            Cookie: `SESSDATA=${ SESSDATA }`
        },
    }).then(resp => {
        const dynamicData = resp.data.data.card
        const card = JSON.parse(dynamicData.card)
        const dynamicOrigin = card.item
        const dynamicDesc = dynamicOrigin.description

        const pictures = dynamicOrigin.pictures
        let dynamicSrc = []
        for (let pic of pictures) {
            const img_src = pic.img_src
            dynamicSrc.push(img_src)
        }
        // console.log(dynamic_src)
        return {
            dynamicSrc,
            dynamicDesc
        }
    })
}