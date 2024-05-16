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

/**
 * 转换路径图片为base64格式
 * @param filePath  图片路径
 * @return {Promise<string>}
 */
export async function toBase64(filePath) {
    try {
        // 读取文件数据
        const fileData = await fs.readFileSync(filePath);
        // 将文件数据转换为Base64字符串
        const base64Data = fileData.toString('base64');
        // 返回Base64字符串
        return `data:${getMimeType(filePath)};base64,${base64Data}`;
    } catch (error) {
        throw new Error(`读取文件时出错: ${error.message}`);
    }
}

/**
 * 辅助函数：根据文件扩展名获取MIME类型
 * @param filePath
 * @return {*|string}
 */
function getMimeType(filePath) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        // 添加其他文件类型和MIME类型的映射
    };

    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}
