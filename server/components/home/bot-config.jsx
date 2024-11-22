export function BotConfig() {
    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title text-lg font-bold">🔥快捷更新</h2>
                <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">检查更新</h3>
                            <p>当前最新版本为：v0.0.0</p>
                        </div>
                        <button className="btn btn-warning">🚧施工</button>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">非强制更新</h3>
                            <p>R 插件的非强制更新，力度小</p>
                        </div>
                        <button className="btn btn-warning">🚧施工</button>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">强制更新</h3>
                            <p>R 插件的强制更新，力度大</p>
                        </div>
                        <button className="btn btn-warning">🚧施工</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
