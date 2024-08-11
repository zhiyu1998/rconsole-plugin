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