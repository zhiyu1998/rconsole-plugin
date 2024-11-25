import { unstable_noStore as noStore } from 'next/cache';
import { promises as fs } from 'fs';
import os from 'os';
import si from 'systeminformation';

let lastBytesReceived = 0;
let lastBytesSent = 0;
let lastTimestamp = Date.now();

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

        const downloadSpeed = Math.max(0, (bytesReceived - lastBytesReceived) / timeDiff);
        const uploadSpeed = Math.max(0, (bytesSent - lastBytesSent) / timeDiff);

        lastBytesReceived = bytesReceived;
        lastBytesSent = bytesSent;
        lastTimestamp = now;

        return {
            downloadSpeed: (downloadSpeed / 1024).toFixed(2),
            uploadSpeed: (uploadSpeed / 1024).toFixed(2),
            totalReceived: (bytesReceived / (1024 * 1024 * 1024)).toFixed(2),
            totalSent: (bytesSent / (1024 * 1024 * 1024)).toFixed(2),
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
    // 这个不允许删除，否则无法做到实时获取
    noStore();
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
