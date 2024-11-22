import React, { useEffect, useState } from "react";
import { BOT_INFO_URL } from "../../constants/api.js";

export function BotItem() {

    const [user, setUser] = useState(null);

    useEffect(() => {
        fetch(BOT_INFO_URL)
            .then(response => {
                return response.json();
            })
            .then(data => setUser(data))
    }, []);

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title">🐔状态</h2>
                <div className="flex flex-row pt-5 justify-between items-center">
                    <div className={ `avatar ${ user?.online ? "online" : "offline" }` }>
                        <div className="w-24 rounded-full">
                            <img src={ `http://q1.qlogo.cn/g?b=qq&nk=${ user?.user_id }&s=100` }/>
                        </div>
                    </div>
                    <div className="flex flex-col ml-12 space-y-2">
                        <div className="space-y-2">
                            <div className="font-bold">昵称：{ user?.nickname || "未获取" }</div>
                            <div className="text-sm opacity-50">QQ号：{ user?.user_id || "NaN" }</div>
                        </div>
                        <div className="space-y-2">
                            <div className="font-bold">协议信息：</div>
                            <div className="space-x-1">
                                <div className="badge badge-ghost">{ user?.app_name }</div>
                                <div className="badge badge-ghost">{ user?.app_version }</div>
                                <div className="badge badge-ghost">{ user?.protocol_version }</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
