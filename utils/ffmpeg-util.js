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
 * 使用 ffprobe 获取媒体文件的元数据（时长、是否包含音轨等）
 * @param {string} filePath - 文件路径
 * @returns {Promise<{duration: number, hasAudio: boolean}>}
 */
function probeMedia(filePath) {
    return new Promise((resolve) => {
        // 使用 ffprobe 输出 JSON 格式
        const command = `ffprobe -v error -show_entries format=duration -show_streams -of json "${filePath}"`;
        exec(command, (error, stdout) => {
            if (error) {
                // 如果探测失败，返回安全默认值
                resolve({ duration: 0, hasAudio: false });
                return;
            }
            try {
                const data = JSON.parse(stdout);
                const duration = parseFloat(data.format?.duration || 0);
                // 检查 stream 列表中是否含有 type 为 audio 的轨道
                const hasAudio = data.streams?.some(stream => stream.codec_type === 'audio') || false;
                resolve({ duration, hasAudio });
            } catch (e) {
                resolve({ duration: 0, hasAudio: false });
            }
        });
    });
}

/**
 * 将视频与音频合并（视频音频混合）
 * 用于抖音动图，使动图视频带有BGM声音
 * @param {string} videoPath - 输入视频路径
 * @param {string} audioPath - 输入音频路径
 * @param {string} outputPath - 输出视频路径
 * @returns {Promise<string>} - 成功返回输出路径，失败返回错误
 */
export async function mergeVideoWithAudio(videoPath, audioPath, outputPath) {
    const resolvedVideoPath = path.resolve(videoPath);
    const resolvedAudioPath = path.resolve(audioPath);
    const resolvedOutputPath = path.resolve(outputPath);

    // 1. 检查视频文件是否存在
    await new Promise((resolve, reject) => {
        fs.access(resolvedVideoPath, fs.constants.F_OK, (err) => {
            if (err) reject(new Error(`[R插件][ffmpeg工具]视频文件不存在: ${resolvedVideoPath}`));
            else resolve();
        });
    });

    // 2. 检查音频文件是否存在
    await new Promise((resolve, reject) => {
        fs.access(resolvedAudioPath, fs.constants.F_OK, (err) => {
            if (err) reject(new Error(`[R插件][ffmpeg工具]音频文件不存在: ${resolvedAudioPath}`));
            else resolve();
        });
    });

    // 3. 使用 ffprobe 动态获取视频和音频的参数
    const videoMeta = await probeMedia(resolvedVideoPath);
    const audioMeta = await probeMedia(resolvedAudioPath);

    logger.info(`[R插件][ffmpeg工具] 视频时长: ${videoMeta.duration}s, 是否含原声: ${videoMeta.hasAudio} | BGM时长: ${audioMeta.duration}s`);

    // 4. 计算 BGM 需要循环的次数
    let loopCount = 0;
    if (videoMeta.duration > 0 && audioMeta.duration > 0 && videoMeta.duration > audioMeta.duration) {
        // 例如：视频 10s，BGM 3s -> Math.ceil(10/3) - 1 = 3 次。总共播放 4 次（12s > 10s），完全覆盖视频
        loopCount = Math.ceil(videoMeta.duration / audioMeta.duration) - 1;
    }
    logger.info(`[R插件][ffmpeg工具] 计算得出 BGM 循环次数: ${loopCount}`);

    // 5. 根据视频是否含有音轨，动态拼接最佳 FFmpeg 命令
    let command = '';
    if (videoMeta.hasAudio) {
        // 视频本身有原声音轨 -> 使用 amix 混音，且限制为 longest 保证音轨不被缩短
        command = `ffmpeg -y -i "${resolvedVideoPath}" -stream_loop ${loopCount} -i "${resolvedAudioPath}" -filter_complex "[0:v]setpts=N/FRAME_RATE/TB[v];[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=3[aout]" -map "[v]" -map "[aout]" -c:v libx264 -c:a aac -b:a 192k -shortest "${resolvedOutputPath}"`;
    } else {
        // 视频本身无音轨 -> 绕过 amix，直接覆盖音频，避免报错
        command = `ffmpeg -y -i "${resolvedVideoPath}" -stream_loop ${loopCount} -i "${resolvedAudioPath}" -filter_complex "[0:v]setpts=N/FRAME_RATE/TB[v]" -map "[v]" -map 1:a -c:v libx264 -c:a aac -b:a 192k -shortest "${resolvedOutputPath}"`;
    }

    logger.info(`[R插件][ffmpeg工具] 执行视频音频合并命令: ${command}`);

    // 6. 执行最终的合并
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`[R插件][ffmpeg工具]视频音频合并失败: ${error.message}`);
                return;
            }
            resolve(resolvedOutputPath);
        });
    });
}