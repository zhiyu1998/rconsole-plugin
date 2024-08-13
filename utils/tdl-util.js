import { exec } from 'child_process';
import path from 'path'

/**
 * 执行 TDL 进行下载
 * @param url
 * @param curPath
 * @param isOversea
 * @param proxyAddr
 * @returns {Promise<string>}
 */
export async function startTDL(url, curPath, isOversea, proxyAddr) {
    return new Promise((resolve, reject) => {
        curPath = path.resolve(curPath);
        const proxyStr = isOversea ? `` : `--proxy ${ proxyAddr }`;
        const command = `tdl dl -u ${url} -d ${curPath} ${proxyStr}`
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