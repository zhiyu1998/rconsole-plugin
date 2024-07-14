/**
 * 内容评估器
 * @link {weixin}
 * @param link 链接
 */
export function contentEstimator(link) {
    const wxReg = /(?:https?:\/\/)?mp\.weixin\.qq\.com\/[A-Za-z\d._?%&+\-=\/#]*/;
    const arxivReg = /(?:https?:\/\/)?arxiv.org\/[a-zA-Z\d._?%&+\-=\/#]*/;
    const chinaDailyReg = /(?:https?:\/\/)?(www\.)chinadaily.com.cn\/a\/[a-zA-Z0-9\d._?%&+\-=\/#]*/;
    const sspaiReg = /(?:https?:\/\/)?sspai.com\/[a-zA-Z\d._?%&+\-=\/#]*/;
    const biliReadReg = /(?:https?:\/\/)?www\.bilibili\.com\/read\/[A-Za-z\d._?%&+\-=\/#]*/;
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
    } else if (biliReadReg.test(link)) {
        return {
            name: '哔哩哔哩专栏',
            summaryLink: biliReadReg.exec(link)?.[0]
        }
    } else if (chinaDailyReg.test(link)) {
        return {
            name: 'ChinaDaily',
            summaryLink: chinaDailyReg.exec(link)?.[0]
        }
    } else {
        logger.error("[R插件][总结模块] 内容评估出错...");
        throw Error("内容评估出错...");
    }
}
