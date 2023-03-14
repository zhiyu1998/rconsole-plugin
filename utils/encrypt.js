// AES加密
import crypto from "crypto";

const key = crypto.createHash("sha256").update("rconsole").digest();

/**
 * AES解密
 * @param ha1
 * @returns {Promise<string>}
 */
async function ha12store(ha1) {
    // IV.E
    const iv = crypto.randomBytes(16);
    const c = crypto.createCipheriv("aes-256-cbc", key, iv);
    let e = c.update(ha1, "binary", "hex");
    e += c.final("hex");
    return iv.toString("hex") + "." + e;
}

/**
 * AES解密
 * @param passstore
 * @returns {Promise<string>}
 */
async function store2ha1(passstore) {
    try {
        const parts = passstore.split(".");
        if (parts.length === 2) {
            // 新的加密方式 with IV: IV.E
            const c = crypto.createDecipheriv(
                "aes-256-cbc",
                key,
                Buffer.from(parts[0], "hex")
            );
            let d = c.update(parts[1], "hex", "binary");
            d += c.final("binary");
            return d;
        } else {
            // 旧加密方式 without IV: E
            const c = crypto.createDecipher("aes192", key);
            let d = c.update(passstore, "hex", "binary");
            d += c.final("binary");
            return d;
        }
    } catch (e) {
        console.log(
            "在[default]部分设置的passwordSecret无法解密信息。请确保所有节点的passwordSecret相同。如果您更改了密码保密信息，可能需要重新添加用户。",
            e
        );
        process.exit(1);
    }
}

export {
    ha12store,
    store2ha1
}