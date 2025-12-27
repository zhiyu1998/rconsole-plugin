import axios from 'axios';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const base62_encode = (number) => {
    if (number === 0) return '0';
    let result = '';
    while (number > 0) {
        result = ALPHABET[number % 62] + result;
        number = Math.floor(number / 62);
    }
    return result;
};

export const mid2id = (mid) => {
    mid = mid.toString().split('').reverse().join('');
    const size = Math.ceil(mid.length / 7);
    let result = [];
    for (let i = 0; i < size; i++) {
        let s = mid.slice(i * 7, (i + 1) * 7).split('').reverse().join('');
        s = base62_encode(parseInt(s, 10));
        if (i < size - 1 && s.length < 4) {
            s = '0'.repeat(4 - s.length) + s;
        }
        result.push(s);
    }
    result.reverse();
    return result.join('');
};

const getHeaders = (cookie = '') => {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://weibo.com/',
    };
    if (cookie) headers['Cookie'] = cookie;
    return headers;
};

export async function getWeiboData(id, cookie = '') {
    const headers = getHeaders(cookie);
    const resp = await axios.get(`https://m.weibo.cn/detail/${id}`, { headers, timeout: 10000 });
    const html = typeof resp.data === 'string' ? resp.data : '';

    let data = null;

    const match = html.match(/"status":\s*([\s\S]+?),\s*"call"/);
    if (match?.[1]) {
        try { data = JSON.parse(match[1]); } catch { }
    }

    if (!data) {
        const renderMatch = html.match(/\$render_data\s*=\s*\[([\s\S]+?)\]\[0\]/);
        if (renderMatch?.[1]) {
            try { data = JSON.parse('[' + renderMatch[1] + ']')[0]?.status; } catch { }
        }
    }

    if (!data) {
        const apiResp = await axios.get(`https://m.weibo.cn/statuses/show?id=${id}`, {
            headers: { ...headers, 'X-Requested-With': 'XMLHttpRequest' },
            timeout: 10000
        });
        data = apiResp.data?.data;
    }

    return data;
}

export async function getWeiboComments(id, cookie = '', maxCount = 20) {
    const headers = getHeaders(cookie);
    headers['X-Requested-With'] = 'XMLHttpRequest';

    try {
        const resp = await axios.get(`https://m.weibo.cn/comments/hotflow?id=${id}&mid=${id}&max_id_type=0`, {
            headers,
            timeout: 10000
        });

        const comments = resp.data?.data?.data || [];
        return comments.slice(0, maxCount).map(c => {
            // 格式化时间
            let time = c.created_at || '';
            try {
                const d = new Date(time);
                if (!isNaN(d)) {
                    time = `${d.getFullYear().toString().slice(2)}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }
            } catch { }

            return {
                user: c.user?.screen_name || '',
                uid: c.user?.id || 0,
                text: (c.text || '').replace(/<[^>]+>/g, ''),
                like: c.like_count || 0,
                time,
                source: c.source || ''
            };
        });
    } catch {
        return [];
    }
}

export async function getWeiboVoteImages(uid, id, cookie = '') {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://weibo.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
    if (cookie) headers['Cookie'] = cookie;

    try {
        // 请求桌面版HTML页面（需要 uid/id 格式）
        const resp = await axios.get(`https://weibo.com/${uid}/${id}`, { headers, timeout: 15000 });
        const html = typeof resp.data === 'string' ? resp.data : '';

        const images = [];
        // 匹配所有 sinaimg 图片
        const matches = html.matchAll(/https?:\/\/wx\d\.sinaimg\.cn\/[a-z0-9]+\/[^"'\s]+\.jpg/gi);
        for (const m of matches) {
            let url = m[0];
            // 过滤头像等小图，只要内容图片
            if ((url.includes('bmiddle') || url.includes('large') || url.includes('mw2000') || url.includes('orj')) && !images.includes(url)) {
                // 替换为 large 格式（mw2000需要登录会403）
                url = url.replace(/\/bmiddle\//, '/large/').replace(/\/mw2000\//, '/large/').replace(/\/orj\d+\//, '/large/');
                if (!images.includes(url)) images.push(url);
            }
        }

        // 如果从HTML获取失败，尝试API
        if (images.length === 0) {
            const apiResp = await axios.get(`https://weibo.com/ajax/statuses/show?id=${id}`, { headers, timeout: 10000 });
            const jsonStr = JSON.stringify(apiResp.data);
            const apiMatches = jsonStr.matchAll(/https?:\/\/[^"]+sinaimg[^"]+/g);
            for (const m of apiMatches) {
                let url = m[0].replace(/\\\//g, '/');
                if ((url.includes('bmiddle') || url.includes('large')) && !images.includes(url)) {
                    images.push(url);
                }
            }
        }

        return images;
    } catch (e) {
        console.log('[微博] 获取投票图片失败:', e.message);
        return [];
    }
}
