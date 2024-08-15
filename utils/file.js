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
 * @param srcDir            源文件目录
 * @param destDir           目标文件目录
 * @param specificFiles     过滤文件，不填写就拷贝全部
 * @returns {Promise<*|null>}
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
        logger.error(error);
        return [];
    }
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

/**
 * 获取文件夹中的图片和视频文件
 * @param {string} folderPath - 要检测的文件夹路径
 * @returns {Promise<Object>} 包含图片和视频文件名的对象
 */
export async function getMediaFilesAndOthers(folderPath) {
    return new Promise((resolve, reject) => {
        // 定义图片和视频的扩展名
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];

        // 初始化存储图片和视频的数组
        const images = [];
        const videos = [];
        const others = [];

        // 读取文件夹中的所有文件
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                return reject('无法读取文件夹: ' + err);
            }

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

            // 返回包含图片和视频的对象
            resolve({ images, videos, others });
        });
    });
}