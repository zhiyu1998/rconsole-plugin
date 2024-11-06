import { exec, execSync } from "child_process";

/**
 * 构建梯子参数
 * @param isOversea
 * @param proxy
 * @returns {string|string}
 */
function constructProxyParam(isOversea, proxy) {
    return isOversea ? "" : `--proxy ${proxy}`;
}

/**
 * 构造cookie参数
 * 目前只支持YouTube构造cookie，否则就必须修改`url.includes("youtu")`
 * @param url
 * @param cookiePath
 * @returns {string}
 */
function constructCookiePath(url, cookiePath) {
    return (cookiePath !== "" && url.includes("youtu")) ? `--cookies ${ cookiePath }` : "";
}


/**
 * 获取时长
 * @param url
 * @param isOversea
 * @param proxy
 * @returns string
 */
export function ytDlpGetDuration(url, isOversea, proxy) {
    return execSync(`yt-dlp --get-duration --skip-download ${constructProxyParam(isOversea, proxy)} ${url}`);
}

function constructEncodingParam(url) {
    let encodingParam = "";
    if (url.includes("youtu")) {
        encodingParam = "--encoding UTF-8";
    }
    return encodingParam;
}

/**
 * 获取标题
 * @param url
 * @param isOversea
 * @param proxy
 * @param cookiePath
 * @returns string
 */
export function ytDlpGetTilt(url, isOversea, proxy, cookiePath = "") {
    const cookieParam = constructCookiePath(url, cookiePath);
    const encodingParam = constructEncodingParam(url);
    return execSync(`yt-dlp --get-title --skip-download ${cookieParam} ${ constructProxyParam(isOversea, proxy) } ${ url } ${encodingParam}`);
}

/**
 * 获取封面
 * @param path
 * @param url
 * @param isOversea
 * @param proxy
 * @param cookiePath
 */
export function ytDlpGetThumbnail(path, url, isOversea, proxy, cookiePath= "") {
    const cookieParam = constructCookiePath(url, cookiePath);
    return execSync(`yt-dlp --write-thumbnail --convert-thumbnails png --skip-download ${cookieParam} ${constructProxyParam(isOversea, proxy)} ${url} -P ${path} -o "thumbnail.%(ext)s"`);
}

/**
 * yt-dlp 工具类
 * @returns {Promise<void>}
 * @param path       下载路径
 * @param url        下载链接
 * @param isOversea  是否是海外用户
 * @param proxy      代理地址
 * @param merge      是否合并输出为 mp4 格式 (仅适用于视频合并需求)
 * @param graphics   YouTube画质参数
 * @param timeRange  截取时间段
 * @param maxThreads 最大并发
 * @param cookiePath Cookie所在位置
 */
export async function ytDlpHelper(path, url, isOversea, proxy, maxThreads, merge = false, graphics, timeRange, cookiePath = "") {
    return new Promise((resolve, reject) => {
        let command = "";
        const cookieParam = constructCookiePath(url, cookiePath);
        if (url.includes("music")) {
            // e.g yt-dlp -x --audio-format mp3 https://youtu.be/5wEtefq9VzM -o test.mp3
            command = `yt-dlp -x --audio-format mp3 ${cookieParam} ${constructProxyParam(isOversea, proxy)} -P ${path} -o "temp.mp3" ${url}`;
        } else {
            const fParam = url.includes("youtu") ? `--download-sections "*${timeRange}" -f "bv${graphics}[ext=mp4]+ba[ext=m4a]" ` : "";

            command = `yt-dlp -N ${maxThreads} ${fParam} --concurrent-fragments ${maxThreads} ${cookieParam} ${constructProxyParam(isOversea, proxy)} -P ${path} -o "temp.%(ext)s" ${url}`;
        }

        logger.info(`[R插件][yt-dlp审计] ${command}`);

        exec(command, (error, stdout) => {
            if (error) {
                logger.error(`[R插件][yt-dlp审计] 执行命令时出错: ${error}`);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}
