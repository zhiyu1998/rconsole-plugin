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
        group_id: e.group.group_id,
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
    let path = decodeURIComponent(latestFileUrl.data.url)
    const cleanPath = path.startsWith('file:///') ? path.replace('file:///', '') : path;
    return cleanPath
}