import { exec } from 'child_process';
import path from 'path'

/**
 * 执行 TDL 进行下载
 * @param url
 * @param curPath
 * @param isOversea
 * @param proxyAddr
 * @param videoDownloadConcurrency
 * @returns {Promise<string>}
 */
export async function startTDL(url, curPath, isOversea, proxyAddr, videoDownloadConcurrency = 1) {
    return new Promise((resolve, reject) => {
        curPath = path.resolve(curPath);
        const proxyStr = isOversea ? `` : `--proxy ${ proxyAddr }`;
        const concurrencyStr = videoDownloadConcurrency > 1 ? `-t ${videoDownloadConcurrency} -s 524288 -l ${videoDownloadConcurrency}` : '';
        const command = `tdl dl -u ${url} -d ${curPath} ${concurrencyStr} ${proxyStr}`
        logger.mark(`[R插件][TDL] ${command}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`[R插件][TDL]执行出错: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`[R插件][TDL]错误信息: ${stderr}`);
                return;
            }
            resolve(stdout);
        })
    })
}