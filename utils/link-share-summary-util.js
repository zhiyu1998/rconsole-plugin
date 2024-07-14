import { SUMMARY_CONTENT_ESTIMATOR_PATTERNS } from "../constants/constant.js";

/**
 * 内容评估器
 * @link {linkShareSummary}
 * @param link 链接
 */
export function contentEstimator(link) {
    for (const pattern of SUMMARY_CONTENT_ESTIMATOR_PATTERNS) {
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