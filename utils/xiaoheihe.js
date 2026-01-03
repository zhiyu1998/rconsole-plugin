import crypto from 'crypto';

const SALT = "AB45STUVWZEFGJ6CH01D237IXYPQRKLMN89";

function md5(data) {
    return crypto.createHash('md5').update(data).digest('hex');
}

function DA(e) { return 128 & e ? 255 & (e << 1 ^ 27) : e << 1 }
function BA(e) { return DA(e) ^ e }
function NA(e) { return BA(DA(e)) }
function FA(e) { return NA(BA(DA(e))) }
function UA(e) { return FA(e) ^ NA(e) ^ BA(e) }

function zA(e, t, n) {
    let r = "", i = t.slice(0, n);
    for (let o = 0; o < e.length; o++) {
        r += i[e.charCodeAt(o) % i.length]
    }
    return r
}

function WA(e, t) {
    let n = "";
    for (let r = 0; r < e.length; r++) {
        n += t[e.charCodeAt(r) % t.length]
    }
    return n
}

function HA(path, timestamp, nonce) {
    path = `/${path.split("/").filter(e => e).join("/")}/`;

    const i = function (e) {
        let t = "";
        for (let n = 0; n < Math.max(...e.map(e => e.length)); n++) e.forEach(e => {
            n < e.length && (t += e[n])
        });
        return t
    }([zA(String(timestamp), SALT, -2), WA(path, SALT), WA(nonce, SALT)]).slice(0, 20);

    const o = md5(i).toString();

    let a = "" + function (e) {
        let t = [0, 0, 0, 0];
        return t[0] = UA(e[0]) ^ FA(e[1]) ^ NA(e[2]) ^ BA(e[3]),
            t[1] = BA(e[0]) ^ UA(e[1]) ^ FA(e[2]) ^ NA(e[3]),
            t[2] = NA(e[0]) ^ BA(e[1]) ^ UA(e[2]) ^ FA(e[3]),
            t[3] = FA(e[0]) ^ NA(e[1]) ^ BA(e[2]) ^ UA(e[3]),
            e[0] = t[0], e[1] = t[1], e[2] = t[2], e[3] = t[3], e
    }(o.slice(-6).split("").map(e => e.charCodeAt())).reduce((e, t) => e + t, 0) % 100;

    a = a.length < 2 ? `0${a}` : a;
    return `${zA(o.substring(0, 5), SALT, -4)}${a}`;
}

/**
 * 获取小黑盒完整的API请求参数
 * @param {string} type - 请求类型 ('bbs', 'pc', 'console', 'mobile')
 * @param {string} id - 帖子的 link_id 或 游戏的 appid/steam_appid
 * @returns {object} 可直接用于axios请求的params对象
 */
export function getApiParams(type, id) {
    const pathMap = {
        bbs: 'bbs/app/link/tree',
        pc: 'game/get_game_detail',
        console: 'game/console/get_game_detail',
        mobile: 'game/mobile/get_game_detail'
    }
    const path = pathMap[type] || pathMap.bbs;
    const timestamp = ~~(Date.now() / 1e3);
    const nonce = md5(timestamp + Math.random().toString()).toString().toLocaleUpperCase();
    const hkey = HA(path, timestamp + 1, nonce);
    const authParams = {
        version: "999.0.4",
        hkey: hkey,
        _time: timestamp,
        nonce: nonce
    };
    let baseParams = {
        os_type: "web",
        ...authParams
    };
    switch (type) {
        case 'bbs':
            return {
                ...baseParams,
                link_id: id,
                limit: 20,
                web_version: '2.5',
                x_client_type: 'web',
                x_app: 'heybox_website',
                x_os_type: 'Android',
            };
        case 'pc':
            return {
                ...baseParams,
                steam_appid: id,
            };
        case 'console':
        case 'mobile':
            return {
                ...baseParams,
                appid: id,
            };
        default:
            return baseParams;
    }
}

/**
 * 利用小黑盒CDN特性获得原图
 * @param {string} url - 原始URL
 * @returns {string} 末尾添加反斜杠后的URL
 */
export function optimizeImageUrl(url) {
    if (!url) return url;
    // 只对包含查询参数(?)的URL添加反斜杠
    // 不带查询参数的URL直接返回 避免路径错误
    return url.includes('?') ? url + '\\' : url;
}
