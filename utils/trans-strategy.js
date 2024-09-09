import { tencentTransMap } from "../constants/constant.js";
import fetch from "node-fetch";
import _ from 'lodash'

// 定义翻译策略接口
class TranslateStrategy {
    async translate(query, targetLanguage) {
        throw new Error("This method should be implemented by subclasses");
    }
}

// 企鹅翻译策略
class TencentTranslateStrategy extends TranslateStrategy {
    constructor(config) {
        super();
        this.config = config;
        this.url = "https://transmart.qq.com/api/imt";
        this.commonHeaders = {
            "USER-AGENT": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/111.0"
        };
        this.clientKey = "browser-firefox-111.0.0-Mac OS-d35fca23-eb48-45ba-9913-114f1177b02b-1679376552800";
    }

    async detectLanguage(query) {
        try {
            const response = await fetch(this.url, {
                method: "POST",
                headers: this.commonHeaders,
                body: JSON.stringify({
                    "header": {
                        "fn": "text_analysis",
                        "client_key": this.clientKey
                    },
                    "text": query,
                    "type": "plain",
                    "normalize": {
                        "merge_broken_line": false
                    }
                })
            });
            const data = await response.json();
            return data.header.ret_code === 'succ' ? data.language : "en";
        } catch (error) {
            logger.error("Error detecting language:", error);
            return "en";
        }
    }

    async translate(query, targetLanguage) {
        try {
            const sourceLanguage = await this.detectLanguage(query);
            const response = await fetch(this.url, {
                method: "POST",
                headers: this.commonHeaders,
                body: JSON.stringify({
                    "header": {
                        "fn": "auto_translation",
                        "client_key": this.clientKey
                    },
                    "type": "plain",
                    "model_category": "normal",
                    "text_domain": "general",
                    "source": {
                        "lang": sourceLanguage,
                        "text_list": ["", query, ""]
                    },
                    "target": {
                        "lang": tencentTransMap[targetLanguage]
                    }
                })
            });
            const data = await response.json();
            return data.header.ret_code === 'succ' ? data.auto_translation?.[1] : "翻译失败";
        } catch (error) {
            logger.error("Error translating text:", error);
            return "翻译失败";
        }
    }
}

// Deepl翻译策略
class DeeplTranslateStrategy extends TranslateStrategy {
    constructor(config) {
        super();
        this.config = config;
        this.deeplUrls = this.config.deeplApiUrls.includes(",") ? this.config.deeplApiUrls.split(",") : [this.config.deeplApiUrls];
    }

    async translate(query, targetLanguage) {
        const url = this.deeplUrls[Math.floor(Math.random() * this.deeplUrls.length)];
        logger.info(`[R插件][Deepl翻译]：当前使用的API：${url}`);
        try {
            const source_lang = await new TencentTranslateStrategy(this.config).detectLanguage(query);
            logger.info(`[R插件][Deepl翻译]：检测到的源语言：${source_lang}`);
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this.commonHeaders
                },
                body: JSON.stringify({
                    text: query,
                    source_lang,
                    target_lang: tencentTransMap[targetLanguage]
                }),

            });
            const data = await response.json();
            return data.data;
        } catch (error) {
            logger.error("Error translating text:", error);
            return "翻译失败";
        }
    }
}

// 主逻辑
export default class Translate {
    constructor(config) {
        this.config = config;
        this.strategy = null;
    }

    selectStrategy() {
        if (!_.isEmpty(this.config.deeplApiUrls)) {
            logger.info("[R插件][翻译策略]：当前选择 Deepl翻译")
            return new DeeplTranslateStrategy(this.config);
        } else {
            logger.info("[R插件][翻译策略]：当前选择 企鹅翻译")
            return new TencentTranslateStrategy(this.config);
        }
    }

    async translate(query, targetLanguage) {
        if (!this.strategy) {
            this.strategy = this.selectStrategy();
        }
        return this.strategy.translate(query, targetLanguage);
    }
}
