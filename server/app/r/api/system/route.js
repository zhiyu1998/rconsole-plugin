import si from 'systeminformation';
import os from 'os';

export async function GET(request, { params }) {
    try {
        // 获取CPU信息
        const cpuInfo = await si.cpu();
        const cpuUsage = await si.currentLoad();
        const totalCpuCores = cpuInfo.cores;
        const cpuCoresUsed = ((cpuUsage.currentLoad / 100) * totalCpuCores).toFixed(1); // 使用的核心数

        // 获取内存信息
        const totalMemory = (os.totalmem() / (1024 ** 3)).toFixed(2); // 转换为 GB
        const freeMemory = (os.freemem() / (1024 ** 3)).toFixed(2); // 转换为 GB
        const usedMemory = (totalMemory - freeMemory).toFixed(2);
        const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);

        // 获取磁盘信息
        const diskInfo = await si.fsSize();
        const totalDisk = (diskInfo[0].size / (1024 ** 3)).toFixed(2); // 转换为 GB
        const usedDisk = (diskInfo[0].used / (1024 ** 3)).toFixed(2); // 转换为 GB
        const diskUsagePercent = ((usedDisk / totalDisk) * 100).toFixed(2);

        // 获取网络信息
        const networkInterfaces = os.networkInterfaces();
        const ipAddress = Object.values(networkInterfaces)
            .flat()
            .filter(detail => detail.family === 'IPv4' && !detail.internal)[0].address;

        // 获取系统信息
        const hostname = os.hostname();
        const uptime = os.uptime();
        const osInfo = await si.osInfo();

        return new Response(JSON.stringify({
            cpuUsage: cpuUsage.currentLoad.toFixed(2),
            cpuUsageDetail: `${cpuUsage.currentLoad.toFixed(2)}%`,
            totalCpuCores,
            cpuCoresUsed,
            memoryUsage: memoryUsagePercent,
            usedMemory: `${usedMemory} GB`,
            totalMemory: `${totalMemory} GB`,
            diskUsage: diskUsagePercent,
            usedDisk: `${usedDisk} GB`,
            totalDisk: `${totalDisk} GB`,
            loadAverage: cpuUsage.avgLoad.toFixed(2),
            ipAddress,
            hostname,
            uptime: `${Math.floor(uptime / 60 / 60)} hours`,
            distro: osInfo.distro,
            kernelVersion: osInfo.kernel,
            arch: os.arch(),
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
