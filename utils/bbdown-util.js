import { exec } from 'child_process';
import { getResolutionLabels } from "./bilibili.js";

/**
 * 根据用户选择的编码获取BBDown的编码优先级字符串
 * @param {string} videoCodec 用户选择的编码：auto, av1, hevc, avc
 * @returns {string} BBDown编码优先级字符串
 */
function getEncodingPriority(videoCodec) {
    switch (videoCodec) {
        case 'av1':
            return 'av1,hevc,avc';
        case 'hevc':
            return 'hevc,av1,avc';
        case 'avc':
            return 'avc,hevc,av1';
        default:
            // auto: 默认优先级 av1 > hevc > avc
            return 'av1,hevc,avc';
    }
}

/**
 * 使用BBDown下载
 * @param videoUrl      视频链接
 * @param downloadDir   下载目录
 * @param BBDownOptions  BBDown选项
 */
export function startBBDown(videoUrl, downloadDir, BBDownOptions) {
    const { biliSessData, biliUseAria2, biliCDN, biliResolution, videoCodec, customFilename } = BBDownOptions;

    return new Promise((resolve, reject) => {
        // 解析URL并提取参数p（页数）
        const urlObj = new URL(videoUrl);
        const params = urlObj.searchParams;
        const newParams = new URLSearchParams();
        const pageParam = params.get('p');
        // 这里提取p参数，防止丢失
        if (params.has('p')) {
            newParams.set('p', pageParam);
        }
        // 这里如果有p参数就放置到url上，没有就相当于作了一次去跟踪参数的清除
        urlObj.search = newParams.toString();
        videoUrl = urlObj.toString();

        // 判断是否是番剧
        const isBangumi = videoUrl.includes("play/ep") || videoUrl.includes("play/ss");

        // 构造参数
        let filePatternParam;
        let pParam = '';

        if (isBangumi) {
            // 番剧：使用 -M 设置多P模式的文件名（番剧被视为多P）
            // 使用自定义文件名，不创建子文件夹
            filePatternParam = customFilename ? `-M "${customFilename}"` : `-M "<videoTitle><pageNumber>话"`;
        } else {
            // 普通视频：使用 -F 设置单P文件名，-p 设置分P
            filePatternParam = customFilename ? `-F "${customFilename}"` : `-F "<bvid>"`;
            pParam = pageParam ? `-p ${pageParam}` : `-p 1`;
        }

        // 构造 -q 参数 （画质优先级）
        const qParam = `-q "${getResolutionLabels(biliResolution)}"`;
        // 构造 -e 参数（编码优先级）
        const eParam = `-e "${getEncodingPriority(videoCodec)}"`;

        // 构建命令
        const command = `BBDown ${videoUrl} ${eParam} ${qParam} --work-dir ${downloadDir} ${biliSessData ? '-c SESSDATA=' + biliSessData : ''} ${pParam} ${filePatternParam} --skip-subtitle --skip-cover ${biliUseAria2 ? '--use-aria2c' : ''} ${biliCDN ? '--upos-host ' + biliCDN : ''}`;
        logger.info(`[R插件][BBDown] ${command}`);

        // 直接调用BBDown
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`[R插件][BBDown]执行出错: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`[R插件][BBDown]错误信息: ${stderr}`);
                return;
            }
            resolve(stdout);
        });
    });
}


