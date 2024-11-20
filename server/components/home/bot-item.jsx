import { getStatus, getUserInfo, getVersionInfo } from "../../utils/napact.js";
import React, { useEffect, useState } from "react";

export function BotItem() {

    const [user, setUser] = useState({ user_id: null, nickname: '' });

    const [status, setStatus] = useState({ online: false, good: false, stat: {} });

    const [versionInfo, setVersionInfo] = useState({ app_name: "", app_version: "", protocol_version: "" });

    useEffect(() => {
        getUserInfo().then(setUser);
        getStatus().then(setStatus);
        getVersionInfo().then(setVersionInfo);
    }, []);

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title">🐔状态</h2>
                <div className="flex flex-row pt-5 justify-between items-center">
                    <div className={ `avatar ${ status.online ? "online" : "offline" }` }>
                        <div className="w-24 rounded-full">
                            <img src={ `http://q1.qlogo.cn/g?b=qq&nk=${ user.user_id }&s=100` }/>
                        </div>
                    </div>
                    <div className="flex flex-col ml-12 space-y-2">
                        <div className="space-y-2">
                            <div className="font-bold">昵称：{ user.nickname || "未获取" }</div>
                            <div className="text-sm opacity-50">QQ号：{ user.user_id || "NaN" }</div>
                        </div>
                        <div className="space-y-2">
                            <div className="font-bold">协议信息：</div>
                            <div className="space-x-1">
                                <div className="badge badge-ghost">{ versionInfo.app_name }</div>
                                <div className="badge badge-ghost">{ versionInfo.app_version }</div>
                                <div className="badge badge-ghost">{ versionInfo.protocol_version }</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
