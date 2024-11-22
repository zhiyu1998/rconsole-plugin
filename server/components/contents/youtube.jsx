import { useState, useEffect } from 'react';
import { BILI_CDN_SELECT_LIST, YOUTUBE_GRAPHICS_LIST } from "../../../constants/constant.js";
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';

export default function Youtube() {
    const [config, setConfig] = useState({
        youtubeGraphicsOptions: 720,
        youtubeClipTime: 0,
        youtubeDuration: 480,
        youtubeCookiePath: ''
    });

    const [loading, setLoading] = useState(false);

    // 读取配置
    useEffect(() => {
        const loadConfig = async () => {
            const yamlConfig = await readYamlConfig();
            if (yamlConfig) {
                setConfig({
                    youtubeGraphicsOptions: yamlConfig.youtubeGraphicsOptions || 720,
                    youtubeClipTime: yamlConfig.youtubeClipTime || 0,
                    youtubeDuration: yamlConfig.youtubeDuration || 480,
                    youtubeCookiePath: yamlConfig.youtubeCookiePath || ''
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
                youtubeGraphicsOptions: config.youtubeGraphicsOptions,
                youtubeClipTime: config.youtubeClipTime,
                youtubeDuration: config.youtubeDuration,
                youtubeCookiePath: config.youtubeCookiePath
            });

            if (success) {
                document.getElementById('youtube-toast-success').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('youtube-toast-success').classList.add('hidden');
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
                youtubeGraphicsOptions: yamlConfig.youtubeGraphicsOptions || 720,
                youtubeClipTime: yamlConfig.youtubeClipTime || 0,
                youtubeDuration: yamlConfig.youtubeDuration || 480,
                youtubeCookiePath: yamlConfig.youtubeCookiePath || ''
            });
        }
    };

    return (
        <div className="p-6 mx-auto container">
            {/* 成功提示 */}
            <div id="youtube-toast-success" className="toast toast-top toast-end hidden">
                <div className="alert alert-success">
                    <span>配置保存成功！</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">YouTube 配置</h2>

                {/* 基础配置部分 */}
                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* Cookie路径配置 */}
                        <div className="form-control w-full mb-6">
                            <label className="label">
                                <span className="label-text">Cookie文件路径</span>
                            </label>
                            <input
                                type="text"
                                value={config.youtubeCookiePath}
                                onChange={(e) => setConfig({ ...config, youtubeCookiePath: e.target.value })}
                                placeholder="请输入Cookie.txt文件路径..."
                                className="input input-bordered w-full"
                            />
                        </div>

                        {/* 数值配置部分 */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">下载画质</span>
                                    <span className="label-text-alt text-xs">0为原画</span>
                                </label>
                                <select
                                    className="select select-bordered"
                                    value={config.youtubeGraphicsOptions}
                                    onChange={(e) => setConfig({ ...config, youtubeGraphicsOptions: parseInt(e.target.value) })}>
                                    {
                                        YOUTUBE_GRAPHICS_LIST.map(item => {
                                            return (
                                                <option value={ item.value }>{ item.label }</option>
                                            )
                                        })
                                    }
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">最大截取时长（秒）</span>
                                    <span className="label-text-alt text-xs">建议不超过5分钟</span>
                                </label>
                                <input
                                    type="number"
                                    value={config.youtubeClipTime}
                                    onChange={(e) => setConfig({ ...config, youtubeClipTime: parseInt(e.target.value) })}
                                    className="input input-bordered"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">视频时长限制（秒）</span>
                                    <span className="label-text-alt text-xs">建议不超过30分钟</span>
                                </label>
                                <input
                                    type="number"
                                    value={config.youtubeDuration}
                                    onChange={(e) => setConfig({ ...config, youtubeDuration: parseInt(e.target.value) })}
                                    className="input input-bordered"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 保存按钮 */}
                <div className="flex justify-end gap-4">
                    <button
                        className="btn btn-ghost"
                        onClick={handleReset}
                        disabled={loading}
                    >
                        重置
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? <span className="loading loading-spinner"></span> : '保存配置'}
                    </button>
                </div>
            </div>
        </div>
    );
}
