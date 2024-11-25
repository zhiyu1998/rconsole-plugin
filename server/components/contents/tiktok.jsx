import { useState, useEffect } from 'react';
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';
import Toast from "../toast.jsx";
import { ConfigToggle } from '../common/ConfigItem';

// 定义配置项
const TIKTOK_CONFIG = {
    textareas: [
        {
            key: 'douyinCookie',
            label: 'Cookie',
            placeholder: '请输入抖音Cookie...',
            hint: '格式：odin_tt=xxx;passport_fe_beating_status=xxx;...'
        }
    ],
    toggles: [
        {
            key: 'douyinCompression',
            label: '视频压缩',
            hint: '开启后使用压缩格式，加速视频发送'
        },
        {
            key: 'douyinComments',
            label: '显示评论',
            hint: '是否显示视频评论'
        }
    ]
};

// 默认配置
const DEFAULT_CONFIG = {
    douyinCookie: '',
    douyinCompression: true,
    douyinComments: false
};

export default function Tiktok() {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            const yamlConfig = await readYamlConfig();
            if (yamlConfig) {
                const newConfig = {};
                Object.keys(DEFAULT_CONFIG).forEach(key => {
                    newConfig[key] = yamlConfig[key] ?? DEFAULT_CONFIG[key];
                });
                setConfig(newConfig);
            }
        };
        loadConfig();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            const success = await updateYamlConfig(config);
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

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="p-6 mx-auto container">
            <Toast id="tiktok-toast-success" />

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">抖音配置</h2>

                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* Cookie配置 */}
                        {TIKTOK_CONFIG.textareas.map(item => (
                            <div key={item.key} className="form-control w-full mb-6">
                                <label className="label">
                                    <span className="label-text">{item.label}</span>
                                    {item.hint && (
                                        <span className="label-text-alt text-xs text-base-content/70">
                                            {item.hint}
                                        </span>
                                    )}
                                </label>
                                <textarea
                                    value={config[item.key]}
                                    onChange={(e) => handleConfigChange(item.key, e.target.value)}
                                    placeholder={item.placeholder}
                                    className="textarea textarea-bordered h-24"
                                />
                            </div>
                        ))}

                        {/* 开关配置 */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {TIKTOK_CONFIG.toggles.map(item => (
                                <div key={item.key}>
                                    <ConfigToggle
                                        label={item.label}
                                        checked={config[item.key]}
                                        onChange={(value) => handleConfigChange(item.key, value)}
                                    />
                                    {item.hint && (
                                        <span className="text-xs text-base-content/70 ml-2">
                                            {item.hint}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 保存按钮 */}
                <div className="flex justify-end gap-4">
                    <button
                        className="btn btn-ghost"
                        onClick={() => setConfig(DEFAULT_CONFIG)}
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
