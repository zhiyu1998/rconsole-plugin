import { useState, useEffect } from 'react';
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';

export default function Tiktok() {
    const [config, setConfig] = useState({
        douyinCookie: '',
        douyinCompression: true,
        douyinComments: false
    });

    const [loading, setLoading] = useState(false);

    // 读取配置
    useEffect(() => {
        const loadConfig = async () => {
            const yamlConfig = await readYamlConfig();
            if (yamlConfig) {
                setConfig({
                    douyinCookie: yamlConfig.douyinCookie || '',
                    douyinCompression: yamlConfig.douyinCompression ?? true,
                    douyinComments: yamlConfig.douyinComments ?? false
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
                douyinCookie: config.douyinCookie,
                douyinCompression: config.douyinCompression,
                douyinComments: config.douyinComments
            });

            if (success) {
                document.getElementById('tiktok-toast-success').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('tiktok-toast-success').classList.add('hidden');
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
                douyinCookie: yamlConfig.douyinCookie || '',
                douyinCompression: yamlConfig.douyinCompression ?? true,
                douyinComments: yamlConfig.douyinComments ?? false
            });
        }
    };

    return (
        <div className="p-6 mx-auto container">
            {/* 成功提示 */}
            <div id="tiktok-toast-success" className="toast toast-top toast-end hidden z-[9999]">
                <div className="alert alert-success">
                    <span>配置保存成功！</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">抖音配置</h2>

                {/* 基础配置部分 */}
                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* Cookie配置 */}
                        <div className="form-control w-full mb-6">
                            <label className="label">
                                <span className="label-text">Cookie</span>
                                <span className="label-text-alt text-xs text-base-content/70">
                                    格式：odin_tt=xxx;passport_fe_beating_status=xxx;...
                                </span>
                            </label>
                            <textarea
                                value={config.douyinCookie}
                                onChange={(e) => setConfig({ ...config, douyinCookie: e.target.value })}
                                placeholder="请输入抖音Cookie..."
                                className="textarea textarea-bordered h-24"
                            />
                        </div>

                        {/* 开关配置部分 */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">视频压缩</span>
                                    <input
                                        type="checkbox"
                                        checked={config.douyinCompression}
                                        onChange={(e) => setConfig({ ...config, douyinCompression: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                                <span className="text-xs text-base-content/70 ml-2">
                                    开启后使用压缩格式，加速视频发送
                                </span>
                            </div>
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">显示评论</span>
                                    <input
                                        type="checkbox"
                                        checked={config.douyinComments}
                                        onChange={(e) => setConfig({ ...config, douyinComments: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                                <span className="text-xs text-base-content/70 ml-2">
                                    是否显示视频评论
                                </span>
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
