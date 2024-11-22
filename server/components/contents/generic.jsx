import { useState, useEffect } from 'react';
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';
import Toast from "../toast.jsx";

export default function Generic() {
    const [config, setConfig] = useState({
        defaultPath: './data/rcmp4/',
        videoSizeLimit: 70,
        proxyAddr: '127.0.0.1',
        proxyPort: '7890',
        identifyPrefix: '',
        streamDuration: 10,
        streamCompatibility: false,
        queueConcurrency: 1,
        videoDownloadConcurrency: 1,
        autoclearTrashtime: '0 0 8 * * ?',
        xiaohongshuCookie: '',
        deeplApiUrls: ''
    });

    const [loading, setLoading] = useState(false);

    // 读取配置
    useEffect(() => {
        const loadConfig = async () => {
            const yamlConfig = await readYamlConfig();
            if (yamlConfig) {
                setConfig({
                    defaultPath: yamlConfig.defaultPath || './data/rcmp4/',
                    videoSizeLimit: yamlConfig.videoSizeLimit || 70,
                    proxyAddr: yamlConfig.proxyAddr || '127.0.0.1',
                    proxyPort: yamlConfig.proxyPort || '7890',
                    identifyPrefix: yamlConfig.identifyPrefix || '',
                    streamDuration: yamlConfig.streamDuration || 10,
                    streamCompatibility: yamlConfig.streamCompatibility ?? false,
                    queueConcurrency: yamlConfig.queueConcurrency || 1,
                    videoDownloadConcurrency: yamlConfig.videoDownloadConcurrency || 1,
                    autoclearTrashtime: yamlConfig.autoclearTrashtime || '0 0 8 * * ?',
                    xiaohongshuCookie: yamlConfig.xiaohongshuCookie || '',
                    deeplApiUrls: yamlConfig.deeplApiUrls || ''
                });
            }
        };

        loadConfig();
    }, []);

    // 保存配置
    const handleSave = async () => {
        setLoading(true);
        try {
            const success = await updateYamlConfig({
                defaultPath: config.defaultPath,
                videoSizeLimit: config.videoSizeLimit,
                proxyAddr: config.proxyAddr,
                proxyPort: config.proxyPort,
                identifyPrefix: config.identifyPrefix,
                streamDuration: config.streamDuration,
                streamCompatibility: config.streamCompatibility,
                queueConcurrency: config.queueConcurrency,
                videoDownloadConcurrency: config.videoDownloadConcurrency,
                autoclearTrashtime: config.autoclearTrashtime,
                xiaohongshuCookie: config.xiaohongshuCookie,
                deeplApiUrls: config.deeplApiUrls
            });

            if (success) {
                document.getElementById('generic-toast-success').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('generic-toast-success').classList.add('hidden');
                }, 3000);
            }
        } catch (error) {
            console.error('保存配置失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 重置配置
    const handleReset = async () => {
        const yamlConfig = await readYamlConfig();
        if (yamlConfig) {
            setConfig({
                defaultPath: yamlConfig.defaultPath || './data/rcmp4/',
                videoSizeLimit: yamlConfig.videoSizeLimit || 70,
                proxyAddr: yamlConfig.proxyAddr || '127.0.0.1',
                proxyPort: yamlConfig.proxyPort || '7890',
                identifyPrefix: yamlConfig.identifyPrefix || '',
                streamDuration: yamlConfig.streamDuration || 10,
                streamCompatibility: yamlConfig.streamCompatibility ?? false,
                queueConcurrency: yamlConfig.queueConcurrency || 1,
                videoDownloadConcurrency: yamlConfig.videoDownloadConcurrency || 1,
                autoclearTrashtime: yamlConfig.autoclearTrashtime || '0 0 8 * * ?',
                xiaohongshuCookie: yamlConfig.xiaohongshuCookie || '',
                deeplApiUrls: yamlConfig.deeplApiUrls || '',
            });
        }
    };

    return (
        <div className="p-6 mx-auto container">
            {/* 成功提示 */}
            <Toast id="generic-toast-success" />

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">通用配置</h2>

                {/* 基础配置部分 */}
                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* 路径和大小限制配置 */ }
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">视频保存路径</span>
                                </label>
                                <input
                                    type="text"
                                    value={ config.defaultPath }
                                    onChange={ (e) => setConfig({ ...config, defaultPath: e.target.value }) }
                                    placeholder="请输入视频保存路径..."
                                    className="input input-bordered"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">视频大小限制（MB）</span>
                                    <span className="label-text-alt text-xs">超过限制转为群文件</span>
                                </label>
                                <input
                                    type="number"
                                    value={ config.videoSizeLimit }
                                    onChange={ (e) => setConfig({
                                        ...config,
                                        videoSizeLimit: parseInt(e.target.value)
                                    }) }
                                    className="input input-bordered"
                                />
                            </div>
                        </div>

                        {/* 代理配置 */ }
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">代理地址</span>
                                </label>
                                <input
                                    type="text"
                                    value={ config.proxyAddr }
                                    onChange={ (e) => setConfig({ ...config, proxyAddr: e.target.value }) }
                                    placeholder="请输入代理地址..."
                                    className="input input-bordered"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">代理端口</span>
                                </label>
                                <input
                                    type="text"
                                    value={ config.proxyPort }
                                    onChange={ (e) => setConfig({ ...config, proxyPort: e.target.value }) }
                                    placeholder="请输入代理端口..."
                                    className="input input-bordered"
                                />
                            </div>
                        </div>

                        {/* 其他基础配置 */ }
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">识别前缀</span>
                                </label>
                                <input
                                    type="text"
                                    value={ config.identifyPrefix }
                                    onChange={ (e) => setConfig({ ...config, identifyPrefix: e.target.value }) }
                                    placeholder="请输入识别前缀..."
                                    className="input input-bordered"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">视频最大时长（秒）</span>
                                </label>
                                <input
                                    type="number"
                                    value={ config.streamDuration }
                                    onChange={ (e) => setConfig({
                                        ...config,
                                        streamDuration: parseInt(e.target.value)
                                    }) }
                                    className="input input-bordered"
                                />
                            </div>
                        </div>

                        {/* 并发和定时配置 */ }
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">队列并发数</span>
                                    <span className="label-text-alt text-xs">仅影响B站下载</span>
                                </label>
                                <input
                                    type="number"
                                    value={ config.queueConcurrency }
                                    onChange={ (e) => setConfig({
                                        ...config,
                                        queueConcurrency: parseInt(e.target.value)
                                    }) }
                                    className="input input-bordered"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">视频下载并发数</span>
                                </label>
                                <input
                                    type="number"
                                    value={ config.videoDownloadConcurrency }
                                    onChange={ (e) => setConfig({
                                        ...config,
                                        videoDownloadConcurrency: parseInt(e.target.value)
                                    }) }
                                    className="input input-bordered"
                                />
                            </div>
                        </div>

                        {/* DeepL API配置 */ }
                        <div className="form-control w-full mb-6">
                            <label className="label">
                                <span className="label-text">DeepL API地址</span>
                            </label>
                            <textarea
                                value={ config.deeplApiUrls }
                                onChange={ (e) => setConfig({ ...config, deeplApiUrls: e.target.value }) }
                                placeholder="请输入DeepL API地址，多个地址用逗号分隔..."
                                className="textarea textarea-bordered h-24"
                            />
                        </div>

                        {/* 开关配置 */ }
                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text">兼容模式</span>
                                <input
                                    type="checkbox"
                                    checked={ config.streamCompatibility }
                                    onChange={ (e) => setConfig({ ...config, streamCompatibility: e.target.checked }) }
                                    className="toggle toggle-primary"
                                />
                            </label>
                            <span className="text-xs text-base-content/70 ml-2">
                                NCQQ不用开启，其他ICQQ、LLO需要开启
                            </span>
                        </div>

                        {/* 小红书 Cookie */ }
                        <div className="form-control w-full mt-6">
                            <label className="label">
                                <span className="label-text">小红书Cookie</span>
                            </label>
                            <input
                                type="text"
                                value={ config.xiaohongshuCookie }
                                onChange={ (e) => setConfig({ ...config, xiaohongshuCookie: e.target.value }) }
                                placeholder="请输入小红书的Cookie..."
                                className="input input-bordered"
                            />
                        </div>

                        {/* 定时清理配置 */ }
                        <div className="form-control w-full mt-6">
                            <label className="label">
                                <span className="label-text">自动清理时间</span>
                                <span className="label-text-alt text-xs">Cron表达式</span>
                            </label>
                            <input
                                type="text"
                                value={ config.autoclearTrashtime }
                                onChange={ (e) => setConfig({ ...config, autoclearTrashtime: e.target.value }) }
                                placeholder="请输入Cron表达式..."
                                className="input input-bordered"
                            />
                        </div>
                    </div>
                </div>

                {/* 保存按钮 */ }
                <div className="flex justify-end gap-4">
                    <button
                        className="btn btn-ghost"
                        onClick={ handleReset }
                        disabled={ loading }
                    >
                        重置
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={ handleSave }
                        disabled={ loading }
                    >
                        { loading ? <span className="loading loading-spinner"></span> : '保存配置' }
                    </button>
                </div>
            </div>
        </div>
    );
}
