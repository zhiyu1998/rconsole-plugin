import { useState, useEffect } from 'react';
import { NETEASECLOUD_QUALITY_LIST } from "../../../constants/constant.js";
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';

export default function Ncm() {
    const [config, setConfig] = useState({
        useLocalNeteaseAPI: false,
        useNeteaseSongRequest: false,
        isSendVocal: true,
        songRequestMaxList: 10,
        neteaseCookie: '',
        neteaseCloudAPIServer: '',
        neteaseCloudAudioQuality: 'exhigh',
        neteaseUserId: ''
    });

    const [loading, setLoading] = useState(false);

    // 读取配置
    useEffect(() => {
        const loadConfig = async () => {
            const yamlConfig = await readYamlConfig();
            if (yamlConfig) {
                setConfig({
                    useLocalNeteaseAPI: yamlConfig.useLocalNeteaseAPI ?? false,
                    useNeteaseSongRequest: yamlConfig.useNeteaseSongRequest ?? false,
                    isSendVocal: yamlConfig.isSendVocal ?? true,
                    songRequestMaxList: yamlConfig.songRequestMaxList || 10,
                    neteaseCookie: yamlConfig.neteaseCookie || '',
                    neteaseCloudAPIServer: yamlConfig.neteaseCloudAPIServer || '',
                    neteaseCloudAudioQuality: yamlConfig.neteaseCloudAudioQuality || 'exhigh',
                    neteaseUserId: yamlConfig.neteaseUserId || ''
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
                useLocalNeteaseAPI: config.useLocalNeteaseAPI,
                useNeteaseSongRequest: config.useNeteaseSongRequest,
                isSendVocal: config.isSendVocal,
                songRequestMaxList: config.songRequestMaxList,
                neteaseCookie: config.neteaseCookie,
                neteaseCloudAPIServer: config.neteaseCloudAPIServer,
                neteaseCloudAudioQuality: config.neteaseCloudAudioQuality,
                neteaseUserId: config.neteaseUserId
            });

            if (success) {
                document.getElementById('ncm-toast-success').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('ncm-toast-success').classList.add('hidden');
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
                useLocalNeteaseAPI: yamlConfig.useLocalNeteaseAPI ?? false,
                useNeteaseSongRequest: yamlConfig.useNeteaseSongRequest ?? false,
                isSendVocal: yamlConfig.isSendVocal ?? true,
                songRequestMaxList: yamlConfig.songRequestMaxList || 10,
                neteaseCookie: yamlConfig.neteaseCookie || '',
                neteaseCloudAPIServer: yamlConfig.neteaseCloudAPIServer || '',
                neteaseCloudAudioQuality: yamlConfig.neteaseCloudAudioQuality || 'exhigh',
                neteaseUserId: yamlConfig.neteaseUserId || ''
            });
        }
    };

    return (
        <div className="p-6 mx-auto container">
            {/* 成功提示 */}
            <div id="ncm-toast-success" className="toast toast-top toast-end hidden z-[9999]">
                <div className="alert alert-success">
                    <span>配置保存成功！</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">网易云音乐配置</h2>

                {/* 基础配置部分 */}
                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* 文本输入配置 */}
                        <div className="space-y-4 mb-6">
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text">Cookie</span>
                                </label>
                                <textarea
                                    value={config.neteaseCookie}
                                    onChange={(e) => setConfig({ ...config, neteaseCookie: e.target.value })}
                                    placeholder="请输入网易云Cookie..."
                                    className="textarea textarea-bordered h-24"
                                />
                            </div>
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text">自建API服务器地址</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.neteaseCloudAPIServer}
                                    onChange={(e) => setConfig({ ...config, neteaseCloudAPIServer: e.target.value })}
                                    placeholder="请输入API服务器地址..."
                                    className="input input-bordered w-full"
                                />
                            </div>
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text">用户ID</span>
                                    <span className="label-text-alt text-xs text-warning">不要手动更改！</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.neteaseUserId}
                                    onChange={(e) => setConfig({ ...config, neteaseUserId: e.target.value })}
                                    placeholder="网易云用户ID"
                                    className="input input-bordered w-full"
                                />
                            </div>
                        </div>

                        {/* 开关配置部分 */}
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">使用自建API</span>
                                    <input
                                        type="checkbox"
                                        checked={config.useLocalNeteaseAPI}
                                        onChange={(e) => setConfig({ ...config, useLocalNeteaseAPI: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                            </div>
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">开启点歌功能</span>
                                    <input
                                        type="checkbox"
                                        checked={config.useNeteaseSongRequest}
                                        onChange={(e) => setConfig({ ...config, useNeteaseSongRequest: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                            </div>
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">发送群语音</span>
                                    <input
                                        type="checkbox"
                                        checked={config.isSendVocal}
                                        onChange={(e) => setConfig({ ...config, isSendVocal: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* 其他配置 */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">点歌最大列表数</span>
                                </label>
                                <input
                                    type="number"
                                    value={config.songRequestMaxList}
                                    onChange={(e) => setConfig({ ...config, songRequestMaxList: parseInt(e.target.value) })}
                                    className="input input-bordered"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">音频质量</span>
                                </label>
                                <select
                                    className="select select-bordered"
                                    value={config.neteaseCloudAudioQuality}
                                    onChange={(e) => setConfig({ ...config, neteaseCloudAudioQuality: e.target.value })}>
                                    {NETEASECLOUD_QUALITY_LIST.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
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
