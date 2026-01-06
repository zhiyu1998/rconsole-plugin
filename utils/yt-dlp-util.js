import { exec } from "child_process";

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
    return (cookiePath !== "" && url.includes("youtu")) ? `--cookies ${cookiePath}` : "";
}

/**
 * yt-dlp获取标题的时候可能需要的一个编码参数，也在一定程度上解决部分window系统乱码问题
 * @param url
 * @returns {string}
 */
function constructEncodingParam(url) {
    return "--encoding UTF-8"; // 始终为标题获取使用 UTF-8 编码
}


/**
 * 获取时长
 * @param url
 * @param isOversea
 * @param proxy
 * @param cookiePath
 * @returns string
 */
export function ytDlpGetDuration(url, isOversea, proxy, cookiePath = "") {
    return new Promise((resolve, reject) => {
        // 构造 cookie 参数
        const cookieParam = constructCookiePath(url, cookiePath);
        const command = `yt-dlp --get-duration --skip-download ${cookieParam} ${constructProxyParam(isOversea, proxy)} "${url}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                logger.error(`[R插件][yt-dlp审计] Error executing ytDlpGetDuration: ${error}. Stderr: ${stderr}`);
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
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
    return new Promise((resolve, reject) => {
        // 构造 cookie 参数
        const cookieParam = constructCookiePath(url, cookiePath);
        // 构造 编码 参数
        const encodingParam = constructEncodingParam(url);
        const command = `yt-dlp --get-title --skip-download ${cookieParam} ${constructProxyParam(isOversea, proxy)} "${url}" ${encodingParam}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                logger.error(`[R插件][yt-dlp审计] Error executing ytDlpGetTilt: ${error}. Stderr: ${stderr}`);
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

/**
 * 获取缩略图URL（不下载）
 * @param url
 * @param isOversea
 * @param proxy
 * @param cookiePath
 * @returns string - 缩略图URL
 */
export function ytDlpGetThumbnailUrl(url, isOversea, proxy, cookiePath = "") {
    return new Promise((resolve, reject) => {
        const cookieParam = constructCookiePath(url, cookiePath);
        const command = `yt-dlp --get-thumbnail --skip-download ${cookieParam} ${constructProxyParam(isOversea, proxy)} "${url}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                logger.error(`[R插件][yt-dlp审计] Error executing ytDlpGetThumbnailUrl: ${error}. Stderr: ${stderr}`);
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

/**
 * 获取封面（下载到本地）
 * @param path 下载路径
 * @param url 视频链接
 * @param isOversea 是否海外
 * @param proxy 代理
 * @param cookiePath cookie路径
 * @returns {Promise<string>} 缩略图文件名
 */
export function ytDlpGetThumbnail(path, url, isOversea, proxy, cookiePath = "") {
    return new Promise((resolve, reject) => {
        const cookieParam = constructCookiePath(url, cookiePath);
        const command = `yt-dlp --write-thumbnail --convert-thumbnails png --skip-download ${cookieParam} ${constructProxyParam(isOversea, proxy)} "${url}" -P "${path}" -o "thumbnail.%(ext)s"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                logger.error(`[R插件][yt-dlp] 获取封面失败: ${error.message}`);
                return reject(error);
            }
            // 固定返回 thumbnail.png
            resolve("thumbnail.png");
        });
    });
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
 * @param outputFilename 输出文件名 (不含扩展名)
 * @param cookiePath Cookie所在位置
 * @param preferredCodec 用户选择的编码：auto, av1, hevc, avc
 */
export async function ytDlpHelper(path, url, isOversea, proxy, maxThreads, outputFilename, merge = false, graphics, timeRange, cookiePath = "", preferredCodec = "auto") {
    return new Promise((resolve, reject) => {
        let command = "";
        // 构造 cookie 参数
        const cookieParam = constructCookiePath(url, cookiePath);
        // 确保 outputFilename 不为空，提供一个默认值以防万一
        const finalOutputFilename = outputFilename || "temp_download";

        if (url.includes("music")) {
            // 这里是 YouTube Music的处理逻辑
            // e.g yt-dlp -x --audio-format mp3 https://youtu.be/5wEtefq9VzM -o test.mp3
            command = `yt-dlp -x --audio-format flac -f ba ${cookieParam} ${constructProxyParam(isOversea, proxy)} -P "${path}" -o "${finalOutputFilename}.flac" "${url}"`;
        } else {
            // YouTube视频下载逻辑
            // 根据用户选择的编码设置 -S 参数
            let codecSort;
            switch (preferredCodec) {
                case 'av1':
                    codecSort = '-S "+codec:av01"';
                    logger.info(`[R插件][yt-dlp] 用户指定编码: AV1`);
                    break;
                case 'hevc':
                    codecSort = '-S "+codec:hev1"';
                    logger.info(`[R插件][yt-dlp] 用户指定编码: HEVC`);
                    break;
                case 'avc':
                    codecSort = '-S "+codec:avc1"';
                    logger.info(`[R插件][yt-dlp] 用户指定编码: AVC`);
                    break;
                default:
                    // auto: 使用 yt-dlp 默认的编码优先级（AV1 > VP9 > H.264）
                    codecSort = '-S "codec"';
                    break;
            }

            let formatSelector = "";
            if (url.includes("youtu")) {
                // graphics 包含画质限制如 [height<=720]
                formatSelector = `--download-sections "*${timeRange}" -f "bv*${graphics}+ba/b${graphics}" ${codecSort} --merge-output-format mp4`;
            }

            command = `yt-dlp -N ${maxThreads} ${formatSelector} --concurrent-fragments ${maxThreads} ${cookieParam} ${constructProxyParam(isOversea, proxy)} -P "${path}" -o "${finalOutputFilename}.%(ext)s" "${url}"`;
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
