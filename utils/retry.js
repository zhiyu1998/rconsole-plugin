import fs from 'fs/promises';
import axios from 'axios';
import path from 'path';

// 媒体处理计数器（图片+视频）
let processedMediaCount = 0;

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

    // 重置计数器
    processedMediaCount = 0;

    try {
        // 发送失败，检测并处理媒体
        const modifiedMessage = await processMedia(message, Bot);

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
        return await e.reply(modifiedMessage, ...args);
    } catch (error) {
        console.error('[R插件][Retry] 重试过程出错:', error.message);
        return result;
    }
}

/**
 * 处理消息中的媒体（下载远程URL或修改本地文件）
 */
async function processMedia(message, Bot) {
    // 如果是makeForwardMsg的结果 (type: 'node')
    if (message?.type === 'node') {
        const modifiedData = await Promise.all(message.data.map(async (item) => {
            // 格式1: item有message属性直接包含segment (实际常见格式)
            if (item.message) {
                const modifiedMsg = await processSingleSegment(item.message);
                return { ...item, message: modifiedMsg };
            }
            // 格式2: item是node节点，有data.content数组 (嵌套格式)
            else if (item.type === 'node' && item.data?.content) {
                const modifiedContent = await processMessageArray(item.data.content);
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
        return await processMessageArray(message);
    }

    // 单个segment - 图片
    if (message?.type === 'image') {
        return await processSingleImage(message);
    }

    // 单个segment - 视频
    if (message?.type === 'video') {
        return await processSingleVideo(message);
    }

    return null;
}

/**
 * 处理单个segment（可能是图片、视频、数组或其他类型）
 */
async function processSingleSegment(segment) {
    // 处理消息数组格式（如 [segment.image(url), "文本"]）
    if (Array.isArray(segment)) {
        return await processMessageArray(segment);
    }
    if (segment?.type === 'image') {
        return await processSingleImage(segment);
    }
    if (segment?.type === 'video') {
        return await processSingleVideo(segment);
    }
    return segment;
}

/**
 * 处理消息数组中的媒体
 */
async function processMessageArray(messages) {
    return await Promise.all(messages.map(async (msg) => {
        if (msg?.type === 'image') {
            return await processSingleImage(msg);
        }
        if (msg?.type === 'video') {
            return await processSingleVideo(msg);
        }
        return msg;
    }));
}

/**
 * 处理单个图片segment
 */
async function processSingleImage(imageSegment) {
    const file = imageSegment.data?.file || imageSegment.file;

    if (!file) return imageSegment;

    try {
        // 判断是远程URL还是本地文件
        if (file.startsWith('http://') || file.startsWith('https://')) {
            // 远程URL：下载并添加随机字节
            return await downloadAndModify(file, imageSegment);
        } else {
            // 本地文件：直接添加随机字节
            return await modifyLocalFile(file, imageSegment);
        }
    } catch (error) {
        console.error(`[R插件][Retry] 处理图片失败: ${error.message}`);
        return imageSegment;
    }
}

/**
 * 下载远程图片并添加随机字节
 */
async function downloadAndModify(url, originalSegment) {
    const fileName = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const filePath = path.resolve('./data/rcmp4/', fileName);

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // 下载图片
    const response = await axios({
        method: 'get',
        url,
        responseType: 'arraybuffer',
        timeout: 30000
    });

    const imageBuffer = Buffer.from(response.data);

    // 添加随机字节
    const modifiedBuffer = addRandomBytes(imageBuffer);

    // 保存文件
    await fs.writeFile(filePath, modifiedBuffer);

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
async function modifyLocalFile(localPath, originalSegment) {
    // 读取文件
    const imageBuffer = await fs.readFile(localPath);

    // 添加随机字节
    const modifiedBuffer = addRandomBytes(imageBuffer);

    // 生成新文件名
    const ext = path.extname(localPath);
    const basename = path.basename(localPath, ext);
    const dirname = path.dirname(localPath);
    const newFilePath = path.resolve(dirname, `${basename}_retry${ext}`);

    // 保存新文件
    await fs.writeFile(newFilePath, modifiedBuffer);

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
async function processSingleVideo(videoSegment) {
    const file = videoSegment.data?.file || videoSegment.file;

    if (!file) return videoSegment;

    try {
        // 视频只处理本地文件（因为视频都是先下载到本地的）
        // 移除 file:// 前缀
        let localPath = file;
        if (localPath.startsWith('file://')) {
            localPath = localPath.replace('file://', '');
        }

        return await modifyLocalVideo(localPath, videoSegment);
    } catch (error) {
        console.error(`[R插件][Retry] 处理视频失败: ${error.message}`);
        return videoSegment;
    }
}

/**
 * 修改本地视频文件并添加随机字节
 */
async function modifyLocalVideo(localPath, originalSegment) {
    // 读取视频文件
    const videoBuffer = await fs.readFile(localPath);

    // 添加随机字节
    const modifiedBuffer = addRandomBytes(videoBuffer);

    // 生成新文件名
    const ext = path.extname(localPath);
    const basename = path.basename(localPath, ext);
    const dirname = path.dirname(localPath);
    const newFilePath = path.resolve(dirname, `${basename}_retry${ext}`);

    // 保存新文件
    await fs.writeFile(newFilePath, modifiedBuffer);

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
