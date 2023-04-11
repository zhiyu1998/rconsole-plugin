import fs from "node:fs";
import path from "path";

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

/**
 * 删除文件夹下所有文件
 * @returns {Promise<number>}
 * @param folderPath
 */
async function deleteFolderRecursive(folderPath) {
    try {
        const files = await fs.promises.readdir(folderPath);
        const filePromises = files.map(async (file) => {
            const curPath = path.join(folderPath, file);
            const stat = await fs.promises.lstat(curPath);

            if (stat.isDirectory()) {
                // recurse
                await deleteFolderRecursive(curPath);
            } else {
                // delete file
                await fs.promises.unlink(curPath);
            }
        });

        await Promise.all(filePromises);
        await fs.promises.rmdir(folderPath);
        return files.length;
    } catch (error) {
        logger.error(error);
        return 0;
    }
}

export { checkAndRemoveFile, mkdirIfNotExists, deleteFolderRecursive }