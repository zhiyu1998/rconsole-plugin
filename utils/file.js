import fs from "node:fs";
import path from "path";

// 常量提取
const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    // 添加其他文件类型和MIME类型的映射
};

// 通用错误处理函数
function handleError(err) {
    logger.error(err);
    throw err;
}

/**
 * 检查文件是否存在并且删除
 * @param {string} file - 文件路径
 * @returns {Promise<void>}
 */
export async function checkAndRemoveFile(file) {
    try {
        await fs.promises.access(file);
        await fs.promises.unlink(file);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            handleError(err);
        }
    }
}

/**
 * 创建文件夹，如果不存在
 * @param {string} dir - 文件夹路径
 * @returns {Promise<void>}
 */
export async function mkdirIfNotExists(dir) {
    try {
        await fs.promises.access(dir);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.promises.mkdir(dir, { recursive: true });
        } else {
            handleError(err);
        }
    }
}

/**
 * 删除文件夹下所有文件
 * @param {string} folderPath - 文件夹路径
 * @returns {Promise<number>}
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
        handleError(error);
        return 0;
    }
}

/**
 * 读取当前文件夹的所有文件和文件夹
 * @param {string} dirPath - 路径
 * @returns {Promise<string[]>} 返回一个包含文件名的数组
 */
export async function readCurrentDir(dirPath) {
    try {
        return await fs.promises.readdir(dirPath);
    } catch (err) {
        handleError(err);
    }
}

/**
 * 拷贝文件
 * @param {string} srcDir - 源文件目录
 * @param {string} destDir - 目标文件目录
 * @param {string[]} [specificFiles=[]] - 过滤文件，不填写就拷贝全部
 * @returns {Promise<string[]>} 拷贝的文件列表
 */
export async function copyFiles(srcDir, destDir, specificFiles = []) {
    try {
        await mkdirIfNotExists(destDir);
        const files = await readCurrentDir(srcDir);

        // 如果 specificFiles 数组为空，拷贝全部文件；否则只拷贝指定文件
        const filesToCopy = specificFiles.length > 0
            ? files.filter(file => specificFiles.includes(file))
            : files;

        logger.info(logger.yellow(`[R插件][拷贝文件] 正在将 ${srcDir} 的文件拷贝到 ${destDir} 中`));

        // 用于保存拷贝了哪些文件
        const copiedFiles = [];

        for (const file of filesToCopy) {
            const srcFile = path.join(srcDir, file);
            const destFile = path.join(destDir, file);
            await fs.promises.copyFile(srcFile, destFile);
            copiedFiles.push(file);
        }

        logger.info(logger.yellow(`[R插件][拷贝文件] 拷贝完成`));

        return copiedFiles
    } catch (error) {
        handleError(error);
        return [];
    }
}

/**
 * 转换路径图片为base64格式
 * @param {string} filePath - 图片路径
 * @returns {Promise<string>} Base64字符串
 */
export async function toBase64(filePath) {
    try {
        const fileData = await fs.promises.readFile(filePath);
        const base64Data = fileData.toString('base64');
        // 返回Base64字符串
        return `data:${getMimeType(filePath)};base64,${base64Data}`;
    } catch (error) {
        handleError(error);
    }
}

/**
 * 辅助函数：根据文件扩展名获取MIME类型
 * @param {string} filePath - 文件路径
 * @returns {string} MIME类型
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 获取文件夹中的图片和视频文件
 * @param {string} folderPath - 要检测的文件夹路径
 * @returns {Promise<Object>} 包含图片和视频文件名的对象
 */
export async function getMediaFilesAndOthers(folderPath) {
    try {
        const files = await fs.promises.readdir(folderPath);
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];

        // 初始化存储图片和视频的数组
        const images = [];
        const videos = [];
        const others = [];

        files.forEach(file => {
            const ext = path.extname(file).toLowerCase();
            if (imageExtensions.includes(ext)) {
                images.push(file);
            } else if (videoExtensions.includes(ext)) {
                videos.push(file);
            } else {
                others.push(file);
            }
        });

        return { images, videos, others };
    } catch (err) {
        handleError(err);
    }
}