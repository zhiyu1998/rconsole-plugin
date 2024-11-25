import { useEffect, useState } from "react";
import { GIT_COMMIT_URL, GIT_VERSION_URL } from "../../constants/api.js";

export function BotConfig() {
    const [version, setVersion] = useState("v0.0.0");
    const [commit, setCommit] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [updateMessage, setUpdateMessage] = useState("");

    useEffect(() => {
        fetch(GIT_VERSION_URL).then(response => response.json()).then(data => setVersion(data.name));
        fetch(GIT_COMMIT_URL).then(response => response.json()).then(data => setCommit(data));

        const checkUpdateStatus = async () => {
            try {
                const response = await fetch('/r/api/update?check=true');
                const data = await response.json();
                if (data.needsRestore) {
                    setUpdateMessage("检测到未完成的更新，正在恢复配置...");
                    const restoreResponse = await fetch('/r/api/update?restore=true');
                    const restoreData = await restoreResponse.json();
                    setUpdateMessage(restoreData.message);
                }
            } catch (error) {
                console.error('检查更新状态失败:', error);
            }
        };

        checkUpdateStatus();
    }, []);

    const handleUpdate = async (isForce = false) => {
        try {
            setUpdating(true);
            setUpdateMessage("正在更新中...");

            const response = await fetch(`/r/api/update?force=${isForce}`);
            const data = await response.json();

            if (data.success) {
                setUpdateMessage(data.message);
                fetch(GIT_VERSION_URL).then(response => response.json()).then(data => setVersion(data.name));
                fetch(GIT_COMMIT_URL).then(response => response.json()).then(data => setCommit(data));
            } else {
                setUpdateMessage(`更新失败：${data.message}`);
            }
        } catch (error) {
            setUpdateMessage(`更新出错：${error.message}`);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title text-lg font-bold">🔥更新看板</h2>
                <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">最新版本</h3>
                            <p>当前最新版本为：{version}</p>
                        </div>
                        <button className="btn btn-ghost"
                            onClick={() => fetch(GIT_VERSION_URL)
                                .then(response => response.json())
                                .then(data => setVersion(data.name))}>
                            检查更新
                        </button>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">更新操作</h3>
                            <p>选择更新方式进行更新</p>
                            {updateMessage && (
                                <p className={`text-sm ${updateMessage.includes('失败') || updateMessage.includes('错') ? 'text-error' : 'text-success'}`}>
                                    {updateMessage}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                className={`btn btn-primary ${updating ? 'loading' : ''}`}
                                onClick={() => handleUpdate(false)}
                                disabled={updating}>
                                普通更新
                            </button>
                            <button
                                className={`btn btn-warning ${updating ? 'loading' : ''}`}
                                onClick={() => handleUpdate(true)}
                                disabled={updating}>
                                强制更新
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">最近更新</h3>
                            <span><a href={commit?.url}>[{commit?.author}]{commit?.message}</a></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
