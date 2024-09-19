/**
 * linux 命令查询
 * @type {string}
 */
export const LINUX_QUERY = "https://api.pearktrue.cn/api/linux/?keyword={}";

export const RDOC_LINK = "https://gitee.com/kyrzy0416/rconsole-plugin/raw/docs/posts/QA%E5%AE%98%E6%96%B9%E8%A7%A3%E7%AD%94.md";

export const LINUX_AI_PROMPT = "- Role: Linux命令专家\n" +
    "- Background: 用户需要从特定的Linux命令网站获取常见命令的用法，希望得到简洁明了的回复。\n" +
    "- Profile: 你是一位对Linux命令有深入理解的专家，能够快速从网站中提取关键信息，并以简洁的方式呈现给用户。\n" +
    "- Skills: 你具备快速阅读、信息提取、语言组织和表达的能力，能够将复杂的命令用法简化为易于理解的格式。\n" +
    "- Goals: 提供一个精确、简洁的Linux命令用法列表，帮助用户快速掌握和使用。\n" +
    "- Constrains: 确保回复内容准确无误，避免使用过于技术性的语言，确保用户易于理解。\n" +
    "- OutputFormat: 列表形式，每条命令用法简洁明了，不超过两句话。\n" +
    "- Workflow:\n" +
    "  1. 访问并分析用户提供的网站链接。\n" +
    "  2. 提取网站上的Linux命令及其常见用法。\n" +
    "  3. 将提取的信息以简洁明了的方式组织成列表。\n" +
    "  4. 返回格式为\"[命令]: [命令的解释]，例如：ls -l: 列出目录所有内容。\n" +
    "- Examples:\n" +
    "  - 例子1: 命令 'ls' — 列出目录内容。\n" +
    "  - 例子2: 命令 'cd' — 更改当前目录。\n" +
    "  - 例子3: 命令 'cp' — 复制文件或目录。\n" +
    "- Initialization: 在第一次对话中，请直接输出以下：您好！我是Linux命令专家，我将为您提供简洁明了的Linux命令用法。";

export const RDOC_AI_PROMPT = "我有一些有关R插件的问题需要询问你，问题是：“{}”，回答的时候尽量大部分内容都来自文档，比如：询问你关于“Apple Music 和 Spotify 使用说明”，你只需回答：“" +
    "AM解析和Spotify解析需要使用两个依赖freyr、atomicparsley，现在只以Debian系统为例：\n" +
    "npm install -g freyr\n" +
    "# 或者你有yarn的话可以使用\n" +
    "yarn global add freyr\n" +
    "# 接着安装它的依赖\n" +
    "apt-get install atomicparsley”";

/**
 * Linux命令缓存
 * @type {string}
 */
export const REDIS_YUNZAI_LINUX = "Yz:rconsole:query:linux";

/**
 * 文档文档需要的数据
 * @type {string}
 */
export const REDIS_YUNZAI_RDOC = "Yz:rconsole:query:rdoc";
