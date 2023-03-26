import fs from "node:fs";
import axios from 'axios'
import child_process from 'node:child_process'
import util from "util";

async function downloadBFile (url, fullFileName, progressCallback) {
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

async function getDownloadUrl (url, isLargeVideo=false) {
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
            const level = isLargeVideo ? (Math.min(info?.data?.dash?.video.length - 1, info?.data?.dash?.audio.length - 1)) : 0;
            const videoUrl =
                info?.data?.dash?.video?.[level]?.baseUrl ?? info?.data?.dash?.video?.[level]?.backupUrl?.[0];

            const audioUrl =
                info?.data?.dash?.audio?.[level]?.baseUrl ?? info?.data?.dash?.audio?.[level]?.backupUrl?.[0];
            const title = data.match(/title="(.*?)"/)?.[1]?.replaceAll?.(/\\|\/|:|\*|\?|"|<|>|\|/g, '');


            if (videoUrl && audioUrl) {
                return { videoUrl, audioUrl, title };
            }

            return Promise.reject('获取下载地址失败');
        });
}

async function mergeFileToMp4 (vFullFileName, aFullFileName, outputFileName, shouldDelete = true) {
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
        throw err;
    }
}

async function getDynamic(dynamicId) {
    const dynamicApi = `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id=${dynamicId}`
    return axios.get(dynamicApi, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
            'referer': 'https://www.bilibili.com',
        }
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

export { downloadBFile, getDownloadUrl, mergeFileToMp4, getDynamic }
