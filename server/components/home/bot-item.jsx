import React, { useEffect, useState } from "react";
import { BOT_INFO_URL } from "../../constants/api.js";

export function BotItem() {

    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchBotInfo = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(BOT_INFO_URL);
            const data = await response.json();
            setUser(data);
        } catch (error) {
            console.error("获取机器人信息失败:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBotInfo();
    }, []);

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title">🐔状态</h2>
                <div className="flex flex-col sm:flex-row pt-5 items-center sm:items-start gap-6 sm:gap-8">
                    <div className={`avatar z-0 ${user?.online ? "online" : "offline"}`}>
                        <div className="w-24 rounded-full">
                            <img src={`http://q1.qlogo.cn/g?b=qq&nk=${user?.user_id}&s=100`} alt="Bot Avatar" />
                        </div>
                    </div>
                    <div className="flex flex-col space-y-4 text-center sm:text-left">
                        <div className="space-y-2">
                            <div className="font-bold">昵称：{user?.nickname || "未获取"}</div>
                            <div className="text-sm opacity-50">QQ号：{user?.user_id || "NaN"}</div>
                        </div>
                        <div className="space-y-2">
                            <div className="font-bold">协议信息：</div>
                            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                                <div className="badge badge-ghost">{user?.app_name}</div>
                                <div className="badge badge-ghost">{user?.app_version}</div>
                                <div className="badge badge-ghost">{user?.protocol_version}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card-actions justify-end mt-4">
                    <button
                        className={`btn btn-sm btn-ghost ${isLoading ? 'loading' : ''}`}
                        onClick={fetchBotInfo}
                        disabled={isLoading}
                    >
                        {isLoading ? '刷新中...' : '刷新信息'}
                    </button>
                </div>
            </div>
        </div>
    )
}
