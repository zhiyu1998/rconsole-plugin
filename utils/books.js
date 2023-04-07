import axios from "axios";


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
        .get(`https://zbook.lol/search?title=${encodeURIComponent(keyword)}&limit=10`)
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
                            `其他下载直链：${bookDownloadUrls.join("\n\n")}`,
                    },
                    ...sendTemplate,
                };
            });
        });
}

export { getYiBook, getZBook };
