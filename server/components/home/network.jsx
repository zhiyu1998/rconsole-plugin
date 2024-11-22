import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const MAX_DATA_POINTS = 30;

export default function Network() {
    const [networkData, setNetworkData] = useState({
        uploadSpeed: 0,
        downloadSpeed: 0,
        totalSent: 0,
        totalReceived: 0
    });
    const [chartData, setChartData] = useState({
        labels: [],
        datasets: [
            {
                label: '上传速度 (KB/s)',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            },
            {
                label: '下载速度 (KB/s)',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            }
        ]
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/r/api/network2');
                const data = await response.json();

                setNetworkData({
                    uploadSpeed: data.uploadSpeed,
                    downloadSpeed: data.downloadSpeed,
                    totalSent: data.totalSent,
                    totalReceived: data.totalReceived
                });

                setChartData(prevData => {
                    const newLabels = [...prevData.labels, new Date().toLocaleTimeString()];
                    const newUploadData = [...prevData.datasets[0].data, data.uploadSpeed];
                    const newDownloadData = [...prevData.datasets[1].data, data.downloadSpeed];

                    // 保持最新的30个数据点
                    if (newLabels.length > MAX_DATA_POINTS) {
                        newLabels.shift();
                        newUploadData.shift();
                        newDownloadData.shift();
                    }

                    return {
                        labels: newLabels,
                        datasets: [
                            {
                                ...prevData.datasets[0],
                                data: newUploadData
                            },
                            {
                                ...prevData.datasets[1],
                                data: newDownloadData
                            }
                        ]
                    };
                });
            } catch (error) {
                console.error('获取网络数据失败:', error);
            }
        };

        // 每秒更新一次数据
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, []);

    const chartOptions = {
        responsive: true,
        animation: {
            duration: 0
        },
        scales: {
            y: {
                beginAtZero: true
            }
        },
        plugins: {
            legend: {
                position: 'top'
            }
        }
    };

    return (
        <div className="container mx-auto p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="card bg-base-100 shadow-xl col-span-1 lg:col-span-3">
                    <div className="card-body">
                        <h2 className="card-title text-lg font-bold">网络监控</h2>
                        <div className="flex justify-between mb-4">
                            <div>
                                <p>上传: {networkData.uploadSpeed} KB/s</p>
                                <p>下载: {networkData.downloadSpeed} KB/s</p>
                            </div>
                            <div>
                                <p>总发送: {networkData.totalSent} GB</p>
                                <p>总接收: {networkData.totalReceived} GB</p>
                            </div>
                        </div>
                        <div className="h-[300px]">
                            <Line data={chartData} options={chartOptions} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
