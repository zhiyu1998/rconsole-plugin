import os from 'os';

/**
 * 判断是否是公网地址
 * @param ip
 * @returns {boolean}
 */
function isPublicIP(ip) {
    if (ip.includes(':')) {
        // IPv6 检测
        if (ip.startsWith('fe80') || ip.startsWith('fc00')) {
            return false; // 本地链路或私有 IPv6
        }
        return true; // 其他 IPv6 认为是公网
    } else {
        // IPv4 检测
        const parts = ip.split('.').map(Number);
        if (
            (parts[0] === 10) || // 10.0.0.0/8
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
            (parts[0] === 192 && parts[1] === 168) // 192.168.0.0/16
        ) {
            return false; // 私有 IPv4
        }
        return true; // 其他 IPv4 认为是公网
    }
}

/**
 * 判断是否有公网 IPv6
 * @returns {boolean}
 */
export function hasIPv6Only() {
    const interfaces = os.networkInterfaces();
    let hasPublicIPv4 = false;
    let hasPublicIPv6 = false;

    for (const iface of Object.values(interfaces)) {
        for (const config of iface) {
            if (!config.internal && isPublicIP(config.address)) {
                if (config.family === 'IPv4') {
                    hasPublicIPv4 = true;
                }
                if (config.family === 'IPv6') {
                    hasPublicIPv6 = true;
                }
            }
        }
    }

    if (hasPublicIPv6 && !hasPublicIPv4) {
        logger.info('[R插件][公网检测]服务器仅拥有一个公网IPv6地址');
        return true;
    } else if (hasPublicIPv4 && hasPublicIPv6) {
        logger.info('[R插件][公网检测]服务器同时拥有公共IPv4和IPv6地址');
        return false;
    } else if (hasPublicIPv4) {
        logger.info('[R插件][公网检测]服务器仅拥有一个公网IPv4地址');
        return false;
    } else {
        logger.info('[R插件][公网检测]服务器未配置公网IP地址');
        return false;
    }
}

/**
 * 获取所有公网IP地址
 * @returns {*[]}
 */
export function getPublicIPs() {
    const interfaces = os.networkInterfaces();
    const publicIPs = [];

    for (const [name, iface] of Object.entries(interfaces)) {
        for (const config of iface) {
            if (!config.internal && isPublicIP(config.address)) {
                publicIPs.push({
                    interface: name,
                    address: config.address,
                    family: config.family,
                });
            }
        }
    }

    return publicIPs;
}

/**
 * 构造内网、公网消息
 * @returns {`R插件可视化面板内网地址：${string}:4016`}
 */
export function constructPublicIPsMsg() {
    const networkInterfaces = os.networkInterfaces();
    const ipAddress = Object.values(networkInterfaces)
        .flat()
        .filter(detail => detail.family === 'IPv4' && !detail.internal)[0].address;
    const publicIPs = getPublicIPs();
    let publicIPsStr = '';
    // 如果有公网地址
    if (publicIPs.length > 0) {
        publicIPsStr = `\n公网地址：${ getPublicIPs().map(item => {
            logger.info('[R插件][公网检测]公网IP地址', item.address);
            return `${ item.address }:4016\n`;
        }) }`;
    }
    publicIPsStr = `R插件可视化面板内网地址：${ ipAddress }:4016${ publicIPsStr }`;
    return publicIPsStr;
}
