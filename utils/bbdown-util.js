import { exec } from 'child_process';

/**
 * 使用BBDown下载
 * @param videoUrl      视频链接
 * @param downloadDir   下载目录
 * @param BBDownOptions  BBDown选项（目前仅支持session登录、使用Aria2下载、CDN）
 */
export function startBBDown(videoUrl, downloadDir, BBDownOptions) {
    const { biliSessData, biliUseAria2, biliCDN } = BBDownOptions;

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
        // 说明：-F 自定义名称，-c 自定义Cookie， --work-dir 设置下载目录，-M 多p下载的时候命名
        const command = `BBDown ${videoUrl} --work-dir ${downloadDir} ${biliSessData ? '-c SESSDATA=' + biliSessData : ''} ${pageParam ? '-p ' + pageParam + ' -M \"temp\"' : '-p 1' + ' -M \"temp\"'} -F temp --skip-subtitle --skip-cover ${biliUseAria2 ? '--use-aria2c' : ''} ${biliCDN ? '--upos-host ' + biliCDN : ''}`;
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