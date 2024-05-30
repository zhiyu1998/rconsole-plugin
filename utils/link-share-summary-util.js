/**
 * 内容评估器
 * @link {weixin}
 * @param link 链接
 */
export function contentEstimator(link) {
    const wxReg = /(?:https?:\/\/)?mp\.weixin\.qq\.com\/[A-Za-z\d._?%&+\-=\/#]*/;
    const arxivReg = /(?:https?:\/\/)?arxiv.org\/[a-zA-Z\d._?%&+\-=\/#]*/;
    const sspaiReg = /(?:https?:\/\/)?sspai.com\/[a-zA-Z\d._?%&+\-=\/#]*/;
    if (wxReg.test(link)) {
        return {
            name: '微信文章',
            summaryLink: wxReg.exec(link)?.[0]
        };
    } else if (arxivReg.test(link)) {
        return {
            name: 'ArXiv论文',
            summaryLink: arxivReg.exec(link)?.[0]
        };
    } else if (sspaiReg.test(link)) {
        return {
            name: '少数派',
            summaryLink: sspaiReg.exec(link)?.[0]
        }
    } else {
        logger.error("[R插件][总结模块] 内容评估出错...");
        throw Error("内容评估出错...");
    }
}
