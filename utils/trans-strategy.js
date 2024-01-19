import {transMap, tencentTransMap, googleTransMap} from "./constant.js";
import md5 from "md5";
import fetch from "node-fetch";
import HttpProxyAgent from "https-proxy-agent";
import _ from 'lodash'

// 定义翻译策略接口
class TranslateStrategy {
    async translate(query, targetLanguage) {
        throw new Error("This method should be implemented by subclasses");
    }
}

// 百度翻译策略
class TencentTranslateStrategy extends TranslateStrategy {
    constructor(config) {
        super();
        this.config = config;
    }

    async translate(query, targetLanguage) {
        // 腾讯翻译的具体实现
        const url = `https://transmart.qq.com/api/imt`
        const sourceLanguage = await fetch(url, {
            method: "POST",
            headers: {
                "USER-AGENT": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/111.0"
            },
            body: JSON.stringify({
                "header": {
                    "fn": "text_analysis",
                    "client_key": "browser-firefox-111.0.0-Mac OS-d35fca23-eb48-45ba-9913-114f1177b02b-1679376552800"
                },
                "text": query,
                "type": "plain",
                "normalize": {
                    "merge_broken_line": false
                }
            })
        }).then(async resp => {
            const data = JSON.parse(await resp.text());
            if (data.header.ret_code !== 'succ') {
                return "en"
            }
            return data.language;
        })
        return fetch(url, {
            method: "POST",
            headers: {
                "USER-AGENT": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/111.0"
            },
            body: JSON.stringify({
                "header": {
                    "fn": "auto_translation",
                    "client_key": "browser-firefox-111.0.0-Mac OS-d35fca23-eb48-45ba-9913-114f1177b02b-1679376552800"
                },
                "type": "plain",
                "model_category": "normal",
                "text_domain": "general",
                "source": {
                    "lang": sourceLanguage,
                    "text_list": [
                        "",
                        query,
                        ""
                    ]
                },
                "target": {
                    "lang": tencentTransMap[targetLanguage]
                }
            })
        }).then(async resp => {
            const data = JSON.parse(await resp.text());
            if (data.header.ret_code !== 'succ') {
                return "翻译失败"
            }
            return data.auto_translation?.[1];
        })
    }
}

// 百度翻译策略
class BaiduTranslateStrategy extends TranslateStrategy {

    config = {
        /**
         * 百度翻译appid
         */
        translateAppId: "",
        /**
         * 百度翻译密匙
         */
        translateSecret: "",
        /**
         * 魔法
         */
        proxy: ""
    }

    constructor(config) {
        super();
        this.config = config;
    }

    async translate(query, targetLanguage) {
        // 百度翻译的具体实现
        const url = `http://api.fanyi.baidu.com/api/trans/vip/translate?from=auto&to=${
            transMap[targetLanguage]
        }&appid=${this.config.translateAppId}&salt=rconsole&sign=${md5(
            this.config.translateAppId + query + "rconsole" + this.config.translateSecret,
        )}&q=${query}`;
        return fetch(url)
            .then(resp => resp.json())
            .then(text => text.trans_result)
            .then(res => res[0].dst)
            .catch(err => logger.error(err));
    }
}

class GoogleTranslateStrategy extends TranslateStrategy {
    constructor(config) {
        super();
        this.config = config;
    }

    async translate(query, targetLanguage) {
        // 谷歌翻译的具体实现
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=${googleTransMap[targetLanguage]}&q=${query}`;
        return fetch(url, {
            method: "GET",
            headers: {
                "USER-AGENT": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36",
            },
            agent: new HttpProxyAgent(this.config.proxy || "http://127.0.0.1:7890"),
        })
            .then(resp => resp.text())
            .then(res => JSON.parse(res))
            .then(res => res[0][0][0])
    }
}

// 主逻辑
export default class Translate {
    constructor(config) {
        this.config = config;
        this.strategy = null;

        if (!_.isEmpty(this.config.translateAppId) && !_.isEmpty(this.config.translateSecret)) {
            this.strategy = new BaiduTranslateStrategy(this.config);
        } else {
            // 根据配置选择其他策略，例如 Tencent 或 Google
            this.strategy = new TencentTranslateStrategy(this.config);
        }
    }

    async translate(query, targetLanguage) {
        return this.strategy.translate(query, targetLanguage);
    }
}