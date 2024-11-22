import { promises as fs } from 'fs';
import os from 'os';
import si from 'systeminformation';

let lastBytesReceived = 0;
let lastBytesSent = 0;
let lastTimestamp = Date.now();
let isFirstRun = true;

async function getLinuxStats() {
    const data = await fs.readFile('/proc/net/dev', 'utf8');
    const lines = data.trim().split('\n');

    let bytesReceived = 0;
    let bytesSent = 0;

    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        const parts = line.split(/\s+/);

        if (parts[0].startsWith('lo:')) continue;

        bytesReceived += parseInt(parts[1], 10);
        bytesSent += parseInt(parts[9], 10);
    }

    return { bytesReceived, bytesSent };
}

async function getWindowsStats() {
    const networkStats = await si.networkStats();
    let bytesReceived = 0;
    let bytesSent = 0;

    for (const stat of networkStats) {
        bytesReceived += stat.rx_bytes || 0;
        bytesSent += stat.tx_bytes || 0;
    }

    return { bytesReceived, bytesSent };
}

async function getNetworkStats() {
    try {
        const platform = os.platform();
        let bytesReceived = 0;
        let bytesSent = 0;

        if (platform === 'linux') {
            const stats = await getLinuxStats();
            bytesReceived = stats.bytesReceived;
            bytesSent = stats.bytesSent;
        } else {
            const stats = await getWindowsStats();
            bytesReceived = stats.bytesReceived;
            bytesSent = stats.bytesSent;
        }

        const now = Date.now();
        const timeDiff = (now - lastTimestamp) / 1000;

        let downloadSpeed = 0;
        let uploadSpeed = 0;

        if (!isFirstRun) {
            // 检查是否发生了计数器重置或异常值
            if (bytesReceived >= lastBytesReceived && bytesSent >= lastBytesSent) {
                downloadSpeed = (bytesReceived - lastBytesReceived) / timeDiff;
                uploadSpeed = (bytesSent - lastBytesSent) / timeDiff;

                // 设置合理的上限值（比如 1GB/s）
                const MAX_SPEED = 1024 * 1024 * 1024; // 1 GB/s
                downloadSpeed = Math.min(downloadSpeed, MAX_SPEED);
                uploadSpeed = Math.min(uploadSpeed, MAX_SPEED);
            }
        }

        // 更新状态
        lastBytesReceived = bytesReceived;
        lastBytesSent = bytesSent;
        lastTimestamp = now;
        isFirstRun = false;

        return {
            downloadSpeed: (downloadSpeed / 1024).toFixed(2), // KB/s
            uploadSpeed: (uploadSpeed / 1024).toFixed(2), // KB/s
            totalReceived: (bytesReceived / (1024 * 1024 * 1024)).toFixed(2), // GB
            totalSent: (bytesSent / (1024 * 1024 * 1024)).toFixed(2), // GB
            timestamp: now
        };
    } catch (error) {
        console.error('获取网络统计信息失败:', error);
        return {
            downloadSpeed: "0",
            uploadSpeed: "0",
            totalReceived: "0",
            totalSent: "0",
            timestamp: Date.now()
        };
    }
}

export async function GET() {
    try {
        const stats = await getNetworkStats();
        return new Response(JSON.stringify(stats), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
