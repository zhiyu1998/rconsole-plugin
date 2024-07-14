/**
 * 内容评估器
 * @link {weixin}
 * @param link 链接
 */
export function contentEstimator(link) {
    const patterns = [
        { reg: /(?:https?:\/\/)?mp\.weixin\.qq\.com\/[A-Za-z\d._?%&+\-=\/#]*/, name: '微信文章' },
        { reg: /(?:https?:\/\/)?arxiv.org\/[a-zA-Z\d._?%&+\-=\/#]*/, name: 'ArXiv论文' },
        { reg: /(?:https?:\/\/)?sspai.com\/[a-zA-Z\d._?%&+\-=\/#]*/, name: '少数派' },
        { reg: /(?:https?:\/\/)?www\.bilibili\.com\/read\/[A-Za-z\d._?%&+\-=\/#]*/, name: '哔哩哔哩专栏' },
        { reg: /(?:https?:\/\/)?(www\.)chinadaily.com.cn\/a\/[a-zA-Z0-9\d._?%&+\-=\/#]*/, name: 'ChinaDaily' }
    ];

    for (const pattern of patterns) {
        if (pattern.reg.test(link)) {
            return {
                name: pattern.name,
                summaryLink: pattern.reg.exec(link)?.[0]
            };
        }
    }

    logger.error("[R插件][总结模块] 内容评估出错...");
    throw Error("内容评估出错...");
}
