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

export function getAuthParams(type = 'bbs') {
    const pathMap = {
        bbs: 'bbs/app/link/tree',
        pc: 'game/get_game_detail',
        console: 'game/console/get_game_detail',
        mobile: 'game/mobile/get_game_detail'
    }
    const path = pathMap[type] || pathMap.bbs;
    let timestamp = ~~(Date.now() / 1e3);
    let nonce = md5(timestamp + Math.random().toString()).toString().toLocaleUpperCase();
    let hkey = HA(path, timestamp + 1, nonce);
    return {
        version: "999.0.4",
        hkey: hkey,
        _time: timestamp,
        nonce: nonce
    }
}
