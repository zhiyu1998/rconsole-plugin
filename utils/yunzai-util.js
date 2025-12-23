import os from "os";

/**
 * 将只有 text 类型的数组转换为原生的 {Bot.makeForwardMsg}
 * @param e
 * @param textArray {string[]}
 */
export function textArrayToMakeForward(e, textArray) {
    return textArray.map(item => {
        return {
            message: { type: "text", text: item },
            nickname: e.sender.card || e.user_id,
            user_id: e.user_id,
        };
    })
}

/**
 * 发送群组音乐卡片
 * @param e
 * @param platformType 音乐平台
 * @param musicId      音乐id
 */
export async function sendMusicCard(e, platformType, musicId) {
    await e.bot.sendApi('send_group_msg', {
        group_id: e.group_id,
        message: [
            {
                type: 'music',
                data: {
                    type: platformType,
                    id: musicId
                }
            }
        ]
    });
}

/**
 * 发送自定义群组音乐卡片
 * @param e
 * @param musicurl   音乐链接
 * @param musicaudio 音乐音频
 * @param musictitle 音乐标题
 * @param musicimage 音乐封面
 */
export async function sendCustomMusicCard(e, musicurl, musicaudio, musictitle, musicimage) {
    await e.bot.sendApi('send_group_msg', {
        group_id: e.group_id,
        message: [
            {
                type: 'music',
                data: {
                    type: 'custom',
                    url: musicurl,
                    audio: musicaudio,
                    title: musictitle,
                    image: musicimage
                }
            }
        ]
    });
}

/**
 * 获取群文件最新的图片
 * @param e
 * @param count     获取群聊条数
 * @returns {Promise<*|string>}
 */
export async function getLatestImage(e, count = 10) {
    // 获取最新的聊天记录，阈值为5
    const latestChat = await e.bot.sendApi("get_group_msg_history", {
        "group_id": e.group_id,
        "count": count
    });
    const messages = latestChat.data.messages;
    // 找到最新的图片
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages?.[i]?.message;
        if (message?.[0]?.type === "image") {
            return message?.[0].data?.url;
        }
    }
    return "";
}

/**
 * 获取群文件Url地址
 * @param e
 * @param count     获取群聊条数
 */
export async function getGroupFileUrl(e, count = 10) {
    const latestChat = await e.bot.sendApi("get_group_msg_history", {
        "group_id": e.group_id,
        "count": count
    });
    const messages = latestChat.data.messages;
    let file_id = "";
    let originalFileName = "";  // 保存原始消息中的文件名
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages?.[i]?.message;
        // 调试日志：打印每条消息的类型
        logger.debug(`[R插件][群文件检测] 消息${i} 类型: ${message?.[0]?.type}, 完整数据: ${JSON.stringify(message?.[0])}`);
        if (message?.[0]?.type === "file") {
            file_id = message?.[0].data?.file_id;
            originalFileName = message?.[0].data?.file || "";  // 获取原始文件名
            logger.info(`[R插件][群文件检测] 找到文件: file_id=${file_id}, fileName=${originalFileName}`);
            break;
        }
    }
    if (file_id === "") {
        logger.info('[R插件][群文件检测] 未找到群文件，已检查的消息类型: ' +
            messages.map((m, i) => `${i}:${m?.message?.[0]?.type}`).join(', '));
        return "";
    }
    // 获取文件信息
    let latestFileUrl = await e.bot.sendApi("get_group_file_url", {
        "group_id": e.group_id,
        "file_id": file_id
    });
    let cleanPath = decodeURIComponent(latestFileUrl.data.url)
    // 适配 NapCat 和 LLBot
    if (cleanPath.startsWith("https")) {
        // https://njc-download.ftn.qq.com/....
        const urlObj = new URL(cleanPath);
        // 检查URL中是否包含 fname 参数
        if (urlObj.searchParams.has('fname')) {
            const fname = decodeURIComponent(urlObj.searchParams.get('fname'));
            // 尝试从 file_id 提取文件名 (旧版 NapCat 格式: /xxx.歌手-歌名.扩展名)
            const fileIdMatch = file_id.match(/\.(.+)\.(\w+)$/);

            // 情况1: 旧版 NapCat(例如3.6.4) - file_id 包含文件名
            if (fileIdMatch && fileIdMatch[1] && fileIdMatch[2]) {
                const fileNameFromId = fileIdMatch[1];
                const fileFormatFromId = fileIdMatch[2];
                // 拼接 file_id 到 fname 参数
                const fileId = file_id.split('.').slice(1).join('.');
                urlObj.searchParams.set('fname', `${urlObj.searchParams.get('fname')}${fileId}`);
                return {
                    cleanPath: urlObj.toString(),
                    file_id: `.${fileNameFromId}.${fileFormatFromId}`,
                    fileName: fileNameFromId,
                    fileFormat: fileFormatFromId
                };
            }
            // 情况2: LLBot(7.2.0) - fname 已包含完整文件名
            else if (fname && fname.match(/^(.+)\.(\w+)$/)) {
                const fnameMatch = fname.match(/^(.+)\.(\w+)$/);
                const fileName = fnameMatch[1];
                const fileFormat = fnameMatch[2];
                return {
                    cleanPath: urlObj.toString(),
                    file_id: `.${fileName}.${fileFormat}`,
                    fileName: fileName,
                    fileFormat: fileFormat
                };
            }
            // 情况3: 新版 NapCat(4.8.124) - UUID file_id,fname 为空,从原始消息提取
            else if (originalFileName && originalFileName.match(/^(.+)\.(\w+)$/)) {
                const fileMatch = originalFileName.match(/^(.+)\.(\w+)$/);
                const fileName = fileMatch[1];
                const fileFormat = fileMatch[2];
                // 设置 fname 参数为文件名
                urlObj.searchParams.set('fname', originalFileName);
                return {
                    cleanPath: urlObj.toString(),
                    file_id: `.${fileName}.${fileFormat}`,
                    fileName: fileName,
                    fileFormat: fileFormat
                };
            }
        }
        return {
            cleanPath: urlObj.toString(),
            file_id
        };
    } else if (cleanPath.startsWith('file:///')) {
        cleanPath = cleanPath.replace('file:///', '')
    }

    return { cleanPath, file_id };
}

/**
 * 获取群回复
 * @param e
 */
export async function getReplyMsg(e) {
    const msgList = await e.bot.sendApi("get_group_msg_history", {
        "group_id": e.group_id,
        "count": 1
    });
    let msgId = msgList.data.messages[0]?.message[0]?.data.id
    let msg = await e.bot.sendApi("get_msg", {
        "message_id": msgId
    })
    return msg.data
}

/**
 * 获取机器人信息
 * @param e
 * @returns {Promise<*>}
 */
export async function getBotLoginInfo(e) {
    return await e.bot.sendApi("get_login_info");
}

/**
 * 获取运行状态
 * @param e
 * @returns {Promise<*>}
 */
export async function getBotStatus(e) {
    return await e.bot.sendApi("get_status");
}

/**
 * 获取版本信息
 * @param e
 * @returns {Promise<*>}
 */
export async function getBotVersionInfo(e) {
    return await e.bot.sendApi("get_version_info");
}

/**
 * 发送私聊消息
 * @param e
 * @param message
 * @returns {Promise<void>}
 */
export async function sendPrivateMsg(e, message) {
    e.bot.sendApi("send_private_msg", {
        user_id: e.user_id,
        message: message,
    })
}

/**
 * 下载远程图片到本地并创建合并转发消息
 * 解决远程URL图片过多时发送失败的问题，添加随机字节绕过QQ风控
 * @param {object} e - 消息事件对象
 * @param {string[]} imageUrls - 图片URL数组
 * @param {string} downloadPath - 下载临时目录
 * @param {object} options - 可选配置
 * @param {string} options.nickname - 转发消息显示的昵称
 * @param {number} options.userId - 转发消息显示的用户ID
 * @returns {Promise<{forwardMsg: any, tempFiles: string[]}>} 返回合并消息和临时文件路径列表
 */
export async function downloadImagesAndMakeForward(e, imageUrls, downloadPath, options = {}) {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const axios = (await import("axios")).default;

    const nickname = options.nickname || e.sender?.card || e.user_id;
    const userId = options.userId || e.user_id;
    const tempFiles = [];
    const forwardMsgList = [];

    // 确保下载目录存在
    try {
        await fs.access(downloadPath);
    } catch {
        await fs.mkdir(downloadPath, { recursive: true });
    }

    // 并发下载所有图片
    const downloadPromises = imageUrls.map(async (url, index) => {
        try {
            // 获取文件扩展名
            let ext = '.jpg';
            if (url.includes('.png')) ext = '.png';
            else if (url.includes('.webp')) ext = '.webp';
            else if (url.includes('.gif')) ext = '.gif';

            const fileName = `forward_img_${index}${ext}`;
            const filePath = path.default.join(downloadPath, fileName);

            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // 添加随机字节到图片末尾，绕过QQ的图片hash检测（风控）
            const imageBuffer = Buffer.from(response.data);
            const randomBytes = Buffer.from([
                Math.floor(Math.random() * 256),
                Math.floor(Math.random() * 256),
                Math.floor(Math.random() * 256),
                Math.floor(Math.random() * 256),
                Date.now() % 256
            ]);
            const modifiedBuffer = Buffer.concat([imageBuffer, randomBytes]);

            await fs.writeFile(filePath, modifiedBuffer);
            tempFiles.push(filePath);

            return {
                index,
                filePath,
                success: true
            };
        } catch (error) {
            logger.error(`[R插件][图片下载] 下载失败: ${url}, 错误: ${error.message}`);
            return {
                index,
                url,
                success: false
            };
        }
    });

    const results = await Promise.all(downloadPromises);

    // 按原始顺序构建消息列表
    results.sort((a, b) => a.index - b.index);

    for (const result of results) {
        if (result.success) {
            forwardMsgList.push({
                message: segment.image(result.filePath),
                nickname: nickname,
                user_id: userId,
            });
        } else {
            // 下载失败的仍使用远程URL
            forwardMsgList.push({
                message: segment.image(result.url),
                nickname: nickname,
                user_id: userId,
            });
        }
    }

    const forwardMsg = await Bot.makeForwardMsg(forwardMsgList);

    return {
        forwardMsg,
        tempFiles
    };
}

/**
 * 清理临时文件列表
 * @param {string[]} filePaths - 文件路径数组
 */
export async function cleanupTempFiles(filePaths) {
    const { promises: fs } = await import("fs");
    for (const filePath of filePaths) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            // 忽略删除失败的错误
        }
    }
}

/**
 * 分批发送图片合并转发消息
 * 当图片数量超过阈值时自动分批发送，避免一次性发送过多图片导致失败
 * 
 * @param {object} e - 消息事件对象
 * @param {Array} forwardMsgList - 需要发送的消息列表 (格式: [{message, nickname, user_id}, ...])
 * @param {number} batchThreshold - 分批阈值，0表示不限制，默认50
 * @param {object} options - 可选配置
 * @param {boolean} options.useRetry - 是否使用replyWithRetry进行重试，默认true
 * @returns {Promise<{success: boolean, results: Array}>} 发送结果
 */
export async function sendImagesInBatches(e, forwardMsgList, batchThreshold = 50, options = {}) {
    const { replyWithRetry } = await import("./retry.js");
    const { useRetry = true } = options;

    if (!forwardMsgList || forwardMsgList.length === 0) {
        return { success: false, results: [] };
    }

    const results = [];

    // 如果阈值为0或图片数量小于等于阈值，一次性发送
    if (batchThreshold <= 0 || forwardMsgList.length <= batchThreshold) {
        try {
            const forwardMsg = await Bot.makeForwardMsg(forwardMsgList);
            let result;
            if (useRetry) {
                result = await replyWithRetry(e, Bot, forwardMsg);
            } else {
                result = await e.reply(forwardMsg);
            }
            results.push(result);
            return {
                success: result && result.message_id,
                results
            };
        } catch (error) {
            logger.error(`[R插件][分批发送] 发送失败: ${error.message}`);
            return { success: false, results };
        }
    }

    // 超过阈值，分批发送
    let allSuccess = true;
    const totalBatches = Math.ceil(forwardMsgList.length / batchThreshold);

    logger.info(`[R插件][分批发送] 图片数量${forwardMsgList.length}张，分${totalBatches}批发送，每批最多${batchThreshold}张`);

    for (let i = 0; i < forwardMsgList.length; i += batchThreshold) {
        const batch = forwardMsgList.slice(i, i + batchThreshold);
        const batchNum = Math.floor(i / batchThreshold) + 1;

        try {
            const forwardMsg = await Bot.makeForwardMsg(batch);
            let result;
            if (useRetry) {
                result = await replyWithRetry(e, Bot, forwardMsg);
            } else {
                result = await e.reply(forwardMsg);
            }
            results.push(result);

            if (!result || !result.message_id) {
                allSuccess = false;
                logger.warn(`[R插件][分批发送] 第${batchNum}/${totalBatches}批发送失败`);
            }
        } catch (error) {
            allSuccess = false;
            logger.error(`[R插件][分批发送] 第${batchNum}/${totalBatches}批发送出错: ${error.message}`);
            results.push(null);
        }
    }

    logger.info(`[R插件][分批发送] 完成，成功${results.filter(r => r && r.message_id).length}/${totalBatches}批`);

    return { success: allSuccess, results };
}
