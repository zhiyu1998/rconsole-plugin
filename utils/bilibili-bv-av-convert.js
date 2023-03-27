const table = 'fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF'
const tr = Array.from(table).reduce((o, c, i) => Object.assign(o, { [c]: i }), {})
const s = [11, 10, 3, 8, 4, 6]
const xor = 177451812
const add = 8728348608
/** 算法来源：https://www.zhihu.com/question/381784377/answer/1099438784 **/

/**
 * Convert a BV string to AV number
 * @param {string} bv The BV string to be converted to AV number
 * @returns {number} The AV number converted from the provided BV string
 */
function bv2AV(bv) {
    return (new Uint8Array(6).reduce((r, _, i) => r + tr[bv[s[i]]] * 58 ** i, 0) - add) ^ xor
}

/**
 * Convert a AV number to BV string
 * @param {number} av The AV number to be converted to BV string
 * @returns {string} The BV string converted from the provided AV number
 */
function av2BV(av) {
    return (new Uint8Array(6).reduce((r, _, i) => { r.splice(s[i], 1, table[Math.floor(((av ^ xor) + add) / 58 ** i % 58)]); return r }, Array.from('BV1  4 1 7  '))).join('')
}

export {
    bv2AV,
    av2BV
}
