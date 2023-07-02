import axios from "axios";


/**
 * 获取易书下载的来源
 * @param keyword 书名
 * @returns {Promise<Array>}
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
 * @returns {Promise<Array>}
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

/**
 * 获取ZHelper的数据
 * @param e
 * @param keyword
 * @returns {Promise<Array>}
 */
async function getZHelper(e, keyword) {
    const LIMIT = 5;

    const sendTemplate = {
        nickname: e.sender.card || e.user_id,
        user_id: e.user_id,
    };
    const anna = axios
        .post("https://anna.bookpan.net/api/search/", {
            headers: {
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1660.14",
                referer: "https://search.zhelper.net/",
            },
            keyword: keyword,
            page: 1,
            sensitive: false,
        })
    const slib2 = axios
        .post("https://slib2.ylibrary.org/api/search/", {
            headers: {
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1660.14",
                referer: "https://search.zhelper.net/",
            },
            keyword: keyword,
            page: 1,
            sensitive: false,
        })
    // 组合数据
    return Promise.allSettled([slib2, anna]).then(async resp => {
        // 解析第一个数据
        const slib2Data = await resp[0].value.data.data.slice(0, LIMIT).map(item => {
            const { code, download_link, info } = item;
            const { name, url } = download_link?.[0];
            // 数据组合
            return {
                message: {
                    type: "text",
                    text: `标题: ${info}\n`+
                        `${name}: ${url}`
                },
                ...sendTemplate,
            }
        })
        // 解析第一个数据
        const annaDataPromises = resp[1].value.data.data.slice(0, LIMIT).map(async (item)  => {
            const { author, cover, extension, id, link, publisher, sizestring, source, title } = item;
            // 固定一个模板
            let resBooks = `<${title}> 作者：${author} 书籍类型：${extension}\n` +
                    `来源：${source}\n` +
                    `出版社：${publisher}\n` +
                    `文件大小：${sizestring}`;
            // 发送一个需要下载链接的请求
            const downloadLink = await getDownloadLink(id);

            resBooks += `\n${downloadLink}`;
            return {
                message: {
                    type: "text",
                    text: resBooks
                },
                ...sendTemplate,
            }
        })
        // 合并数据
        const annaData = await Promise.all(annaDataPromises);

        return [...slib2Data, ...annaData];
    })
}

async function getDownloadLink(id) {
    if (id === undefined || id === "") {
        return "";
    }

    const resp = await axios.post("https://anna.bookpan.net/api/detail/", {
        headers: {
            "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1660.14",
            referer: "https://search.zhelper.net/",
        },
        id: id,
        source: "anna",
    });

    const { download_link } = resp.data;

    const links = download_link.slice(0, 2).map((item, index) => {
        return `直链 #${index + 1}: ${encodeURIComponent(item?.url)}\n\n`
    })

    return `\n${links}`;
}

export { getYiBook, getZBook, getZHelper };
