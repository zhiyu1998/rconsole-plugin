export function BotConfig() {
    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title text-lg font-bold">🔥热门快捷配置</h2>
                <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">通用</h3>
                            <p>R 插件一些通用配置：魔法配置、线程配置等</p>
                        </div>
                        <button onClick={()=>document.getElementById('my_modal_5').showModal()} className="btn">配置</button>
                        <dialog id="my_modal_5" className="modal ">
                            <div className="modal-box w-11/12 max-w-2xl">
                                <div className="mockup-browser bg-base-300 border">
                                    <div className="mockup-browser-toolbar">
                                        <div className="input">https://daisyui.com</div>
                                    </div>
                                    <div className="bg-base-200 flex justify-center px-4 pt-8">
                                        <label className="input input-bordered flex items-center gap-2">
                                            魔法地址
                                            <input type="text" className="grow"
                                                   placeholder="例如：http://localhost"/>
                                        </label>
                                    </div>
                                    <div className="bg-base-200 flex justify-center px-4 py-8">
                                        <label className="input input-bordered flex items-center gap-2">
                                            魔法端口
                                            <input type="text" className="grow"
                                                   placeholder="例如：7890"/>
                                        </label>
                                    </div>
                                </div>
                                <div className="modal-action">
                                    <form method="dialog">
                                        {/* if there is a button in form, it will close the modal */ }
                                        <button className="btn">Close</button>
                                    </form>
                                </div>
                            </div>
                        </dialog>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">哔哩哔哩</h3>
                            <p>哔哩哔哩相关配置</p>
                        </div>
                        <button className="btn btn-warning">🚧施工</button>
                    </div>
                    <div className="flex justify-between items-center">
                        <div>
                        <h3 className="font-bold">抖音</h3>
                            <p>抖音相关配置</p>
                        </div>
                        <button className="btn btn-warning">🚧施工</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
