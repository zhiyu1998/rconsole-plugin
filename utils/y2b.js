/**
 * y2b 音频信息
 * @param id
 * @param format
 * @param rate
 * @param info
 * @param size
 * @returns {{size: (string|*), rate: (string|*), format, id, info}}
 */
export function getAudio(id, format, rate, info, size) {
    return { id, format, rate: rate == 0 ? '未知' : rate, info, size: size == 0 ? '未知' : size };
}

/**
 * y2b 视频信息
 * @param id
 * @param format
 * @param scale
 * @param frame
 * @param rate
 * @param info
 * @param size
 * @returns {{size: (string|*), rate: (string|*), format, scale, id, frame, info}}
 */
export function getVideo(id, format, scale, frame, rate, info, size) {
    return { id, format, scale, frame, rate: rate == 0 ? '未知' : rate, info, size: size == 0 ? '未知' : size };
}