import React from 'react';
import BotInfo from "../home/bot-info.jsx";
import System from "../home/system.jsx";

export default function Home({  }) {
    return (
        <div className="container mx-auto p-8">
            <BotInfo />
            <System />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 监控卡片 */ }
                <div className="card bg-base-100 shadow-xl col-span-1 lg:col-span-3">
                    <div className="card-body">
                        <h2 className="card-title text-lg font-bold">监控</h2>
                        <div className="flex justify-between">
                            <div>
                                <p>上传: 0.87 KB/s</p>
                                <p>下载: 3.21 KB/s</p>
                            </div>
                            <div>
                                <p>总发送: 21.17 GB</p>
                                <p>总接收: 90.46 GB</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
