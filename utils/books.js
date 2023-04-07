import axios from "axios";
import HttpProxyAgent from "https-proxy-agent";

/**
 * 获取ZHelper的数据
 * @param keyword
 * @returns {Promise<AxiosResponse<any>>}
 */
async function getZHelper(e, keyword) {
    const sendTemplate = {
        nickname: e.sender.card || e.user_id,
        user_id: e.user_id,
    };
    return axios
        .post("https://api.ylibrary.org/api/search/", {
            headers: {
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1660.14",
                referer: "https://search.zhelper.net/",
            },
            keyword: keyword,
            page: 1,
            sensitive: false,
        })
        .then(async resp => {
            return resp.data.data.map(item => {
                const { title, author, publisher, isbn, extension, filesize, year, id, source } =
                    item;
                // 数据组合
                return {
                    message: {
                        type: "text",
                        text:
                            `${id}: <${title}>\n` +
                            `作者：${author}\n` +
                            `书籍类型：${extension}\n` +
                            `出版年月：${year}\n` +
                            `来源：${source}\n` +
                            `ISBN：${isbn || "暂无"}\n` +
                            `出版社：${publisher}\n` +
                            `文件大小：${(Number(filesize) / 1024 / 1024).toFixed(2)}MB`,
                    },
                    ...sendTemplate,
                };
            });
        });
}

/**
 * 获取易书下载的来源
 * @param keyword 书名
 * @returns {Promise<void>}
 */
async function getYiBook(e, keyword) {
    const sendTemplate = {
        nickname: e.sender.card || this.e.user_id,
        user_id: e.user_id,
    };
    // 下载字典（异步去执行）
    return axios
        .post("https://worker.zlib.app/api/search/", {
            headers: {
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1660.14",
                referer: "https://search.zhelper.net/",
            },
            keyword: keyword,
            page: 1,
            sensitive: false,
        })
        .then(async resp => {
            return resp.data.data.map(item => {
                const {
                    author,
                    cover,
                    extension,
                    filesize,
                    hash,
                    id,
                    pages,
                    publisher,
                    source,
                    title,
                    year,
                    zlib_download,
                } = item;
                return {
                    message: {
                        type: "text",
                        text:
                            `<${title}>\n` +
                            `作者：${author}\n` +
                            `书籍类型：${extension}\n` +
                            `出版年月：${year}\n` +
                            `来源：${source}\n` +
                            `出版社：${publisher}\n` +
                            `文件大小：${(Number(filesize) / 1024 / 1024).toFixed(2)}MB\n` +
                            `下载直链：https://worker.zlib.app/download/${item.id}`,
                    },
                    ...sendTemplate,
                };
            });
        });
}

/**
 * 获取书籍下载方式
 * @param e
 * @param id
 * @param source
 * @returns {Promise<AxiosResponse<any>>}
 */
async function getBookDetail(e, id, source) {
    return axios
        .post("https://api.ylibrary.org/api/detail/", {
            headers: {
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1660.14",
                referer: "https://search.zhelper.net/",
            },
            id: id,
            source: source || "zlibrary",
        })
        .then(async resp => {
            const {
                author,
                extension,
                filesize,
                id,
                in_libgen,
                ipfs_cid,
                md5,
                publisher,
                source,
                title,
                year,
            } = resp.data;
            const Libgen = `https://libgendown.1kbtool.com/${md5}`;
            const ipfs = `https://ipfs-checker.1kbtool.com/${ipfs_cid}?filename=${encodeURIComponent(
                title,
            )}_${source}-search.${extension}`;
            const reqUrl = `${md5}#${filesize}#${encodeURIComponent(title)}_${encodeURIComponent(
                author,
            )}_${id}_${source}-search.${extension}`;
            const cleverPass = `https://rapidupload.1kbtool.com/${reqUrl}`;
            const cleverPass2 = `https://rulite.1kbtool.com/${reqUrl}`;
            return [
                `Libgen：${Libgen}`,
                `ipfs：${ipfs}`,
                `秒传：${cleverPass}`,
                `秒传Lite：${cleverPass2}`,
            ].map(item => {
                return {
                    message: { type: "text", text: item },
                    nickname: e.sender.card || e.user_id,
                    user_id: e.user_id,
                };
            });
        });
}

/**
 * ZBook的下载网址
 * @type {string[]}
 */
const zBookDownloadUrl = [
    "https://cloudflare-ipfs.com/ipfs/",
    "https://dweb.link/ipfs/",
    "https://ipfs.io/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://ipfs.best-practice.se/ipfs/",
    "https://ipfs.joaoleitao.org/ipfs/",
];

/**
 * 获取ZBook的数据
 * @returns {Promise<void>}
 */
async function getZBook(e, keyword) {
    const sendTemplate = {
        nickname: e.sender.card || this.e.user_id,
        user_id: e.user_id,
    };
    return axios
        .get(`https://zbook.lol/search?title=${encodeURIComponent(keyword)}&limit=20`)
        .then(resp => {
            return resp.data.books.map(item => {
                const {
                    id,
                    title,
                    author,
                    publisher,
                    extension,
                    filesize,
                    language,
                    year,
                    pages,
                    isbn,
                    ipfs_cid,
                    cover,
                } = item;
                const bookDownloadUrls = zBookDownloadUrl.map(
                    url => {
                        const filename = `${title}_[${language}]${author}`
                        return `${url}${ipfs_cid}?filename=${encodeURIComponent(
                            filename
                        )}.${extension}`
                    }
                );
                // const { url, speed } = await findFastestUrl(bookDownloadUrls);
                return {
                    message: {
                        type: "text",
                        text:
                            `${id}: <${title}>\n` +
                            `作者：${author}\n` +
                            `书籍类型：${extension}\n` +
                            `出版年月：${year}\n` +
                            `语言：${language}\n` +
                            `页数：${pages}\n` +
                            `ISBN：${isbn || "暂无"}\n` +
                            `出版社：${publisher}\n` +
                            `文件大小：${(Number(filesize) / 1024 / 1024).toFixed(2)}MB\n\n` +
                            // `竞速下载：最快链接-${url}, 预计下载速度：${speed}\n` +
                            `其他下载直链：${bookDownloadUrls.join("\n")}`,
                    },
                    ...sendTemplate,
                };
            });
        });
}

async function measureDownloadSpeed(url) {
    const startTime = performance.now();
    const response = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36",
        },
        agent: new HttpProxyAgent("http://127.0.0.1:7890"),
    });

    if (!response.ok) {
        throw new Error(`Error fetching ${url}: ${response.status}`);
    }

    const contentLength = response.headers.get("content-length") || 0;

    // Instead of using response.buffer(), we will use response.body to read data
    const data = [];
    for await (const chunk of response.body) {
        data.push(chunk);
    }
    const buffer = Buffer.concat(data);

    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000; // in seconds
    const speed = contentLength / 1024 / duration; // in KB/s

    return {
        url,
        speed,
    };
}

/**
 * 链接竞速，暂时不做，浪费网页流量，保护接口
 * @param urls
 * @returns {Promise<unknown extends (object & {then(onfulfilled: infer F): any}) ? (F extends ((value: infer V, ...args: any) => any) ? Awaited<V> : never) : unknown>}
 */
async function findFastestUrl(urls) {
    const promises = urls.map(url =>
        measureDownloadSpeed(url).catch(error => {
            console.error(error);
            return { url, speed: 0 };
        }),
    );

    const results = await Promise.all(promises);
    results.sort((a, b) => b.speed - a.speed);
    return results[0];
}

export { getYiBook, getZHelper, getBookDetail, getZBook };
