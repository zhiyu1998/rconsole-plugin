export function genVerifyFp() {
    const baseStr = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const t = baseStr.length;
    let milliseconds = Date.now(); // 获取当前的时间戳（毫秒）
    let base36 = "";

    // 将时间戳转换为base36
    while (milliseconds > 0) {
        let remainder = milliseconds % 36;
        if (remainder < 10) {
            base36 = remainder.toString() + base36;
        } else {
            base36 = String.fromCharCode('a'.charCodeAt(0) + remainder - 10) + base36;
        }
        milliseconds = Math.floor(milliseconds / 36);
    }

    const r = base36;
    let o = new Array(36).fill("");
    o[8] = o[13] = o[18] = o[23] = "_";
    o[14] = "4";

    // 生成随机字符
    for (let i = 0; i < 36; i++) {
        if (!o[i]) {
            let n = Math.floor(Math.random() * t);
            if (i === 19) {
                n = (3 & n) | 8;
            }
            o[i] = baseStr[n];
        }
    }

    return "verify_" + r + "_" + o.join("");
}

