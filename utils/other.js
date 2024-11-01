export function formatTime(timestamp) {
    const totalSeconds = Math.floor(timestamp / 1000);  // 转换为秒
    const minutes = Math.floor(totalSeconds / 60);      // 分钟
    const seconds = totalSeconds % 60;                  // 秒钟

    // 补零格式化
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
}