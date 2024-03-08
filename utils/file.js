import fs from "node:fs";
import path from "path";

/**
 * 检查文件是否存在并且删除
 * @param file
 * @returns {Promise<void>}
 */
export async function checkAndRemoveFile(file) {
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
export async function mkdirIfNotExists(dir) {
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
export async function deleteFolderRecursive(folderPath) {
    try {
        const files = await readCurrentDir(folderPath);
        const actions = files.map(async (file) => {
            const curPath = path.join(folderPath, file);

            const stat = await fs.promises.lstat(curPath);
            if (stat.isDirectory()) {
                // recurse
                return deleteFolderRecursive(curPath);
            } else {
                // delete file
                return fs.promises.unlink(curPath);
            }
        });

        await Promise.allSettled(actions);
        return files.length;
    } catch (error) {
        logger.error(error);
        return 0;
    }
}

/**
 * 读取当前文件夹的所有文件和文件夹
 * @param path      路径
 * @param printTree 是否打印树状图
 * @returns {Promise<*>} 返回一个包含文件名的数组
 */
export async function readCurrentDir(path) {
    try {
        const files = await fs.promises.readdir(path);
        return files;
    } catch (err) {
        logger.error(err);
    }
}

/**
 * 拷贝文件
 * @param srcDir
 * @param destDir
 * @returns {Promise<*|null>}
 */
export async function copyFiles(srcDir, destDir) {
    try {
        await mkdirIfNotExists(destDir);

        const files = await readCurrentDir(srcDir);

        for (const file of files) {
            const srcFile = path.join(srcDir, file);
            const destFile = path.join(destDir, file);
            await fs.promises.copyFile(srcFile, destFile);
        }
    } catch (error) {
        logger.error(error);
    }
    return null;
}
