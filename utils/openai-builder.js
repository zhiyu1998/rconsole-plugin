import axios from "axios";

export class OpenaiBuilder {
    constructor() {
        this.baseURL = "https://api.moonshot.cn"; // 默认模型
        this.apiKey = ""; // 默认API密钥
        this.prompt = "描述一下这个图片"; // 默认提示
        this.model = 'claude-3-haiku-20240307'
        this.provider = "kimi"; // 默认提供商
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

    setProvider(provider) {
        this.provider = provider;
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

    /**
     * 调用与OpenAI兼容的API（如Kimi/Moonshot）。
     * @param {Array<Object>} messages - 发送给模型的消息列表。
     * @param {Array<Object>} [tools=[]] - (可选) 一个描述可供模型使用的工具的数组。
     * @returns {Promise<Object>} 返回一个包含模型响应的对象。如果模型决定调用工具，则包含 'tool_calls' 字段；否则，包含 'ans' 文本响应。
     */
    async chat(messages, tools = []) {
        if (this.provider === 'deepseek') {
            const content = messages.find(m => m.role === 'user')?.content;
            const ans = await deepSeekChat(content, this.prompt);
            return {
                "model": "deepseek",
                "ans": ans
            }
        }

        // 准备发送给API的消息
        let requestMessages = [...messages];
        // 检查是否已存在系统提示
        const hasSystemPrompt = requestMessages.some(m => m.role === 'system');

        // 如果没有系统提示并且builder中已设置，则添加
        if (!hasSystemPrompt && this.prompt) {
            requestMessages.unshift({
                role: 'system',
                content: this.prompt,
            });
        }

        // 构建API请求的负载
        const payload = {
            model: this.model, // 使用在builder中设置的模型
            messages: requestMessages,
        };

        // 如果提供了工具，将其添加到负载中，并让模型自动决定是否使用
        if (tools && tools.length > 0) {
            payload.tools = tools;
            payload.tool_choice = "auto";
        }

        // 发送POST请求到聊天完成端点
        const completion = await this.client.post("/v1/chat/completions", payload);
        const message = completion.data.choices[0].message;

        // 从响应中获取实际使用的模型名称
        const modelName = completion.data.model;

        // 如果模型的响应中包含工具调用
        if (message.tool_calls) {
            return {
                "model": modelName,
                "tool_calls": message.tool_calls
            }
        }
        
        // 否则，返回包含文本答案的响应
        return {
            "model": modelName,
            "ans": message.content
        }
    }
}
