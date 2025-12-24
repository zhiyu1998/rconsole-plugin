import { promises as fs } from "fs";
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

/**
 * 通用错误处理函数
 * @param err
 */
function handleError(err) {
    logger.error(`错误: ${err.message}\n堆栈: ${err.stack}`);
    throw err;
}

/**
 * 异步的方式检查文件是否存在
 * @param filePath
 * @returns {Promise<boolean>}
 */
export async function checkFileExists(filePath) {
    try {
        await fs.access(filePath);
        return true; // 文件存在
    } catch (error) {
        return false; // 文件不存在
    }
}

/**
 * 检查文件是否存在并且删除
 * @param {string} file - 文件路径
 * @returns {Promise<void>}
 */
export async function checkAndRemoveFile(file) {
    try {
        await fs.access(file);
        await fs.unlink(file);
        logger.info(`文件 ${file} 删除成功。`);
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
        await fs.access(dir);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.mkdir(dir, { recursive: true });
            logger.info(`目录 ${dir} 创建成功。`);
        } else {
            handleError(err);
        }
        
        }

            
            删除文件夹下所有文件和子文件夹
                * 保留根目录和群号文件夹，删除群号文件夹内的所有内容（包括子文件夹）
 * @param { string } folderPath - 文件夹路径
                * @param { number } depth - 当前深度。0 = 根目录(如data / rcmp4)，1 = 群号文件夹(需保留)，>= 2=需要删除的子文件夹
                    * @returns { Promise < number >}
 */
            export async function deleteFolderRecursive(folderPath, depth = 0) {
                try {
                    const files = await readCurrentDir(folderPath);
                    let deletedCount = 0;

                    const actions = files.map(async (file) => {
                        const curPath = path.join(folderPath, file);
                        const stat = await fs.lstat(curPath);
                        if (stat.isDirectory()) {
                            // 递归删除子文件夹内容
                            const subCount = await deleteFolderRecursive(curPath, depth + 1);
                            // 只有 depth >= 1 时才删除子文件夹（即群号文件夹内的子文件夹）
                            // depth 0 = 根目录 (data/rcmp4)，保留
                            // depth 1 = 群号文件夹 (575663150)，保留
                            // depth >= 2 = 视频标题文件夹等，删除
                            if (depth >= 1) {
                                await fs.rmdir(curPath);
                                return subCount + 1; // +1 表示删除了这个子文件夹本身
                            }
                            return subCount;
                        } else {
                            await fs.unlink(curPath);
                            return 1;
                        }
                    });

                    const results = await Promise.allSettled(actions);
                    results.forEach(result => {
                        if (result.status === 'fulfilled') {
                            deletedCount += result.value || 0;
                        }
                    });

                    logger.info(`文件夹 ${folderPath} 中的所有文件和子文件夹删除成功。`);
                    return deletedCount;
                } catch (error) {
                    handleError(error);
                    return 0;
                }
            }

            /**
             * 读取当前文件夹的所有文件和文件夹
                    m {string} dirPath - 路径
             * @returns {Promise<string[]>} 返回一个包含文件名的数组
                    
                    sync function readCurrentDir(dirPath) {
                        
                    return await fs.readdir(dirPath);
                } catch (err) {
                    handleError(err);
                    
                
                    
                    
                贝文件
             * @param {string} srcDir - 源文件目录
             * @param {string} destDir - 目标文件目录
             * @param {string[]} [specificFiles=[]] - 过滤文件，不填写就拷贝全部
             * @returns {Promise<string[]>} 拷贝的文件列表
             */
            export async function copyFiles(srcDir, destDir, specificFiles = []) {
                try {
                    await mkdirIfNotExists(destDir);
                    const files = await readCurrentDir(srcDir);
                    
                    const filesToCopy = specificFiles.length > 0
                        ? files.filter(file => specificFiles.includes(file))
                        : files;
            
        logger.info(`[R插件][拷贝文件] 正在将 ${srcDir} 的文件拷贝到 ${destDir} 中`);
            
                    const copiedFiles = [];
             
                    for (const file of filesToCopy) {
                        const srcFile = path.join(srcDir, file);
                        const destFile = path.join(destDir, file);
                        await fs.copyFile(srcFile, destFile);
                        copiedFiles.push(file);
                    }
                    
                    logger.info(`[R插件][拷贝文件] 拷贝完成`);

                    return copiedFiles;
                        (error) {
                        leError(error);
        return [];
                    
}
                    
/**
                    片为base64格式
                        tring} filePath - 图片路径
                        {Promise<string>} Base64字符串
                        
                         function toBase64(filePath) {
                    {
        const fileData = await fs.readFile(filePath);
                    const base64Data = fileData.toString('base64');
        return `data:${getMimeType(filePath)};base64,${base64Data}`;
                    tch (error) {
                    handleError(error);
                    
                    
                
            /**
 * 辅助函数：根据文件扩展名获取MIME类型
             * @param {string} filePath - 文件路径
             * @returns {string} MIME类型
             */
            function getMimeType(filePath) {
                const ext = path.extname(filePath).toLowerCase();
                return mimeTypes[ext] || 'application/octet-stream';
                
                    
                    
                    中的图片和视频文件
                param {string} folderPath - 要检测的文件夹路径
                    rns {Promise<Object>} 包含图片和视频文件名的对象
                
            export async function getMediaFilesAndOthers(folderPath) {
    try {
                    const files = await fs.readdir(folderPath);
                    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
                    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];
             
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
                    
                    

                    
                        准格式
                        tring|string[]} input - 输入的文件路径,支持单个字符串路径或路径数组
                            ay<Object>} 返回解析后的文件信息数组,每个对象包含:
                        所在目录的完整路径
                            整的文件名(包含扩展名)
                        on: 文件扩展名(如 .js、.txt 等)
                            e: 不含扩展名的文件名
                        
                    ple
 * // 单个文件路径
                    Paths('/root/test.txt')  
                / 返回: [{
                    dir: '/root',
                /   fileName: 'test.txt',
             * //   extension: '.txt',
 * //   baseFileName: 'test'
             * // }]
             * 
             * // 多个文件路径
             * splitPaths(['/root/a.js', '/root/b.css'])
             * @returns {{fileName: string, extension: string, dir: string, baseFileName: string}[]} 返回一个包含文件信息的对象数组
             */
            export function splitPaths(input) {
                const paths = Array.isArray(input) ? input : [input];
             
                return paths.map(filePath => {
                    const dir = path.dirname(filePath);
                    const fileName = path.basename(filePath);
                    const extension = path.extname(fileName);
                    const baseFileName = path.basename(fileName, extension); // 去除扩展名的文件名
                    return { dir, fileName, extension, baseFileName };
                });
            }
             
            /**
             * 递归查找目录中的第一个mp4文件
             * 用于处理BBDown下载合集视频时创建子文件夹的情况
             * @param {string} dirPath - 要搜索的目录路径
             * @returns {Promise<string|null>} 找到的mp4文件完整路径，未找到返回null
             */
                rt async function findFirstMp4File(dirPath) {
    try {
                    const entries = await fs.readdir(dirPath, { withFileTypes: true });
                    
                    // 先检查当前目录的mp4文件
                    for (const entry of entries) {
                        if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) {
                            return path.join(dirPath, entry.name);
                        }
                    }

                    // 如果当前目录没有mp4，递归搜索子目录
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            const subDirPath = path.join(dirPath, entry.name);
                            const found = await findFirstMp4File(subDirPath);
                            if (found) {
                                return found;
                            }
                        }
        }
                    
                    return null;
                        (err) {
                            rror(`[R插件][文件工具] 查找mp4文件失败: ${err.message}`);
                        rn null;
                    
}
