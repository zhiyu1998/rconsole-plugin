import { useState, useEffect } from 'react';
import { BILI_CDN_SELECT_LIST, BILI_DOWNLOAD_METHOD, BILI_RESOLUTION_LIST } from "../../../constants/constant.js";
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';
import Toast from "../toast.jsx";
import { ConfigToggle, ConfigInput, ConfigSelect } from '../common/ConfigItem';

// 定义配置项
const BILI_CONFIG = {
    toggles: [
        { key: 'biliDisplayCover', label: '显示封面' },
        { key: 'biliDisplayInfo', label: '显示视频信息' },
        { key: 'biliDisplayIntro', label: '显示简介' },
        { key: 'biliDisplayOnline', label: '显示在线人数' },
        { key: 'biliDisplaySummary', label: '显示总结' },
        { key: 'biliUseBBDown', label: '使用BBDown' },
    ],
    inputs: [
        { key: 'biliSessData', label: 'SESSDATA', type: 'text', placeholder: '请输入Bilibili SESSDATA' },
        { key: 'biliDuration', label: '视频时长限制（秒）', type: 'number' },
        { key: 'biliIntroLenLimit', label: '简介长度限制', type: 'number' },
    ],
    selects: [
        { key: 'biliCDN', label: 'CDN选择', options: BILI_CDN_SELECT_LIST },
        { key: 'biliDownloadMethod', label: '下载方式', options: BILI_DOWNLOAD_METHOD },
        { key: 'biliResolution', label: '视频画质', options: BILI_RESOLUTION_LIST },
    ]
};

// 默认配置
const DEFAULT_CONFIG = {
    biliSessData: '',
    biliDuration: 480,
    biliIntroLenLimit: 50,
    biliDisplayCover: true,
    biliDisplayInfo: true,
    biliDisplayIntro: true,
    biliDisplayOnline: true,
    biliDisplaySummary: false,
    biliUseBBDown: false,
    biliCDN: 0,
    biliDownloadMethod: 0,
    biliResolution: 5
};

export default function Bili() {
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
                document.getElementById('toast-success').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('toast-success').classList.add('hidden');
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
            <Toast id="toast-success" />

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">Bilibili 配置</h2>

                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* 输入框配置 */}
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            {BILI_CONFIG.inputs.map(item => (
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

                        {/* 开关配置 */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            {BILI_CONFIG.toggles.map(item => (
                                <ConfigToggle
                                    key={item.key}
                                    label={item.label}
                                    checked={config[item.key]}
                                    onChange={(value) => handleConfigChange(item.key, value)}
                                />
                            ))}
                        </div>

                        {/* 选择框配置 */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {BILI_CONFIG.selects.map(item => (
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

                {/* 操作按钮 */}
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
