/**
 * 用于YouTube的格式化
 * @param seconds
 * @returns {string}
 */
export function ytbFormatTime(seconds) {
    // 计算小时、分钟和秒
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    // 将小时、分钟和秒格式化为两位数
    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(secs).padStart(2, '0');
    // 构造时间范围字符串
    return `00:00:00-${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

/**
 * 移除链接中的不需要的参数
 * @param url
 * @returns {*}
 */
export function removeParams(url) {
    return url
        .replace(/&list=[^&]*/g, '')
        .replace(/&start_radio=[^&]*/g, '')
        .replace(/&index=[^&]*/g, '')
        .replace(/&si=[^&]*/g, '');
}

export function convertToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
        const [minutes, seconds] = parts;
        return minutes * 60 + seconds;
    } else if (parts.length === 3) {
        const [hours, minutes, seconds] = parts;
        return hours * 3600 + minutes * 60 + seconds;
    }
    return timeStr;
}

export async function autoSelectMusicOrVideoSend() {

}
