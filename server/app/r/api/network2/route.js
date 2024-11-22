import os from 'os';

let lastBytesReceived = 0;
let lastBytesSent = 0;
let lastTimestamp = Date.now();

function getNetworkStats() {
    const networkInterfaces = os.networkInterfaces();
    let bytesReceived = 0;
    let bytesSent = 0;

    // 累加所有网络接口的数据
    Object.values(networkInterfaces).forEach(interfaces => {
        interfaces.forEach(netInterface => {
            if (netInterface.internal === false) {
                bytesReceived += netInterface.bytes_received || 0;
                bytesSent += netInterface.bytes_sent || 0;
            }
        });
    });

    const now = Date.now();
    const timeDiff = (now - lastTimestamp) / 1000; // 转换为秒

    // 计算速率（字节/秒）
    const downloadSpeed = (bytesReceived - lastBytesReceived) / timeDiff;
    const uploadSpeed = (bytesSent - lastBytesSent) / timeDiff;

    // 更新上次的值
    lastBytesReceived = bytesReceived;
    lastBytesSent = bytesSent;
    lastTimestamp = now;

    return {
        downloadSpeed: (downloadSpeed / 1024).toFixed(2), // KB/s
        uploadSpeed: (uploadSpeed / 1024).toFixed(2), // KB/s
        totalReceived: (bytesReceived / (1024 * 1024 * 1024)).toFixed(2), // GB
        totalSent: (bytesSent / (1024 * 1024 * 1024)).toFixed(2), // GB
        timestamp: now
    };
}

export async function GET() {
    try {
        const stats = getNetworkStats();
        return new Response(JSON.stringify(stats), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
