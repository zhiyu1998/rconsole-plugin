import axios from 'axios';
import { StringDecoder } from 'node:string_decoder';
import {
    YUANBAO_CHAT,
    YUANBAO_CONVERSATION_CREATE,
    YUANBAO_CONVERSATION_CLEAR,
    YUANBAO_CONVERSATION_UPDATE_MODEL,
} from '../constants/tools.js';
import { SUMMARY_PROMPT } from '../constants/constant.js';

/**
 * 链接总结（走腾讯元宝 Web 端对话接口）
 *
 * 设计思路：
 *   与 utils/weixin-channel.js 视频号解析共用同一个腾讯元宝 Cookie（weixinChannelYuanbaoCookie）。
 *   视频号走 get_parse_result 专用接口拿 playable_url（结构化数据）；
 *   通用链接总结没有专用接口时，走元宝对话接口让元宝抓取并总结。
 *
 * 解析流程（一次性会话）：
 *   1. POST /api/user/agent/conversation/create 新建会话 → 拿 chatId
 *   2. POST /api/user/agent/conversation/updateModel 初始化模型为 hunyuan_gpt_175B_0404
 *   3. POST /api/chat/{chatId} 发送"总结：<文章URL>"消息，接收 SSE 流拼接元宝返回内容
 *   4. POST /api/user/agent/conversation/v1/clear 删除会话（无论成功失败都清理）
 *
 * 鉴权：仅需腾讯元宝 Web 端 Cookie，不需要微信登录。
 * payload 格式参考：https://github.com/chenwr727/yuanbao-free-api
 */

// 元宝 Web 端公共请求头（设备指纹部分，与视频号 PARSE_HEADERS 保持一致风格）
// 注意：t-userid / x-device-id 等指纹头与 Cookie 不强绑定，沙箱实测用任意值均能调通会话管理接口
const COMMON_HEADERS = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh-TW;q=0.9,zh;q=0.8',
    'content-type': 'application/json',
    'origin': 'https://yuanbao.tencent.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'sec-ch-ua': `"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"`,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': `"Windows"`,
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-language': 'zh-CN',
    'x-platform': 'win',
    'x-source': 'web',
    'x-webversion': '2.74.1',
    'x-requested-with': 'XMLHttpRequest',
    'x-webdriver': '0',
    'x-ybuitest': '0',
};

// 元宝默认智能体 ID（与视频号解析 referer 里的一致）
const AGENT_ID = 'naQivTmsDa';
// 默认对话模型（混元 175B，元宝网页版默认模型）
const DEFAULT_MODEL = 'hunyuan_gpt_175B_0404';

function buildSummaryPrompt(input, { isContent = false } = {}) {
    const sourceLabel = isContent ? '网页内容' : '链接';
    return `${SUMMARY_PROMPT}

请严格遵循以上角色、规则与输出格式要求，直接总结下面提供的${sourceLabel}，不要输出额外寒暄，也不要重复提示词内容。

${sourceLabel}：${input}`;
}

/**
 * 构建带 Cookie + referer 的完整请求头
 * @param {string} cookie 腾讯元宝 Web 端 Cookie
 * @param {string} chatId 会话 ID（用于 referer 与 x-agentid）
 * @param {object} extra 额外覆盖的 headers
 * @param {object} [opts]
 * @param {boolean} [opts.chatIdInPath=true] 是否在 referer/x-agentid 路径中带 chatId
 *   - create/updateModel/clear 接口：带 chatId（如 /chat/naQivTmsDa/xxx）
 *   - chat 对话接口：不带 chatId（仅 /chat/naQivTmsDa，实测抓包确认）
 * @returns {object}
 */
function buildHeaders(cookie, chatId, extra = {}, { chatIdInPath = true } = {}) {
    const path = chatIdInPath ? `${AGENT_ID}/${chatId}` : AGENT_ID;
    return {
        ...COMMON_HEADERS,
        'referer': `https://yuanbao.tencent.com/chat/${path}`,
        'x-agentid': path,
        'cookie': cookie,
        ...extra,
    };
}

/**
 * Step 1: 新建元宝会话
 * @param {string} cookie 腾讯元宝 Web 端 Cookie
 * @returns {Promise<string>} chatId 会话 ID
 */
export async function createConversation(cookie) {
    // payload 必须带 agentId，实测抓包确认；不带 agentId 也能创建但建议与网页版一致
    const resp = await axios.post(
        YUANBAO_CONVERSATION_CREATE,
        { agentId: AGENT_ID },
        {
            headers: buildHeaders(cookie, ''),
            timeout: 15000,
        },
    );
    const chatId = resp.data?.id;
    if (!chatId) {
        throw new Error('元宝接口未返回会话 ID，可能是 Cookie 失效');
    }
    logger.info(`[R插件][链接总结][元宝] 创建会话成功: ${chatId}`);
    return chatId;
}

/**
 * Step 2: 初始化会话模型（混元 175B + 自动联网搜索）
 * 不调用此步骤直接发消息有时会返回空，沙箱实测必须先初始化模型
 * @param {string} cookie 腾讯元宝 Web 端 Cookie
 * @param {string} chatId 会话 ID
 */
export async function initConversationModel(cookie, chatId) {
    const payload = {
        cid: chatId,
        chatModelId: DEFAULT_MODEL,
        // chatModelExtInfo 是嵌套 JSON 字符串（元宝网页版原样格式）
        chatModelExtInfo: JSON.stringify({
            modelId: DEFAULT_MODEL,
            subModelId: '',
            supportFunctions: { internetSearch: 'autoInternetSearch' },
            internetSearch: 'autoInternetSearch',
        }),
    };
    await axios.post(YUANBAO_CONVERSATION_UPDATE_MODEL, payload, {
        headers: buildHeaders(cookie, chatId),
        timeout: 15000,
    });
    logger.info(`[R插件][链接总结][元宝] 初始化模型成功: ${DEFAULT_MODEL}`);
}

/**
 * Step 4: 删除元宝会话（无论解析成功失败都应调用，避免污染用户会话列表）
 * @param {string} cookie 腾讯元宝 Web 端 Cookie
 * @param {string} chatId 会话 ID
 */
export async function clearConversation(cookie, chatId) {
    try {
        await axios.post(
            YUANBAO_CONVERSATION_CLEAR,
            { conversationIds: [chatId], uiOptions: { noToast: true } },
            {
                headers: buildHeaders(cookie, chatId),
                timeout: 15000,
            },
        );
        logger.info(`[R插件][链接总结][元宝] 删除会话成功: ${chatId}`);
    } catch (err) {
        // 删除失败不影响主流程，仅记录日志
        logger.warn(`[R插件][链接总结][元宝] 删除会话失败（不影响主流程）: ${err.message}`);
    }
}

/**
 * 解析元宝 SSE 流，拼接出最终文本回复
 *
 * 元宝 SSE 真实格式（实测抓包确认，2026-06）：
 *   - 每行形如 `data: {...}` 或 `event: xxx` 或自定义标记行
 *   - 文本增量：`data: {"type":"text","msg":"根据你"}` ← 只提取这种
 *   - 状态提示：`data: {"type":"continue_step","msg":"正在阅读"}` ← 跳过（不是回答内容）
 *   - 文章卡片：`data: {"type":"multimediaParseResult",...}` ← 跳过
 *   - 元信息：`data: {"type":"meta",...}` ← 跳过
 *   - 非 JSON 标记：`data: status` / `data: text` / `data: [plugin: ]` / `data: [MSGINDEX:2]`
 *                   `data: [TRACEID:...]` / `data: [DONE]` ← 全部跳过
 *   - event: 行（如 `event: speech_type`）← 跳过
 *
 * 关键点：必须用 `type === "text" && typeof msg === "string"` 双重过滤，
 * 否则会把"正在阅读"等状态提示误当作回答内容。
 *
 * @param {import('stream').Readable} stream SSE 流
 * @param {object} options
 * @param {function(string): void} [options.onChunk] 收到增量文本回调（可用于实时进度展示）
 * @returns {Promise<string>} 拼接后的完整文本
 */
function parseSSEStream(stream, { onChunk } = {}) {
    return new Promise((resolve, reject) => {
        const parts = [];
        let buffer = '';
        // 使用流式 UTF-8 解码器，避免 chunk 边界切断多字节中文字符导致乱码或 JSON 解析失败
        const decoder = new StringDecoder('utf8');

        const handleLine = (line) => {
            line = line.trim();
            if (!line) return;

            // SSE 注释行 / 事件名行 / id 行，跳过
            if (line.startsWith(':') || line.startsWith('event:') || line.startsWith('id:')) return;

            // 提取 data: 后的内容
            let dataStr = line;
            if (line.startsWith('data:')) {
                dataStr = line.slice(5).trim();
            }

            // 空内容或结束标记
            if (!dataStr || dataStr === '[DONE]') return;

            // 非 JSON 的标记行（[plugin:] / [MSGINDEX:] / [TRACEID:] / status / text 等）全部跳过
            // 这些是元宝前端的自定义协议标记，不是回答内容
            if (dataStr.startsWith('[')) return;
            if (dataStr === 'status' || dataStr === 'text') return;

            // 尝试 JSON 解析
            let obj;
            try {
                obj = JSON.parse(dataStr);
            } catch (_) {
                // 非 JSON 行一律跳过（避免把状态文本误当作回答）
                return;
            }

            // 错误事件
            if (obj.type === 'error' || (obj.error && obj.error.code && String(obj.error.code) !== '0')) {
                reject(new Error(`元宝接口错误: ${obj.error?.message || obj.msg || obj.error?.code}`));
                return;
            }

            // 只提取 type=text 的 msg 字段作为回答增量
            // 注意：continue_step / multimediaParseResult / meta 等类型也有 msg 或其他字段，必须排除
            if (obj.type === 'text' && typeof obj.msg === 'string' && obj.msg) {
                parts.push(obj.msg);
                if (onChunk) onChunk(obj.msg);
            }
        };

        stream.on('data', (chunk) => {
            // 用 StringDecoder 流式解码，防止 chunk 边界切断多字节 UTF-8 字符
            buffer += decoder.write(chunk);
            // 按换行切分，最后一行可能不完整暂存到 buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) handleLine(line);
        });

        stream.on('end', () => {
            // 刷新解码器残留字节（可能包含不完整字符的尾字节）
            buffer += decoder.end();
            // 处理 buffer 中剩余内容
            if (buffer.trim()) handleLine(buffer);
            const fullText = parts.join('').trim();
            if (!fullText) {
                reject(new Error('元宝接口未返回任何文本内容，可能是接口格式变动或 Cookie 失效'));
                return;
            }
            resolve(fullText);
        });

        stream.on('error', (err) => reject(err));
    });
}

/**
 * Step 3: 发送链接总结请求并接收 SSE 流
 *
 * payload 与 headers 格式来自元宝网页版实测抓包（2026-06），
 * 与 yuanbao-free-api 早期版本有差异，以实际抓包为准。
 *
 * 关键字段：
 *   - parsingPromptUrl: 链接 URL 数组，元宝据此抓取正文
 *   - conversationId: 会话 ID（与 URL 路径里的 chatId 一致）
 *   - model: "gpt_175B_0404"（注意无 hunyuan_ 前缀，与 chatModelId 不同）
 *   - supportFunctions: 开启联网搜索与自动搜索开关
 *
 * headers 关键点：
 *   - content-type: text/plain;charset=UTF-8（非 application/json）
 *   - chat_version: v1
 *   - referer / x-agentid 不带 chatId（仅 naQivTmsDa）
 *
 * @param {string} cookie 腾讯元宝 Web 端 Cookie
 * @param {string} chatId 会话 ID
 * @param {string} input 待总结链接或已抓取内容
 * @param {object} [options]
 * @param {number} [options.timeout=120000] 超时毫秒
 * @param {function(string): void} [options.onChunk] 增量回调
 * @param {boolean} [options.isContent=false] 是否直接总结已抓取内容
 * @returns {Promise<string>} 元宝总结的完整文本
 */
export async function chatSummarize(cookie, chatId, input, options = {}) {
    const { timeout = 120000, onChunk, isContent = false } = options;

    const prompt = buildSummaryPrompt(input, { isContent });
    // payload 字段对齐元宝网页版实测抓包格式
    const body = {
        model: 'gpt_175B_0404',
        prompt,
        plugin: '',
        displayPrompt: prompt,
        displayPromptType: 1,
        agentId: AGENT_ID,
        isTemporary: false,
        projectId: '',
        chatModelId: DEFAULT_MODEL,
        supportFunctions: ['openAutoSearchSwitch', 'autoInternetSearch'],
        docOpenid: '',
        options: {
            imageIntention: { needIntentionModel: true, backendUpdateFlag: 2, intentionStatus: true },
        },
        multimedia: [],
        supportHint: 1,
        chatModelExtInfo: JSON.stringify({
            modelId: DEFAULT_MODEL,
            subModelId: '',
            supportFunctions: { internetSearch: '' },
            internetSearch: 'autoInternetSearch',
        }),
        applicationIdList: [],
        version: 'v2',
        extReportParams: null,
        isAtomInput: false,
        // 关键：链接 URL 数组，元宝据此抓取正文（实测抓包确认）
        parsingPromptUrl: isContent ? [] : [input],
        // 关键：会话 ID，与 URL 路径里的 chatId 一致
        conversationId: chatId,
        offsetOfHour: 8,
        offsetOfMinute: 0,
    };

    const resp = await axios.post(`${YUANBAO_CHAT}${chatId}`, body, {
        // chat 接口 referer/x-agentid 不带 chatId（实测抓包确认）
        headers: buildHeaders(cookie, chatId, {
            accept: '*/*',
            'content-type': 'text/plain;charset=UTF-8',
            'chat_version': 'v1',
        }, { chatIdInPath: false }),
        timeout,
        responseType: 'stream',
        // SSE 流不解析为 JSON
        transformResponse: [(data) => data],
    });

    if (resp.status !== 200) {
        throw new Error(`元宝对话接口返回 HTTP ${resp.status}`);
    }

    logger.info(`[R插件][链接总结][元宝] 对话流已建立，开始接收 SSE`);
    let summary = await parseSSEStream(resp.data, { onChunk });

    // 清洗元宝富文本标记（QQ 群里显示会很怪）：
    //   [](@mark_underline=N)  ← 高亮下划线标记
    //   [](@mark_*)            ← 其他 mark 标记
    //   [citation:N]           ← 联网搜索引用编号标记
    summary = summary
        .replace(/\[\]\(@mark_[a-z_]+=\d+\)/g, '')
        .replace(/\[citation:\d+\]/g, '');

    return summary;
}

/**
 * 端到端总结：新建会话 → 初始化模型 → 对话总结 → 删除会话
 *
 * 无论解析成功或失败都会尝试删除会话，避免污染用户元宝账号的会话列表。
 *
 * @param {string} url 待总结链接
 * @param {string} cookie 腾讯元宝 Web 端 Cookie（与视频号解析共用）
 * @param {object} [options]
 * @param {function(string): void} [options.onChunk] SSE 增量回调（可用于实时进度展示）
 * @param {number} [options.timeout=120000] 对话接口超时毫秒
 * @returns {Promise<string>} 元宝总结的完整文本
 */
export async function summarizeLink(url, cookie, options = {}) {
    if (!cookie) {
        throw new Error('未配置腾讯元宝 Cookie，请联系管理员设置（#设置视频号Cookie）');
    }
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
        throw new Error('请提供有效的链接地址');
    }
    const normalizedUrl = url.trim();

    let chatId = '';
    try {
        // Step 1: 新建会话
        chatId = await createConversation(cookie);
        // Step 2: 初始化模型
        await initConversationModel(cookie, chatId);
        // Step 3: 发送总结请求
        const summary = await chatSummarize(cookie, chatId, normalizedUrl, options);
        logger.info(`[R插件][链接总结][元宝] 总结成功，文本长度: ${summary.length}`);
        return summary;
    } catch (err) {
        // 401 通常意味着 Cookie 失效或部署服务器 IP 与元宝登录 IP 不一致（沙箱实测确认此风控存在）
        const status = err?.response?.status;
        if (status === 401) {
            throw new Error('元宝对话接口返回 401 未授权，可能是 Cookie 失效或部署服务器 IP 与元宝登录 IP 不一致（元宝对话接口有 IP 风控）');
        }
        throw err;
    } finally {
        // Step 4: 无论成败都清理会话
        if (chatId) {
            await clearConversation(cookie, chatId);
        }
    }
}

/**
 * 端到端总结：直接使用已抓取网页内容进行元宝总结
 *
 * @param {string} content 已抓取的网页正文
 * @param {string} cookie 腾讯元宝 Web 端 Cookie
 * @param {object} [options]
 * @param {function(string): void} [options.onChunk] SSE 增量回调
 * @param {number} [options.timeout=120000] 对话接口超时毫秒
 * @returns {Promise<string>} 元宝总结的完整文本
 */
export async function summarizeContent(content, cookie, options = {}) {
    if (!cookie) {
        throw new Error('未配置腾讯元宝 Cookie，请联系管理员设置（#设置视频号Cookie）');
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
        throw new Error('请提供有效的网页内容');
    }
    const normalizedContent = content.trim();

    let chatId = '';
    try {
        chatId = await createConversation(cookie);
        await initConversationModel(cookie, chatId);
        const summary = await chatSummarize(cookie, chatId, normalizedContent, {
            ...options,
            isContent: true,
        });
        logger.info(`[R插件][链接总结][元宝] 内容总结成功，文本长度: ${summary.length}`);
        return summary;
    } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
            throw new Error('元宝对话接口返回 401 未授权，可能是 Cookie 失效或部署服务器 IP 与元宝登录 IP 不一致（元宝对话接口有 IP 风控）');
        }
        throw err;
    } finally {
        if (chatId) {
            await clearConversation(cookie, chatId);
        }
    }
}

/**
 * 兼容旧接口：保留原有微信文章命名，内部复用通用链接总结。
 *
 * @param {string} articleUrl 微信文章 URL
 * @param {string} cookie 腾讯元宝 Web 端 Cookie（与视频号解析共用）
 * @param {object} [options]
 * @returns {Promise<string>} 元宝总结的完整文本
 */
export async function summarizeArticle(articleUrl, cookie, options = {}) {
    return summarizeLink(articleUrl, cookie, options);
}
