import path from 'path';
import { exec } from 'child_process';

// 写一个执行ffmpeg提取视频关键帧的函数，例如：ffmpeg -i input.mp4 -vf "select=eq(pict_type\,I)" -vsync drop -vframes 5 -qscale:v 2 keyframes\keyframe_%03d.jpg
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
