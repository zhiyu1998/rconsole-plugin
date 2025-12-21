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
 * @param BBDownOptions  BBDown选项（目前仅支持session登录、使用Aria2下载、CDN、编码选择、自定义文件名）
 */
export function startBBDown(videoUrl, downloadDir, BBDownOptions) {
    const { biliSessData, biliUseAria2, biliCDN, biliResolution, videoCodec, customFilename } = BBDownOptions;

    return new Promise((resolve, reject) => {
        // logger.info(videoUrl);
        // 解析URL并提取参数p（页数）
        const urlObj = new URL(videoUrl);
        const params = urlObj.searchParams;
        const newParams = new URLSearchParams();
        const pageParam = params.get('p');
        // 这里提取p参数，防止丢失
        if (params.has('p')) {
            newParams.set('p', pageParam);
        }
        // 这里如果有p参数就放置到url上，没有就相当于作了一次去跟踪参数的清除，也方便BBDown下载
        urlObj.search = newParams.toString();
        videoUrl = urlObj.toString();

        // 构造 -p 和 -M 参数
        let pParam;
        // 如果不是番剧就常规逻辑
        if (!(videoUrl.includes("play\/ep") || videoUrl.includes("play\/ss"))) {
            // 普通视频：带分P参数
            pParam = pageParam ? `-p ${pageParam}` : `-p 1`;
        } else {
            // 番剧：不需要分P参数
            pParam = '';
        }

        // 构造 -q 参数 （画质优先级,用逗号分隔 例: "8K 超高清, 1080P 高码率, HDR 真彩, 杜比视界"）
        const qParam = `-q "${getResolutionLabels(biliResolution)}"`;
        // 构造 -e 参数（编码优先级）
        const eParam = `-e "${getEncodingPriority(videoCodec)}"`;
        // 构造 -F 参数（使用传入的自定义文件名，确保我们知道输出文件的名称）
        const fParam = customFilename ? `-F "${customFilename}"` : `-F "<bvid>"`;

        // 说明：-F 自定义名称，-c 自定义Cookie， --work-dir 设置下载目录
        const command = `BBDown ${videoUrl} ${eParam} ${qParam} --work-dir ${downloadDir} ${biliSessData ? '-c SESSDATA=' + biliSessData : ''} ${pParam} ${fParam} --skip-subtitle --skip-cover ${biliUseAria2 ? '--use-aria2c' : ''} ${biliCDN ? '--upos-host ' + biliCDN : ''}`;
        logger.info(command);
        // logger.info(command);
        // 直接调用BBDown，因为它已经在系统路径中
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`[R插件][BBDown]执行出错: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`[R插件][BBDown]错误信息: ${stderr}`);
                return;
            }
            // logger.mark(`[R插件][BBDown]输出结果: ${stdout}`);
            resolve(stdout);
        });
    });
}

