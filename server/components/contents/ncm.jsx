import { useState, useEffect } from 'react';
import { NETEASECLOUD_QUALITY_LIST } from "../../../constants/constant.js";
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';
import Toast from "../toast.jsx";
import { ConfigToggle, ConfigInput, ConfigSelect } from '../common/ConfigItem';

// 定义配置项
const NCM_CONFIG = {
    textareas: [
        {
            key: 'neteaseCookie',
            label: 'Cookie',
            placeholder: '请输入网易云Cookie...'
        }
    ],
    inputs: [
        {
            key: 'neteaseCloudAPIServer',
            label: '自建API服务器地址',
            type: 'text',
            placeholder: '请输入API服务器地址...'
        },
        {
            key: 'neteaseUserId',
            label: '用户ID',
            type: 'text',
            placeholder: '网易云用户ID',
            hint: '不要手动更改！'
        },
        {
            key: 'songRequestMaxList',
            label: '点歌最大列表数',
            type: 'number'
        }
    ],
    toggles: [
        { key: 'useLocalNeteaseAPI', label: '使用自建API' },
        { key: 'useNeteaseSongRequest', label: '开启点歌功能' },
        { key: 'isSendVocal', label: '发送群语音' }
    ],
    selects: [
        {
            key: 'neteaseCloudAudioQuality',
            label: '音频质量',
            options: NETEASECLOUD_QUALITY_LIST
        }
    ]
};

// 默认配置
const DEFAULT_CONFIG = {
    useLocalNeteaseAPI: false,
    useNeteaseSongRequest: false,
    isSendVocal: true,
    songRequestMaxList: 10,
    neteaseCookie: '',
    neteaseCloudAPIServer: '',
    neteaseCloudAudioQuality: 'exhigh',
    neteaseUserId: ''
};

export default function Ncm() {
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

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="p-6 mx-auto container">
            <Toast id="ncm-toast-success" />

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">网易云音乐配置</h2>

                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* 文本域配置 */}
                        {NCM_CONFIG.textareas.map(item => (
                            <div key={item.key} className="form-control w-full mb-6">
                                <label className="label">
                                    <span className="label-text">{item.label}</span>
                                </label>
                                <textarea
                                    value={config[item.key]}
                                    onChange={(e) => handleConfigChange(item.key, e.target.value)}
                                    placeholder={item.placeholder}
                                    className="textarea textarea-bordered h-24"
                                />
                            </div>
                        ))}

                        {/* 输入框配置 */}
                        <div className="space-y-4 mb-6">
                            {NCM_CONFIG.inputs.map(item => (
                                <div key={item.key} className="form-control w-full">
                                    <ConfigInput
                                        label={item.label}
                                        type={item.type}
                                        value={config[item.key]}
                                        onChange={(value) => handleConfigChange(item.key, value)}
                                        placeholder={item.placeholder}
                                    />
                                    {item.hint && (
                                        <span className="text-xs text-warning mt-1">
                                            {item.hint}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* 开关配置 */}
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            {NCM_CONFIG.toggles.map(item => (
                                <ConfigToggle
                                    key={item.key}
                                    label={item.label}
                                    checked={config[item.key]}
                                    onChange={(value) => handleConfigChange(item.key, value)}
                                />
                            ))}
                        </div>

                        {/* 选择框配置 */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {NCM_CONFIG.selects.map(item => (
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
