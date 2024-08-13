/**
 * yt-dlp工具类
 * @returns {Promise<void>}
 * @param path      下载路径
 * @param url       下载链接
 * @param isOversea 是否是海外用户
 */
export async function dy2b(path, url, isOversea) {
    return new Promise((resolve, reject) => {
        const command = `yt-dlp ${ isOversea ? "" : `--proxy ${ this.myProxy }` } -P ${ path } -o "temp.%(ext)s" --merge-output-format "mp4"  ${ url }`;
        exec(command, (error, stdout) => {
            if (error) {
                console.error(`Error executing command: ${ error }`);
                reject(error);
            } else {
                console.log(`Command output: ${ stdout }`);
                resolve(stdout);
            }
        });
    });
}