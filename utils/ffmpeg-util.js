import path from 'path';
import { exec } from 'child_process';

/**
 * 提取关键帧
 * @param inputFilePath
 * @param outputFolderPath
 * @param frameCount
 * @returns {Promise<unknown>}
 */
export async function extractKeyframes(inputFilePath, outputFolderPath, frameCount = 20) {
    return new Promise((resolve, reject) => {
        // 创建输出文件夹路径
        const outputFilePattern = path.join(outputFolderPath, 'keyframe_%03d.jpg');

        // 构建FFmpeg命令
        const ffmpegCommand = `ffmpeg -i "${inputFilePath}" -vf "select=eq(pict_type\\,I)" -vsync drop -vframes ${frameCount} -qscale:v 2 "${outputFilePattern}"`;

        // 执行FFmpeg命令
        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                reject(`[R插件][ffmpeg工具]执行FFmpeg命令时出错: ${ stderr }`);
            } else {
                logger.info(`[R插件][ffmpeg工具]关键帧成功提取到 ${ outputFolderPath }`);
                resolve(outputFolderPath);
            }
        });
    });
}

/**
 * 使用 ffmpeg 将 FLV 文件转换为 MP4 文件
 * @param {string} inputFilePath - 输入的 FLV 文件路径
 * @param {string} outputFilePath - 输出的 MP4 文件路径
 * @returns {Promise<string>} - 返回一个 Promise，成功时返回输出文件路径，失败时返回错误信息
 */
function convertFlvToMp4(inputFilePath, outputFilePath) {
    return new Promise((resolve, reject) => {
        const command = `ffmpeg -i ${inputFilePath} ${outputFilePath}`;

        logger.info(`[R插件][ffmpeg工具]执行命令：${command}`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`执行 ffmpeg 命令时出错: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`ffmpeg 标准错误输出: ${stderr}`);
                return;
            }
            resolve(outputFilePath);
        });
    });
}
