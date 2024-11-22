import { useState, useEffect } from 'react';
import { BILI_CDN_SELECT_LIST, BILI_DOWNLOAD_METHOD, BILI_RESOLUTION_LIST } from "../../../constants/constant.js";
import { readYamlConfig, updateYamlConfig } from '../../utils/yamlHelper';

export default function Bili() {
    const [config, setConfig] = useState({
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
    });

    const [loading, setLoading] = useState(false);

    // 读取配置
    useEffect(() => {
        const loadConfig = async () => {
            const yamlConfig = await readYamlConfig();
            if (yamlConfig) {
                setConfig({
                    biliSessData: yamlConfig.biliSessData || '',
                    biliDuration: yamlConfig.biliDuration || 480,
                    biliIntroLenLimit: yamlConfig.biliIntroLenLimit || 50,
                    biliDisplayCover: yamlConfig.biliDisplayCover ?? true,
                    biliDisplayInfo: yamlConfig.biliDisplayInfo ?? true,
                    biliDisplayIntro: yamlConfig.biliDisplayIntro ?? true,
                    biliDisplayOnline: yamlConfig.biliDisplayOnline ?? true,
                    biliDisplaySummary: yamlConfig.biliDisplaySummary ?? false,
                    biliUseBBDown: yamlConfig.biliUseBBDown ?? false,
                    biliCDN: yamlConfig.biliCDN || 0,
                    biliDownloadMethod: yamlConfig.biliDownloadMethod || 0,
                    biliResolution: yamlConfig.biliResolution || 5
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
                biliSessData: config.biliSessData,
                biliDuration: config.biliDuration,
                biliIntroLenLimit: config.biliIntroLenLimit,
                biliDisplayCover: config.biliDisplayCover,
                biliDisplayInfo: config.biliDisplayInfo,
                biliDisplayIntro: config.biliDisplayIntro,
                biliDisplayOnline: config.biliDisplayOnline,
                biliDisplaySummary: config.biliDisplaySummary,
                biliUseBBDown: config.biliUseBBDown,
                biliCDN: config.biliCDN,
                biliDownloadMethod: config.biliDownloadMethod,
                biliResolution: config.biliResolution
            });

            if (success) {
                // 使用 daisyUI 的 toast 提示
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

    // 重置配置
    const handleReset = async () => {
        const yamlConfig = await readYamlConfig();
        if (yamlConfig) {
            setConfig({
                biliSessData: yamlConfig.biliSessData || '',
                biliDuration: yamlConfig.biliDuration || 480,
                biliIntroLenLimit: yamlConfig.biliIntroLenLimit || 50,
                biliDisplayCover: yamlConfig.biliDisplayCover ?? true,
                biliDisplayInfo: yamlConfig.biliDisplayInfo ?? true,
                biliDisplayIntro: yamlConfig.biliDisplayIntro ?? true,
                biliDisplayOnline: yamlConfig.biliDisplayOnline ?? true,
                biliDisplaySummary: yamlConfig.biliDisplaySummary ?? false,
                biliUseBBDown: yamlConfig.biliUseBBDown ?? false,
                biliCDN: yamlConfig.biliCDN || 0,
                biliDownloadMethod: yamlConfig.biliDownloadMethod || 0,
                biliResolution: yamlConfig.biliResolution || 5
            });
        }
    };

    return (
        <div className="p-6 mx-auto container">
            {/* 成功提示 */}
            <div id="toast-success" className="toast toast-top toast-end hidden">
                <div className="alert alert-success">
                    <span>配置保存成功！</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">Bilibili 配置</h2>

                {/* 基础配置部分 */}
                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">基础配置</h3>

                        {/* SESSDATA配置 */}
                        <div className="form-control w-full mb-4">
                            <label className="label">
                                <span className="label-text">SESSDATA</span>
                            </label>
                            <input
                                type="text"
                                value={config.biliSessData}
                                onChange={(e) => setConfig({ ...config, biliSessData: e.target.value })}
                                placeholder="请输入Bilibili SESSDATA"
                                className="input input-bordered w-full"
                            />
                        </div>

                        {/* 数值配置部分 */}
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">视频时长限制（秒）</span>
                                </label>
                                <input
                                    type="number"
                                    value={config.biliDuration}
                                    onChange={(e) => setConfig({ ...config, biliDuration: parseInt(e.target.value) })}
                                    className="input input-bordered"
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">简介长度限制</span>
                                </label>
                                <input
                                    type="number"
                                    value={config.biliIntroLenLimit}
                                    onChange={(e) => setConfig({ ...config, biliIntroLenLimit: parseInt(e.target.value) })}
                                    className="input input-bordered"
                                />
                            </div>
                        </div>

                        {/* 开关配置部分 */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">显示封面</span>
                                    <input
                                        type="checkbox"
                                        checked={config.biliDisplayCover}
                                        onChange={(e) => setConfig({ ...config, biliDisplayCover: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                            </div>
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">显示视频信息</span>
                                    <input
                                        type="checkbox"
                                        checked={config.biliDisplayInfo}
                                        onChange={(e) => setConfig({ ...config, biliDisplayInfo: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                            </div>
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">显示简介</span>
                                    <input
                                        type="checkbox"
                                        checked={config.biliDisplayIntro}
                                        onChange={(e) => setConfig({ ...config, biliDisplayIntro: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                            </div>
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">显示在线人数</span>
                                    <input
                                        type="checkbox"
                                        checked={config.biliDisplayOnline}
                                        onChange={(e) => setConfig({ ...config, biliDisplayOnline: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                            </div>
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">显示总结</span>
                                    <input
                                        type="checkbox"
                                        checked={config.biliDisplaySummary}
                                        onChange={(e) => setConfig({ ...config, biliDisplaySummary: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                            </div>
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">使用BBDown</span>
                                    <input
                                        type="checkbox"
                                        checked={config.biliUseBBDown}
                                        onChange={(e) => setConfig({ ...config, biliUseBBDown: e.target.checked })}
                                        className="toggle toggle-primary"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* 下拉选择配置部分 */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">CDN选择</span>
                                </label>
                                <select
                                    className="select select-bordered"
                                    value={config.biliCDN}
                                    onChange={(e) => setConfig({ ...config, biliCDN: parseInt(e.target.value) })}>
                                    {
                                        BILI_CDN_SELECT_LIST.map(item => {
                                            return (
                                                <option value={ item.value }>{ item.label }</option>
                                            )
                                        })
                                    }
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">下载方式</span>
                                </label>
                                <select
                                    className="select select-bordered"
                                    value={config.biliDownloadMethod}
                                    onChange={(e) => setConfig({ ...config, biliDownloadMethod: parseInt(e.target.value) })}>
                                    {
                                        BILI_DOWNLOAD_METHOD.map(item => {
                                            return (
                                                <option value={ item.value }>{ item.label }</option>
                                            )
                                        })
                                    }
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">视频画质</span>
                                </label>
                                <select
                                    className="select select-bordered"
                                    value={config.biliResolution}
                                    onChange={(e) => setConfig({ ...config, biliResolution: parseInt(e.target.value) })}>
                                    {
                                        BILI_RESOLUTION_LIST.map(item => {
                                            return (
                                                <option value={ item.value }>{ item.label }</option>
                                            )
                                        })
                                    }
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
    )
}
