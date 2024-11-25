import axios from "axios";
import fs from "node:fs";
import path from "path";
import child_process from "node:child_process";
import util from "util";

/**
 * 去除JSON的一些转义 \\" -> \" ->"
 * @param str
 */
function escapeSpecialChars(str) {
    return str.replace(/\\\\"/g, '\\"').replace(/\\"/g, '"');
}

const parseVideoName = videoInfo => {
    const acfunId = "ac" + (videoInfo?.dougaId || "");
    const acfunTitle = videoInfo?.title;
    const acfunAuthor = videoInfo?.user.name;
    const uploadTime = videoInfo?.createTime;
    const description = videoInfo?.description;

    const raw = [acfunId, acfunTitle, acfunAuthor, uploadTime, description]
        .map(d => d || "")
        .join("_")
        .slice(0, 100);

    return raw;
};

const parseVideoNameFixed = videoInfo => {
    const f = parseVideoName(videoInfo);
    const t = f.replaceAll(" ", "-");
    return t;
};

async function parseUrl(videoUrlAddress) {
    // eg https://www.acfun.cn/v/ac4621380?quickViewId=videoInfo_new&ajaxpipe=1
    const urlSuffix = "?quickViewId=videoInfo_new&ajaxpipe=1";
    const url = videoUrlAddress + urlSuffix;

    const raw = await axios.get(url).then(resp => {
        return resp.data;
    });
    // Split
    const strsRemoveHeader = raw.split("window.pageInfo = window.videoInfo =");
    const strsRemoveTail = strsRemoveHeader[1].split("</script>");
    const strJson = strsRemoveTail[0];

    const strJsonEscaped = escapeSpecialChars(strJson);
    /** Object videoInfo */
    const videoInfo = JSON.parse(strJsonEscaped);

    const videoName = parseVideoNameFixed(videoInfo);

    const ksPlayJson = videoInfo.currentVideoInfo.ksPlayJson;
    /** Object ksPlay */
    const ksPlay = JSON.parse(ksPlayJson);

    const representations = ksPlay.adaptationSet[0].representation;
    const urlM3u8s = representations.map(d => d.url);

    return { urlM3u8s, videoName };
}

async function parseM3u8(m3u8Url) {
    const m3u8File = await axios.get(m3u8Url).then(resp => resp.data);

    /** 分离ts文件链接 */
    const rawPieces = m3u8File.split(/\n#EXTINF:.{8},\n/);
    /** 过滤头部 */
    const m3u8RelativeLinks = rawPieces.slice(1);
    /** 修改尾部 去掉尾部多余的结束符 */
    const patchedTail = m3u8RelativeLinks[m3u8RelativeLinks.length - 1].split("\n")[0];
    m3u8RelativeLinks[m3u8RelativeLinks.length - 1] = patchedTail;

    /** 完整链接，直接加m3u8Url的通用前缀 */
    const m3u8Prefix = m3u8Url.split("/").slice(0, -1).join("/");
    const m3u8FullUrls = m3u8RelativeLinks.map(d => m3u8Prefix + "/" + d);
    /** aria2c下载的文件名，就是取url最后一段，去掉末尾url参数(?之后是url参数) */
    const tsNames = m3u8RelativeLinks.map(d => d.split("?")[0]);
    /** 文件夹名，去掉文件名末尾分片号 */
    let outputFolderName = tsNames[0].slice(0, -9);
    /** 输出最后合并的文件名，加个通用mp4后缀 */
    const outputFileName = outputFolderName + ".mp4";

    return {
        m3u8FullUrls,
        tsNames,
        outputFolderName,
        outputFileName,
    };
}

// 下载m3u8
async function downloadM3u8Videos(m3u8FullUrls, outputFolderName) {
    /** 新建下载文件夹 在当前运行目录下 */
    const outPath = outputFolderName;

    /** 批下载 */
    const strDownloadParamFiles = m3u8FullUrls.map(async (d, i) => {
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(outPath + `${i}.ts`);
            axios
                .get(d, {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
                    },
                    responseType: "stream",
                })
                .then(dres => {
                    dres.data.pipe(writer);
                    writer.on("finish", () => resolve(true));
                    writer.on("error", () => reject);
                });
        });
    });
    /** 写入下载链接列表文件 */
    // fs.writeFileSync(path.resolveControl(outPath, "urls.txt"), str下载参数文件);
    return Promise.all(strDownloadParamFiles);
}

async function mergeAcFileToMp4(tsNames, FullFileName, outputFileName, shouldDelete = true) {
    /** 合并参数列表 格式file path */
    const concatStrs = tsNames.map(
        (d, i) => `file ${path.resolve(FullFileName, i + ".ts").replace(/\\/g, "/")}`,
    );

    const ffmpegList = path.resolve(FullFileName, "file.txt");
    fs.writeFileSync(ffmpegList, concatStrs.join("\n"));
    const outPath = path.resolve(outputFileName);

    // 判断当前环境
    let env;
    if (process.platform === "win32") {
        env = process.env;
    } else if (process.platform === "linux") {
        env = {
            ...process.env,
            PATH: "/usr/local/bin:" + child_process.execSync("echo $PATH").toString(),
        };
    } else {
        console.log("暂时不支持当前操作系统！");
    }

    const execFile = util.promisify(child_process.execFile);
    try {
        const cmd = "ffmpeg";
        const args = ["-y", "-f", "concat", "-safe", "0", "-i", ffmpegList, "-c", "copy", outPath];
        await execFile(cmd, args, { env });

        if (shouldDelete) {
            fs.unlink(FullFileName, f => f);
        }

        return { outputFileName };
    } catch (err) {
        logger.error(err);
    }
}

export { parseUrl, parseM3u8, downloadM3u8Videos, mergeAcFileToMp4 };
