import axios from "axios";

export class OpenaiBuilder {
    constructor() {
        this.baseURL = "https://api.moonshot.cn"; // 默认模型
        this.apiKey = ""; // 默认API密钥
        this.prompt = "描述一下这个图片"; // 默认提示
        this.model = 'claude-3-haiku-20240307'
        this.path = ''; // 上传文件的路径
    }

    setBaseURL(baseURL) {
        this.baseURL = baseURL;
        return this;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        return this;
    }

    setPrompt(prompt) {
        this.prompt = prompt;
        return this;
    }

    setModel(model) {
        this.model = model;
        return this;
    }

    setPath(path) {
        this.path = path;
        return this;
    }

    async build() {
        // logger.info(this.baseURL, this.apiKey)
        // 创建客户端
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 100000,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + this.apiKey
            }
        });
        return this;
    }

    async kimi(query) {
        // 请求Kimi
        const completion = await this.client.post("/v1/chat/completions", {
            model: this.model,
            messages: [
                {
                    "role": "system",
                    "content": this.prompt,
                },
                {
                    role: "user",
                    content: query
                },
            ],
        });
        return {
            "model": "月之暗面 Kimi",
            "ans": completion.data.choices[0].message.content
        }
    }

    /**
     * 通用的OpenAI标准接口调用
     * @param {string} query - 用户查询内容或网页链接
     * @returns {Promise<{model: string, ans: string}>}
     */
    async openai(query) {
        try {
            let content = query;

            // 检测是否为网页链接，如果是则先获取网页内容
            if (this.isWebUrl(query)) {
                try {
                    const webContent = await this.fetchWebContent(query);
                    if (webContent) {
                        content = webContent;
                        logger.info('[R插件][OpenAI] 已获取网页内容，内容长度:', webContent.length);
                    }
                } catch (webError) {
                    logger.warn('[R插件][OpenAI] 网页内容获取失败:', webError.message);
                    return {
                        "model": this.getModelDisplayName(),
                        "ans": "无法获取网页内容，请检查链接或网络连接。"
                    };
                }
            }

            const completion = await this.client.post("/v1/chat/completions", {
                model: this.model,
                messages: [
                    {
                        "role": "system",
                        "content": this.prompt,
                    },
                    {
                        role: "user",
                        content: content
                    },
                ],
            });

            const modelName = this.getModelDisplayName();
            return {
                "model": modelName,
                "ans": completion.data.choices[0].message.content
            }
        } catch (error) {
            logger.error('[R插件][OpenAI] API调用失败:', error.response?.data || error.message);
            throw new Error(`AI接口调用失败: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * 获取网页内容
     * @param {string} url - 网页链接
     * @returns {Promise<string>} 网页内容
     */
    async fetchWebContent(url) {
        // 首先尝试直接请求网页
        try {
            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            let content = response.data;
            if (typeof content === 'string' && content.trim()) {
                // 简单的HTML内容提取（去除标签，保留文本）
                content = content
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 移除script标签
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // 移除style标签
                    .replace(/<[^>]+>/g, ' ') // 移除所有HTML标签
                    .replace(/\s+/g, ' ') // 合并多个空格
                    .trim();

                if (content.length > 50) { // 确保有足够的内容
                    logger.info('[R插件][网页爬取] 直接请求成功，内容长度:', content.length);
                    return content;
                }
            }

            throw new Error('获取的网页内容为空或格式异常');
        } catch (directError) {
            logger.warn('[R插件][网页爬取] 直接请求失败:', directError.message);
        }

        // 备用方案：使用专门的爬虫API
        try {
            const { llmRead } = await import('../utils/llm-util.js');
            const content = await llmRead(url);
            if (content && content.trim()) {
                logger.info('[R插件][网页爬取] 使用爬虫API成功获取内容，长度:', content.length);
                return content;
            }
            throw new Error('爬虫API返回内容为空');
        } catch (crawlerError) {
            logger.error('[R插件][网页爬取] 爬虫API也失败:', crawlerError.message);
            throw new Error(`无法获取网页内容: 直接请求和爬虫API都失败`);
        }
    }

    /**
     * 获取模型的显示名称
     * @returns {string}
     */
    getModelDisplayName() {
        // 只取模型名称的最后部分
        const model = this.model.split('/').pop();
        // 根据baseURL和model来判断使用的是哪个服务
        if (this.baseURL.includes('api.moonshot.cn')) {
            return '月之暗面 Kimi';
        } else if (this.baseURL.includes('api.openai.com')) {
            return `OpenAI ${model}`;
        } else if (this.baseURL.includes('api.anthropic.com')) {
            return `Anthropic ${model}`;
        } else if (this.baseURL.includes('dashscope.aliyuncs.com')) {
            return `阿里云 ${model}`;
        } else if (this.baseURL.includes('api.deepseek.com')) {
            return `DeepSeek ${model}`;
        } else if (this.baseURL.includes('api.zhipuai.cn')) {
            return `智谱AI ${model}`;
        } else {
            return `AI模型 ${model}`;
        }
    }

    /**
     * 检测是否为网页链接
     * @param {string} text - 待检测的文本
     * @returns {boolean}
     */
    isWebUrl(text) {
        try {
            // 简单的URL检测正则
            const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
            return urlRegex.test(text.trim());
        } catch (error) {
            return false;
        }
    }
}
