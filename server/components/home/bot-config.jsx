import { useEffect, useState } from "react";
import { GIT_COMMIT_URL, GIT_VERSION_URL } from "../../constants/api.js";

export function BotConfig() {

    const [version, setVersion] = useState("v0.0.0");

    const [commit, setCommit] = useState(null);

    useEffect(() => {
        fetch(GIT_VERSION_URL).then(response => response.json()).then(data => setVersion(data.name));
        fetch(GIT_COMMIT_URL).then(response => response.json()).then(data => setCommit(data));
    }, []);

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title text-lg font-bold">🔥更新看板</h2>
                <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">最新版本</h3>
                            <p>当前最新版本为：{ version }</p>
                        </div>
                        <button className="btn btn-ghost"
                                onClick={ () => fetch(GIT_VERSION_URL).then(response => response.json()).then(data => setVersion(data.name)) }>检查更新
                        </button>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">手动更新</h3>
                            <p>R 插件的自动选择更新 / 强制更新</p>
                        </div>
                        <button className="btn btn-warning">🚧施工</button>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">最近更新</h3>
                            <span><a href={ commit?.url }>[{ commit?.author }]{ commit?.message }</a></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
