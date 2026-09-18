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
        const data = completion.data;

        // 部分本地网关出错时仍返回 HTTP 200，body 里是 error 对象
        if (data?.error) {
            throw new Error(`模型接口返回错误: ${data.error.message || JSON.stringify(data.error)}`);
        }

        const message = data?.choices?.[0]?.message;
        if (!message) {
            throw new Error(`模型接口返回异常，未找到对话结果: ${JSON.stringify(data)?.slice(0, 200)}`);
        }

        // 从响应中获取实际使用的模型名称，部分本地网关不回传 model 字段
        const modelName = data.model ?? this.model;

        // 严格判断工具调用：部分本地网关即使未传 tools 也会返回空 tool_calls 数组，
        // 空数组是 truthy，不严格判断会丢掉 message.content，导致下游拿到 undefined 的 ans
        if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
            return {
                "model": modelName,
                "tool_calls": message.tool_calls
            }
        }

        // 否则，返回包含文本答案的响应
        return {
            "model": modelName,
            "ans": this._normalizeContent(message)
        }
    }

    /**
     * 归一化模型返回的 content 字段。
     * 兼容字符串、分块数组（部分 OpenAI 兼容网关）、null（推理类模型）等形态，
     * 并去除推理模型输出中的 <think>...</think> 思考标签。
     * @param {Object} message - 模型响应中的 message 对象
     * @returns {string} 纯文本答案
     */
    _normalizeContent(message) {
        let content = message.content;
        if (Array.isArray(content)) {
            content = content
                .map(part => part?.text ?? "")
                .join("");
        }
        if (typeof content !== "string") {
            content = "";
        }
        return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    }
}
