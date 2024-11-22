import React, { useEffect, useState } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { SYSTEM_BASE_URL } from "../../constants/api.js";

export default function System() {
    const [systemInfo, setSystemInfo] = useState(null);

    useEffect(() => {
        async function fetchSystemInfo() {
            const response = await fetch(SYSTEM_BASE_URL);
            const data = await response.json();
            setSystemInfo(data);
        }

        const intervalId = setInterval(fetchSystemInfo, 5000); // 每隔5秒更新一次系统信息

        return () => clearInterval(intervalId); // 清除定时器，避免内存泄漏
    }, []);

    return (
        <div className="container mx-auto p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 状态卡片 */ }
                <div className="card bg-base-100 shadow-xl col-span-1 lg:col-span-2">
                    <div className="card-body">
                        <h2 className="card-title text-lg font-bold">状态</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-5">
                            <div className="flex flex-col items-center">
                                <div style={ { width: 120, height: 120 } }>
                                    <CircularProgressbar
                                        value={ systemInfo ? parseFloat(systemInfo.cpuUsage) : 0 }
                                        text={ systemInfo ? systemInfo.cpuUsage + "%" : "" }
                                        styles={ buildStyles({
                                            textSize: '18px',
                                            pathColor: `rgba(62, 152, 199, ${ systemInfo ? parseFloat(systemInfo.cpuUsage) / 100 : 0 })`,
                                            textColor: '#3b82f6',
                                            trailColor: '#d6d6d6',
                                            backgroundColor: '#f0f0f0',
                                        }) }
                                    />
                                </div>
                                <span className="text mt-4">CPU</span>
                                <span
                                    className="text-sm mt-1">{ systemInfo ? `( ${ systemInfo.cpuCoresUsed } / ${ systemInfo.totalCpuCores } ) 核` : "" }</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div style={ { width: 120, height: 120 }}>
                                    <CircularProgressbar
                                        value={systemInfo ? parseFloat(systemInfo.memoryUsage) : 0}
                                        text={systemInfo ? systemInfo.memoryUsage + "%" : ""}
                                        styles={buildStyles({
                                            textSize: '18px',
                                            pathColor: `rgba(62, 152, 199, ${systemInfo ? parseFloat(systemInfo.memoryUsage) / 100 : 0})`,
                                            textColor: '#3b82f6',
                                            trailColor: '#d6d6d6',
                                            backgroundColor: '#f0f0f0',
                                        })}
                                    />
                                </div>
                                <span className="text mt-4">内存</span>
                                <span className="text-sm mt-1">{systemInfo ? `${systemInfo.usedMemory} / ${systemInfo.totalMemory}` : ""}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div style={{ width: 120, height: 120 }}>
                                    <CircularProgressbar
                                        value={systemInfo ? parseFloat(systemInfo.diskUsage) : 0}
                                        text={systemInfo ? systemInfo.diskUsage + "%" : ""}
                                        styles={buildStyles({
                                            textSize: '18px',
                                            pathColor: `rgba(62, 152, 199, ${systemInfo ? parseFloat(systemInfo.diskUsage) / 100 : 0})`,
                                            textColor: '#3b82f6',
                                            trailColor: '#d6d6d6',
                                            backgroundColor: '#f0f0f0',
                                        })}
                                    />
                                </div>
                                <span className="text mt-4">磁盘使用</span>
                                <span className="text-sm mt-1">{systemInfo ? `${systemInfo.usedDisk} / ${systemInfo.totalDisk}` : ""}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div style={{ width: 120, height: 120 }}>
                                    <CircularProgressbar
                                        value={systemInfo ? parseFloat(systemInfo.loadAverage) : 0}
                                        text={systemInfo ? systemInfo.loadAverage + "%" : ""}
                                        styles={buildStyles({
                                            textSize: '18px',
                                            pathColor: `rgba(62, 152, 199, ${systemInfo ? parseFloat(systemInfo.loadAverage) / 100 : 0})`,
                                            textColor: '#3b82f6',
                                            trailColor: '#d6d6d6',
                                            backgroundColor: '#f0f0f0',
                                        })}
                                    />
                                </div>
                                <span className="text mt-4">负载</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 系统信息卡片 */ }
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title text-lg font-bold">系统信息</h2>
                        <p className="text">主机名称: {systemInfo ? systemInfo.hostname : ""}</p>
                        <p className="text">发行版本: {systemInfo ? systemInfo.distro : ""}</p>
                        <p className="text">内核版本: {systemInfo ? systemInfo.kernelVersion : ""}</p>
                        <p className="text">系统类型: {systemInfo ? systemInfo.arch : ""}</p>
                        <p className="text">主机地址: {systemInfo ? systemInfo.ipAddress : ""}</p>
                        <p className="text">运行时间: {systemInfo ? systemInfo.uptime : ""}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
