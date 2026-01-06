import fs from 'fs/promises';
import axios from 'axios'
import path from 'path';
import { fileURLToPath } from 'url';

// 媒体处理计数器（图片+视频）
let processedMediaCount = 0;
// 记录下载的临时文件，用于清理
let downloadedTempFiles = [];

/**
 * 通用的reply包装函数，自动retry失败的图片发送
 * 
 * @param {Object} e - 事件对象
 * @param {Object} Bot - Bot对象
 * @param {any} message - 要发送的消息（任何格式）
 * @param  {...any} args - e.reply的其他参数
 * @returns {Promise} - 发送结果
 */
export async function replyWithRetry(e, Bot, message, ...args) {
    // 先尝试正常发送
    const result = await e.reply(message, ...args);

    // 如果成功，直接返回
    if (result && result.message_id) {
        return result;
    }

    console.warn('[R插件][Retry] 消息发送失败，尝试处理媒体后重试');

    // 重置计数器和临时文件列表
    processedMediaCount = 0;
    downloadedTempFiles = [];

    // 获取群ID用于指定存储目录
    const groupId = e.group_id || e.user_id || 'default';

    try {
        // 发送失败，检测并处理媒体
        const modifiedMessage = await processMedia(message, Bot, groupId);

        // 如果没有处理任何媒体，直接返回失败
        if (!modifiedMessage) {
            console.error('[R插件][Retry] 未检测到可处理的媒体');
            return result;
        }

        // 输出汇总日志
        if (processedMediaCount > 0) {
            console.log(`[R插件][Retry] 重发处理了 ${processedMediaCount} 个媒体文件`);
        }

        // 用修改后的消息重新发送
        const retryResult = await e.reply(modifiedMessage, ...args);

        // 无论成功失败，都清理临时文件
        await cleanupTempFiles();

        return retryResult;
    } catch (error) {
        console.error('[R插件][Retry] 重试过程出错:', error.message);
        // 出错时也要清理临时文件
        await cleanupTempFiles();
        return result;
    }
}

/**
 * 清理下载的临时文件
 */
async function cleanupTempFiles() {
    if (downloadedTempFiles.length === 0) return;

    let cleanedCount = 0;
    for (const filePath of downloadedTempFiles) {
        try {
            await fs.unlink(filePath);
            cleanedCount++;
        } catch (error) {
            // 文件可能已被删除或不存在，忽略错误
        }
    }

    if (cleanedCount > 0) {
        console.log(`[R插件][Retry] 已清理 ${cleanedCount} 个临时文件`);
    }

    // 重置列表
    downloadedTempFiles = [];
}

/**
 * 处理消息中的媒体（下载远程URL或修改本地文件）
 */
async function processMedia(message, Bot, groupId) {
    // 如果是makeForwardMsg的结果 (type: 'node')
    if (message?.type === 'node') {
        const modifiedData = await Promise.all(message.data.map(async (item) => {
            // 格式1: item有message属性直接包含segment (实际常见格式)
            if (item.message) {
                const modifiedMsg = await processSingleSegment(item.message, groupId);
                return { ...item, message: modifiedMsg };
            }
            // 格式2: item是node节点，有data.content数组 (嵌套格式)
            else if (item.type === 'node' && item.data?.content) {
                const modifiedContent = await processMessageArray(item.data.content, groupId);
                return {
                    ...item,
                    data: {
                        ...item.data,
                        content: modifiedContent
                    }
                };
            }
            return item;
        }));
        return { ...message, data: modifiedData };
    }

    // 如果是消息数组
    if (Array.isArray(message)) {
        return await processMessageArray(message, groupId);
    }

    // 单个segment - 图片
    if (message?.type === 'image') {
        return await processSingleImage(message, groupId);
    }

    // 单个segment - 视频
    if (message?.type === 'video') {
        return await processSingleVideo(message, groupId);
    }

    return null;
}

/**
 * 处理单个segment（可能是图片、视频、数组或其他类型）
 */
async function processSingleSegment(segment, groupId) {
    // 处理消息数组格式（如 [segment.image(url), "文本"]）
    if (Array.isArray(segment)) {
        return await processMessageArray(segment, groupId);
    }
    if (segment?.type === 'image') {
        return await processSingleImage(segment, groupId);
    }
    if (segment?.type === 'video') {
        return await processSingleVideo(segment, groupId);
    }
    return segment;
}

/**
 * 处理消息数组中的媒体
 */
async function processMessageArray(messages, groupId) {
    return await Promise.all(messages.map(async (msg) => {
        if (msg?.type === 'image') {
            return await processSingleImage(msg, groupId);
        }
        if (msg?.type === 'video') {
            return await processSingleVideo(msg, groupId);
        }
        return msg;
    }));
}

/**
 * 处理单个图片segment
 */
async function processSingleImage(imageSegment, groupId) {
    const file = imageSegment.data?.file || imageSegment.file;

    if (!file) return imageSegment;

    try {
        // 判断文件类型：Buffer、远程URL 或本地文件
        if (Buffer.isBuffer(file)) {
            // Buffer类型：直接添加随机字节并保存
            return await processBufferImage(file, imageSegment, groupId);
        } else if (typeof file === 'string' && (file.startsWith('http://') || file.startsWith('https://'))) {
            // 远程URL：下载并添加随机字节
            return await downloadAndModify(file, imageSegment, groupId);
        } else if (typeof file === 'string') {
            // 本地文件：直接添加随机字节
            return await modifyLocalFile(file, imageSegment, groupId);
        } else {
            // 其他类型，跳过处理
            console.warn(`[R插件][Retry] 未知的图片file类型: ${typeof file}`);
            return imageSegment;
        }
    } catch (error) {
        console.error(`[R插件][Retry] 处理图片失败: ${error.message}`);
        return imageSegment;
    }
}

/**
 * 处理Buffer类型的图片
 */
async function processBufferImage(imageBuffer, originalSegment, groupId) {
    // 验证图片大小，至少需要1KB才是有效图片
    if (imageBuffer.length < 1024) {
        console.warn(`[R插件][Retry] Buffer图片太小(${imageBuffer.length}字节)，可能无效，跳过处理`);
        return originalSegment;
    }

    // 生成文件名
    const fileName = `buffer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const filePath = path.resolve(`./data/rcmp4/${groupId}/`, fileName);

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // 添加随机字节
    const modifiedBuffer = addRandomBytes(imageBuffer);

    // 保存文件
    await fs.writeFile(filePath, modifiedBuffer);

    // 记录临时文件路径用于后续清理
    downloadedTempFiles.push(filePath);

    processedMediaCount++;

    // 返回修改后的segment
    return {
        ...originalSegment,
        data: { ...originalSegment.data, file: filePath },
        file: filePath
    };
}

/**
 * 下载远程图片并添加随机字节
 */
async function downloadAndModify(url, originalSegment, groupId) {
    const fileName = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    // 使用群ID作为子目录
    const filePath = path.resolve(`./data/rcmp4/${groupId}/`, fileName);

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // 从URL中提取域名作为Referer
    let referer = '';
    try {
        const urlObj = new URL(url);
        referer = `${urlObj.protocol}//${urlObj.host}/`;
    } catch {
        referer = url;
    }

    // 下载图片，添加浏览器请求头避免防盗链
    const response = await axios({
        method: 'get',
        url,
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': referer,
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
    });

    const imageBuffer = Buffer.from(response.data);

    // 验证图片大小，至少需要1KB才是有效图片
    if (imageBuffer.length < 1024) {
        console.warn(`[R插件][Retry] 下载的图片太小(${imageBuffer.length}字节)，可能无效，跳过处理: ${url}`);
        return originalSegment;
    }

    // 添加随机字节
    const modifiedBuffer = addRandomBytes(imageBuffer);

    // 保存文件
    await fs.writeFile(filePath, modifiedBuffer);

    // 记录临时文件路径用于后续清理
    downloadedTempFiles.push(filePath);

    processedMediaCount++;

    // 返回修改后的segment
    return {
        ...originalSegment,
        data: { ...originalSegment.data, file: filePath },
        file: filePath
    };
}

/**
 * 修改本地文件并添加随机字节
 */
async function modifyLocalFile(localPath, originalSegment, groupId) {
    // 正确处理 file:// URL（包含特殊字符如 #）
    if (localPath.startsWith('file://') || localPath.startsWith('file:///')) {
        try {
            localPath = fileURLToPath(localPath);
        } catch {
            // 如果解析失败，尝试简单移除前缀
            localPath = localPath.replace(/^file:\/\/\/?/, '');
        }
    }

    // 读取文件
    const imageBuffer = await fs.readFile(localPath);

    // 验证图片大小，至少需要1KB才是有效图片
    if (imageBuffer.length < 1024) {
        console.warn(`[R插件][Retry] 本地图片太小(${imageBuffer.length}字节)，可能无效，跳过处理: ${localPath}`);
        return originalSegment;
    }

    // 添加随机字节
    const modifiedBuffer = addRandomBytes(imageBuffer);

    // 生成新文件名，保存到群目录
    const ext = path.extname(localPath);
    const basename = path.basename(localPath, ext);
    const newFilePath = path.resolve(`./data/rcmp4/${groupId}/`, `${basename}_retry${ext}`);

    // 确保目录存在
    await fs.mkdir(path.dirname(newFilePath), { recursive: true });

    // 保存新文件
    await fs.writeFile(newFilePath, modifiedBuffer);

    // 记录临时文件路径用于后续清理
    downloadedTempFiles.push(newFilePath);

    processedMediaCount++;

    // 返回修改后的segment
    return {
        ...originalSegment,
        data: { ...originalSegment.data, file: newFilePath },
        file: newFilePath
    };
}

/**
 * 处理单个视频segment
 */
async function processSingleVideo(videoSegment, groupId) {
    const file = videoSegment.data?.file || videoSegment.file;

    if (!file) return videoSegment;

    try {
        // 视频只处理本地文件（因为视频都是先下载到本地的）
        if (Buffer.isBuffer(file)) {
            // Buffer类型视频：直接保存并添加随机字节
            return await processBufferVideo(file, videoSegment, groupId);
        } else if (typeof file === 'string') {
            // 正确处理 file:// URL（包含特殊字符如 #）
            let localPath = file;
            if (localPath.startsWith('file://') || localPath.startsWith('file:///')) {
                try {
                    localPath = fileURLToPath(file);
                } catch {
                    // 如果解析失败，尝试简单移除前缀
                    localPath = file.replace(/^file:\/\/\/?/, '');
                }
            }
            return await modifyLocalVideo(localPath, videoSegment, groupId);
        } else {
            console.warn(`[R插件][Retry] 未知的视频file类型: ${typeof file}`);
            return videoSegment;
        }
    } catch (error) {
        console.error(`[R插件][Retry] 处理视频失败: ${error.message}`);
        return videoSegment;
    }
}

/**
 * 处理Buffer类型的视频
 */
async function processBufferVideo(videoBuffer, originalSegment, groupId) {
    // 生成文件名
    const fileName = `buffer_video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
    const filePath = path.resolve(`./data/rcmp4/${groupId}/`, fileName);

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // 添加随机字节
    const modifiedBuffer = addRandomBytes(videoBuffer);

    // 保存文件
    await fs.writeFile(filePath, modifiedBuffer);

    // 记录临时文件路径用于后续清理
    downloadedTempFiles.push(filePath);

    processedMediaCount++;

    // 返回修改后的segment
    return {
        ...originalSegment,
        type: 'video',
        data: { ...originalSegment.data, file: filePath },
        file: filePath
    };
}

/**
 * 修改本地视频文件并添加随机字节
 */
async function modifyLocalVideo(localPath, originalSegment, groupId) {
    // 读取视频文件
    const videoBuffer = await fs.readFile(localPath);

    // 添加随机字节
    const modifiedBuffer = addRandomBytes(videoBuffer);

    // 生成新文件名，保存到群目录
    const ext = path.extname(localPath);
    const basename = path.basename(localPath, ext);
    const newFilePath = path.resolve(`./data/rcmp4/${groupId}/`, `${basename}_retry${ext}`);

    // 确保目录存在
    await fs.mkdir(path.dirname(newFilePath), { recursive: true });

    // 保存新文件
    await fs.writeFile(newFilePath, modifiedBuffer);

    // 记录临时文件路径用于后续清理
    downloadedTempFiles.push(newFilePath);

    processedMediaCount++;

    // 返回修改后的segment，使用新文件路径
    return {
        ...originalSegment,
        type: 'video',
        data: { ...originalSegment.data, file: newFilePath },
        file: newFilePath
    };
}

/**
 * 添加随机字节到图片
 */
function addRandomBytes(imageBuffer) {
    const randomBytes = Buffer.from([
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        (Date.now() >> 8) % 256,
        Date.now() % 256
    ]);

    return Buffer.concat([imageBuffer, randomBytes]);
}
