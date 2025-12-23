import path from 'path';
import { exec } from 'child_process';
import fs from "fs";

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
                reject(`[R插件][ffmpeg工具]执行FFmpeg命令时出错: ${stderr}`);
            } else {
                logger.info(`[R插件][ffmpeg工具]关键帧成功提取到 ${outputFolderPath}`);
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
export function convertFlvToMp4(inputFilePath, outputFilePath) {
    return new Promise((resolve, reject) => {
        const resolvedInputPath = path.resolve(inputFilePath);
        const resolvedOutputPath = path.resolve(outputFilePath);

        // 检查文件是否存在
        fs.access(resolvedInputPath, fs.constants.F_OK, (err) => {
            if (err) {
                reject(`[R插件][ffmpeg工具]输入文件不存在: ${resolvedInputPath}`);
                return;
            }

            const command = `ffmpeg -y -i "${resolvedInputPath}" "${resolvedOutputPath}"`;
            logger.info(`[R插件][ffmpeg工具]执行命令：${command}`);

            // 执行 ffmpeg 转换
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(`[R插件][ffmpeg工具]执行 ffmpeg 命令时出错: ${error.message}`);
                    return;
                }
                resolve(resolvedOutputPath);
            });
        });
    });
}

/**
 * 将视频与音频合并（视频循环3次 + 音频混合）
 * 用于抖音动图，使动图视频带有BGM声音
 * @param {string} videoPath - 输入视频路径
 * @param {string} audioPath - 输入音频路径
 * @param {string} outputPath - 输出视频路径
 * @returns {Promise<string>} - 成功返回输出路径，失败返回错误
 */
export function mergeVideoWithAudio(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        const resolvedVideoPath = path.resolve(videoPath);
        const resolvedAudioPath = path.resolve(audioPath);
        const resolvedOutputPath = path.resolve(outputPath);

        // 检查视频文件是否存在
        fs.access(resolvedVideoPath, fs.constants.F_OK, (err) => {
            if (err) {
                reject(`[R插件][ffmpeg工具]视频文件不存在: ${resolvedVideoPath}`);
                return;
            }

            // 检查音频文件是否存在
            fs.access(resolvedAudioPath, fs.constants.F_OK, (audioErr) => {
                if (audioErr) {
                    reject(`[R插件][ffmpeg工具]音频文件不存在: ${resolvedAudioPath}`);
                    return;
                }

                // FFmpeg命令：视频循环3次，混合音频
                // -stream_loop 2 表示循环2次（加上原始为3次）
                // amix 混合两个音频流
                const command = `ffmpeg -y -stream_loop 2 -i "${resolvedVideoPath}" -i "${resolvedAudioPath}" -filter_complex "[0:v]setpts=N/FRAME_RATE/TB[v];[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=3[aout]" -map "[v]" -map "[aout]" -c:v libx264 -c:a aac -b:a 192k -shortest "${resolvedOutputPath}"`;

                logger.info(`[R插件][ffmpeg工具]执行视频音频合并命令`);

                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        // 如果视频没有音频流，尝试简单合并
                        const simpleCommand = `ffmpeg -y -stream_loop 2 -i "${resolvedVideoPath}" -i "${resolvedAudioPath}" -c:v libx264 -c:a aac -b:a 192k -shortest "${resolvedOutputPath}"`;
                        logger.info(`[R插件][ffmpeg工具]尝试简单合并模式`);

                        exec(simpleCommand, (simpleError, simpleStdout, simpleStderr) => {
                            if (simpleError) {
                                reject(`[R插件][ffmpeg工具]视频音频合并失败: ${simpleError.message}`);
                                return;
                            }
                            resolve(resolvedOutputPath);
                        });
                        return;
                    }
                    resolve(resolvedOutputPath);
                });
            });
        });
    });
}
