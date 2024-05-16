import { toBase64 } from "./file.js";
// openai库
import OpenAI from 'openai';
// fs
import fs from "node:fs";

export class OpenaiBuilder {
    constructor() {
        this.baseURL = "https://api.moonshot.cn"; // 默认模型
        this.apiKey = ""; // 默认API密钥
        this.prompt = "描述一下这个图片"; // 默认提示
        this.model = 'claude-3-haiku-20240307'
        this.path = ''; // 上传文件的路径
    }

    setBaseURL(baseURL) {
        this.baseURL = baseURL + "/v1";
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
        if (this.path === '') {
            throw Error("无法获取到文件路径");
            return null;
        }
        // logger.info(this.baseURL, this.apiKey)
        // 创建客户端
        this.client = new OpenAI({
            baseURL: this.baseURL,
            apiKey: this.apiKey
        });
        // 构建
        if (this.baseURL.includes("api.moonshot.cn")) {
            return await this.kimi(this.path);
        } else {
            return await this.openai(this.path);
        }
    }

    async kimi(path) {
        let file_object = await this.client.files.create({
            file: fs.createReadStream(path),
            purpose: "file-extract"
        })
        let file_content = await (await this.client.files.content(file_object.id)).text()
        // 请求OpenAI
        const completion = await this.client.chat.completions.create({
            model: "moonshot-v1-8k",
            messages: [
                {
                    "role": "system",
                    "content": file_content,
                },
                {
                    role: "user",
                    content: this.prompt
                },
            ],
        });

        return {
            "model": "月之暗面 Kimi",
            "ans": completion.choices[0].message.content
        }
    }

    async openai(path) {
        // 转换base64
        const pic = await toBase64(path);
        const completion = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: pic,
                            },
                        },
                        {
                            type: "text",
                            text: this.prompt,
                        },
                    ],
                },
            ],
            use_search: false,
        });

        return {
            "model": "OpenAI",
            "ans": completion.choices[0].message.content
        }
    }
}