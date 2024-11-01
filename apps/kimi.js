import config from "../model/config.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import fs from "fs";
import { marked } from "marked"

async function markdownRender(e, query, aiContent) {
    // 打开一个新的页面
    const browser = await puppeteer.browserInit();
    const page = await browser.newPage();

    if (aiContent.indexOf("搜索结果来自：") !== -1) {
        aiContent = aiContent.split("搜索结果来自：")[0];
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kimi Chat Interface</title>
    <style>
        body {
            background-color: #1a1a1a;
            color: #ffffff;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .chat-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .logo {
            text-align: center;
            margin-bottom: 20px;
        }
        .logo img {
            max-width: 200px;
            height: auto;
        }
        .message {
            margin-bottom: 20px;
            display: flex;
            align-items: flex-start;
        }
        .avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            margin-right: 12px;
        }
        .message-content {
            background-color: #2a2a2a;
            border-radius: 18px;
            padding: 12px 12px;
            max-width: 70%;
            font-size: 14px;
        }
        .user-message {
            justify-content: flex-end;
        }
        .user-message .message-content {
            background-color: #0066cc;
            margin-right: 12px;
        }
        .ai-message .message-content {
            background-color: #2a2a2a;
        }
        .user-message .avatar {
            order: 1;
            margin-right: 0;
            margin-left: 12px;
        }
        pre {
            background-color: #1e1e1e;
            border-radius: 8px;
            padding: 12px;
            overflow-x: auto;
        }
        code {
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="logo">
            <img src="https://gitee.com/kyrzy0416/rconsole-plugin-complementary-set/raw/master/kimi/logo.png" alt="KIMI Logo">
        </div>
        <div class="message user-message">
            <div class="message-content">
                <p>${ query }</p>
            </div>
            <img src="http://q1.qlogo.cn/g?b=qq&nk=${ e.user_id }&s=100" alt="User Avatar" class="avatar">
        </div>
        <div class="message ai-message">
            <img src="https://gitee.com/kyrzy0416/rconsole-plugin-complementary-set/raw/master/kimi/kimi.png" alt="AI Avatar" class="avatar">
            <div class="message-content">
                <div id="ai-content">${ marked.parse(aiContent) }</div>
            </div>
        </div>
    </div>
</body>
</html>`;
    await page.setViewport({
        width: 1280,
        height: 720,
        deviceScaleFactor: 10, // 根据显示器的分辨率调整比例，2 是常见的 Retina 显示比例
    });
    // 设置页面内容为包含 Base64 图片的 HTML
    await page.setContent(htmlContent, {
        waitUntil: "networkidle0",
    });
    // 获取页面上特定元素的位置和尺寸
    const element = await page.$(".chat-container"); // 可以用CSS选择器选中你要截取的部分
    // 直接截图该元素
    await element.screenshot({
        path: "./chat.png",
        type: "jpeg",
        fullPage: false,
        omitBackground: false,
        quality: 50,
    });
    await e.reply(segment.image(fs.readFileSync("./chat.png")));
}

export class kimiJS extends plugin {
    constructor() {
        super({
            name: 'Moonshot AI',
            dsc: 'Moonshot AI Assistant',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: '^#kimi(.*)$',
                    fnc: 'chat'
                }
            ]
        });
        // 配置文件
        this.toolsConfig = config.getConfig("tools");
        // 设置基础 URL 和 headers
        this.baseURL = this.toolsConfig.aiBaseURL;
        this.headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + this.toolsConfig.aiApiKey
        };
    }

    async chat(e) {
        const query = e.msg.replace(/^#kimi/, '').trim();
        // 请求Kimi
        const completion = await fetch(this.baseURL + "/v1/chat/completions", {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
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
            }),
            timeout: 100000
        });
        await markdownRender(e, query, (await completion.json()).choices[0].message.content, true);
        return true;
    }
}
