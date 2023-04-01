import fs from "node:fs";

/**
 * 检查文件是否存在并且删除
 * @param file
 * @returns {Promise<void>}
 */
async function checkAndRemoveFile(file) {
    try {
        await fs.promises.access(file);
        await fs.promises.unlink(file);
        logger.mark('视频已存在');
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }
}

/**
 * 创建文件夹，如果不存在
 * @param dir
 * @returns {Promise<void>}
 */
async function mkdirIfNotExists(dir) {
    try {
        await fs.promises.access(dir);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.promises.mkdir(dir, { recursive: true });
        } else {
            throw err;
        }
    }
}

export { checkAndRemoveFile, mkdirIfNotExists }