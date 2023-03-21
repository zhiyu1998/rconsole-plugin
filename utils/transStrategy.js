import {transMap} from "./constant.js";
import md5 from "md5";
import fetch from "node-fetch";
import HttpProxyAgent from "https-proxy-agent";

/**
 * 翻译插件策略模式
 */
export default class Translate {
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
        this.config = config;
    }

    /**
     * 百度翻译
     * @param query             查询句子
     * @param targetLanguage    目标语言
     * @returns {Promise<unknown>}
     */
    async baidu(query, targetLanguage) {
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

    /**
     * google翻译
     * @param query
     * @param targetLanguage
     * @returns {Promise<string>}
     */
    async google(query, targetLanguage) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=${transMap[targetLanguage]}&q=${query}`;
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


    /**
     * 腾选交互式翻译
     * @param query
     * @param targetLanguage
     * @returns {Promise<Response>}
     */
    async tencent(query, targetLanguage) {
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
                "text": "s",
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
                    "lang": transMap[targetLanguage]
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