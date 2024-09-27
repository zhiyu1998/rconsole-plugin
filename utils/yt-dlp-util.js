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
 * 获取标题
 * @param url
 * @param isOversea
 * @param proxy
 * @returns string
 */
export function ytDlpGetTilt(url, isOversea, proxy) {
    return execSync(`yt-dlp --get-title ${constructProxyParam(isOversea, proxy)} ${url} --encoding utf8`);
}

/**
 * yt-dlp 工具类
 * @returns {Promise<void>}
 * @param path       下载路径
 * @param url        下载链接
 * @param isOversea  是否是海外用户
 * @param proxy      代理地址
 * @param merge      是否合并输出为 mp4 格式 (仅适用于视频合并需求)
 */
export async function ytDlpHelper(path, url, isOversea, proxy, merge = false) {
    return new Promise((resolve, reject) => {
        const mergeOption = merge ? '--merge-output-format "mp4"' : '';

        const command = `yt-dlp -f "bv[height<=720][ext=mp4]+ba[ext=m4a]" ${constructProxyParam(isOversea, proxy)} -P ${path} -o "temp.%(ext)s" ${url}`;

        exec(command, (error, stdout) => {
            if (error) {
                console.error(`Error executing command: ${error}`);
                reject(error);
            } else {
                console.log(`Command output: ${stdout}`);
                resolve(stdout);
            }
        });
    });
}
