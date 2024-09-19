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
            model: "moonshot-v1-8k",
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
}
