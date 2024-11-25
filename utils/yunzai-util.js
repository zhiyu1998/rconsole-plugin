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
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages?.[i]?.message;
        if (message?.[0]?.type === "file") {
            file_id = message?.[0].data?.file_id;
            break;
        }
    }
    if (file_id === "") {
        logger.info('未找到群文件')
        return "";
    }
    // 获取文件信息
    let latestFileUrl = await e.bot.sendApi("get_group_file_url", {
        "group_id": e.group_id,
        "file_id": file_id
    });
    let cleanPath = decodeURIComponent(latestFileUrl.data.url)
    // 适配 低版本 Napcat 例如：3.6.4
    if (cleanPath.startsWith("https")) {
        // https://njc-download.ftn.qq.com/....
        const urlObj = new URL(cleanPath);
        // 检查URL中是否包含 fname 参数
        if (urlObj.searchParams.has('fname')) {
            // 获取 fname 参数的值
            const originalFname = urlObj.searchParams.get('fname');

            // 提取 file_id（第一个"."后面的内容）
            const fileId = file_id.split('.').slice(1).join('.'); // 分割并去掉第一个部分
            urlObj.searchParams.set('fname', `${originalFname}${fileId}`);
            return {
                cleanPath: urlObj.toString(),
                file_id
            };
        }
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
    let msg = await e.bot.sendApi("get_msg",{
        "message_id" : msgId
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
