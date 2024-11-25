import { useState, useEffect } from 'react';
import { YOUTUBE_GRAPHICS_LIST } from "../../../constants/constant.js";
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';
import Toast from "../toast.jsx";
import { ConfigInput, ConfigSelect } from '../common/ConfigItem';

// 定义配置项
const YOUTUBE_CONFIG = {
    inputs: [
        { key: 'youtubeCookiePath', label: 'Cookie文件路径', type: 'text', placeholder: '请输入Cookie.txt文件路径...' },
        { key: 'youtubeClipTime', label: '最大截取时长（秒）', type: 'number', hint: '建议不超过5分钟' },
        { key: 'youtubeDuration', label: '视频时长限制（秒）', type: 'number', hint: '建议不超过30分钟' }
    ],
    selects: [
        { key: 'youtubeGraphicsOptions', label: '下载画质', options: YOUTUBE_GRAPHICS_LIST, hint: '0为原画' }
    ]
};

// 默认配置
const DEFAULT_CONFIG = {
    youtubeGraphicsOptions: 720,
    youtubeClipTime: 0,
    youtubeDuration: 480,
    youtubeCookiePath: ''
};

export default function Youtube() {
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

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="p-6 mx-auto container">
            <Toast id="youtube-toast-success" />

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">YouTube 配置</h2>

                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* 输入框配置 */}
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            {YOUTUBE_CONFIG.inputs.map(item => (
                                <ConfigInput
                                    key={item.key}
                                    label={item.label}
                                    type={item.type}
                                    value={config[item.key]}
                                    onChange={(value) => handleConfigChange(item.key, value)}
                                    placeholder={item.placeholder}
                                />
                            ))}
                        </div>

                        {/* 选择框配置 */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {YOUTUBE_CONFIG.selects.map(item => (
                                <ConfigSelect
                                    key={item.key}
                                    label={item.label}
                                    value={config[item.key]}
                                    onChange={(value) => handleConfigChange(item.key, value)}
                                    options={item.options}
                                />
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
