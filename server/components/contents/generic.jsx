import { useState, useEffect } from 'react';
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';
import Toast from "../toast.jsx";
import { ConfigToggle, ConfigInput, ConfigSelect } from '../common/ConfigItem';
import { AI_MODEL_LIST } from "../../../constants/constant.js";

// 定义配置项
const GENERIC_CONFIG = {
    basicInputs: [
        {
            key: 'defaultPath',
            label: '视频保存路径',
            type: 'text',
            placeholder: '请输入视频保存路径...',
            defaultValue: './data/rcmp4/'
        },
        {
            key: 'videoSizeLimit',
            label: '视频大小限制（MB）',
            type: 'number',
            hint: '超过限制转为群文件',
            defaultValue: 70
        }
    ],
    proxyInputs: [
        {
            key: 'proxyAddr',
            label: '魔法地址',
            type: 'text',
            placeholder: '请输入代理地址...',
            defaultValue: '127.0.0.1'
        },
        {
            key: 'proxyPort',
            label: '魔法端口',
            type: 'text',
            placeholder: '请输入代理端口...',
            defaultValue: '7890'
        }
    ],
    streamInputs: [
        {
            key: 'identifyPrefix',
            label: '识别前缀',
            type: 'text',
            placeholder: '请输入识别前缀...',
            defaultValue: ''
        },
        {
            key: 'streamDuration',
            label: '视频最大时长（秒）',
            type: 'number',
            defaultValue: 10
        }
    ],
    concurrencyInputs: [
        {
            key: 'queueConcurrency',
            label: '队列并发数',
            type: 'number',
            hint: '仅影响B站下载',
            defaultValue: 1
        },
        {
            key: 'videoDownloadConcurrency',
            label: '视频下载并发数',
            type: 'number',
            defaultValue: 1
        }
    ],
    textareas: [
        {
            key: 'deeplApiUrls',
            label: 'DeepL API地址',
            placeholder: '请输入DeepL API地址，多个地址用逗号分隔...',
            defaultValue: ''
        }
    ],
    toggles: [
        {
            key: 'streamCompatibility',
            label: '兼容模式',
            hint: 'NCQQ不用开启，其他ICQQ、LLO需要开启',
            defaultValue: false
        }
    ],
    otherInputs: [
        {
            key: 'xiaohongshuCookie',
            label: '小红书Cookie',
            type: 'text',
            placeholder: '请输入小红书的Cookie...',
            defaultValue: ''
        },
        {
            key: 'autoclearTrashtime',
            label: '自动清理时间',
            type: 'text',
            placeholder: '请输入Cron表达式...',
            hint: 'Cron表达式',
            defaultValue: '0 0 8 * * ?'
        }
    ],
    aiInputs: [
        {
            key: 'aiBaseURL',
            label: 'AI接口地址',
            type: 'text',
            placeholder: '请输入AI接口地址...',
            defaultValue: '',
            hint: '用于识图的接口，kimi默认接口为：https://api.moonshot.cn，其他服务商自己填写'
        },
        {
            key: 'aiApiKey',
            label: 'API Key',
            type: 'text',
            placeholder: '请输入API Key...',
            defaultValue: '',
            hint: '用于识图的api key，kimi接口申请：https://platform.moonshot.cn/console/api-keys'
        }
    ],
    aiSelects: [
        {
            key: 'aiModel',
            label: 'AI模型',
            options: [
                { value: 'moonshot-v1-8k', label: 'Moonshot V1 8K' },
                { value: 'moonshot-v1-32k', label: 'Moonshot V1 32K' },
                { value: 'moonshot-v1-128k', label: 'Moonshot V1 128K' },
                // 可以根据需要添加更多模型选项
            ],
            defaultValue: 'moonshot-v1-8k',
            hint: '模型，使用kimi不用填写，其他要填写'
        }
    ]
};

// 生成默认配置
const DEFAULT_CONFIG = Object.values(GENERIC_CONFIG).reduce((acc, group) => {
    group.forEach(item => {
        acc[item.key] = item.defaultValue;
    });
    return acc;
}, {});

export default function Generic() {
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

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    // 渲染输入框组
    const renderInputGroup = (inputs, title) => (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
            {inputs.map(item => (
                <div key={item.key} className="form-control">
                    <ConfigInput
                        label={item.label}
                        type={item.type}
                        value={config[item.key]}
                        onChange={(value) => handleConfigChange(item.key, value)}
                        placeholder={item.placeholder}
                    />
                    {item.hint && (
                        <span className="text-xs text-base-content/70 mt-1">
                            {item.hint}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );

    return (
        <div className="p-6 mx-auto container">
            <Toast id="generic-toast-success" />

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">通用配置</h2>

                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* 基础配置 */}
                        {renderInputGroup(GENERIC_CONFIG.basicInputs)}

                        {/* 代理配置 */}
                        <h4 className="font-semibold mt-6 mb-4">代理设置</h4>
                        {renderInputGroup(GENERIC_CONFIG.proxyInputs)}

                        {/* 流媒体配置 */}
                        <h4 className="font-semibold mt-6 mb-4">流媒体设置</h4>
                        {renderInputGroup(GENERIC_CONFIG.streamInputs)}

                        {/* 并发配置 */}
                        <h4 className="font-semibold mt-6 mb-4">并发设置</h4>
                        {renderInputGroup(GENERIC_CONFIG.concurrencyInputs)}

                        {/* DeepL API配置 */}
                        <h4 className="font-semibold mt-6 mb-4">API设置</h4>
                        {GENERIC_CONFIG.textareas.map(item => (
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

                        {/* 开关配置 */}
                        {GENERIC_CONFIG.toggles.map(item => (
                            <div key={item.key} className="form-control mb-6">
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

                        {/* 其他配置 */}
                        <h4 className="font-semibold mt-6 mb-4">其他设置</h4>
                        {renderInputGroup(GENERIC_CONFIG.otherInputs)}

                        {/* AI配置 */}
                        <h4 className="font-semibold mt-6 mb-4">AI设置</h4>
                        {renderInputGroup(GENERIC_CONFIG.aiInputs)}
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            {GENERIC_CONFIG.aiSelects.map(item => (
                                <div key={item.key} className="form-control">
                                    <ConfigSelect
                                        label={item.label}
                                        value={config[item.key]}
                                        onChange={(value) => handleConfigChange(item.key, value)}
                                        options={item.options}
                                    />
                                    {item.hint && (
                                        <span className="text-xs text-base-content/70 mt-1">
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
