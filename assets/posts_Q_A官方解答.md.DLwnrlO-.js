import{_ as i,c as s,o as a,ab as t}from"./chunks/framework.BA8ZoOPC.js";const y=JSON.parse('{"title":"Q&A官方解答","description":"R插件的问题解答","frontmatter":{"title":"Q&A官方解答","description":"R插件的问题解答","date":"2024-08-14T00:00:00.000Z","tags":["问题解答"]},"headers":[],"relativePath":"posts/Q&A官方解答.md","filePath":"posts/Q&A官方解答.md"}'),e={name:"posts/Q&A官方解答.md"},l=t(`<h2 id="🐤-q-a" tabindex="-1">🐤 Q&amp;A <a class="header-anchor" href="#🐤-q-a" aria-label="Permalink to &quot;🐤 Q&amp;A&quot;">​</a></h2><h3 id="📺-b站扫码登录" tabindex="-1">📺 B站扫码登录 <a class="header-anchor" href="#📺-b站扫码登录" aria-label="Permalink to &quot;📺 B站扫码登录&quot;">​</a></h3><p>命令：<code>#RBQ</code>，来自2024/4/1 才子 <code>Mix</code> 的命名</p><p><img src="https://s2.loli.net/2024/08/19/2ljBYQgSLUEXTKN.webp" alt="rbq"></p><p>示例： <img src="https://s2.loli.net/2024/08/19/kqLVxKluECW4YGN.webp" alt="rbq2"></p><h3 id="🎵-douyin问题" tabindex="-1">🎵 douyin问题 <a class="header-anchor" href="#🎵-douyin问题" aria-label="Permalink to &quot;🎵 douyin问题&quot;">​</a></h3><p>由于douyin的解析变化莫测，现版本需要填入自己的cookie，具体步骤如下：</p><p>👍 <strong>推荐方案</strong> ：via 视频教程（由群友 <code>@麦满分</code> 录制）：<a href="https://thumbsnap.com/rKxUGKqp" target="_blank" rel="noreferrer">https://thumbsnap.com/rKxUGKqp</a></p><p><img src="https://51shazhu.com/autoupload/20240714/Ew6x/1024X640/rKxUGKqp.gif?type=ha" alt=""></p><p>👍 <strong>推荐方案</strong>（感谢群友 <code>@湘潭</code> 提供的便捷方案）：</p><ol><li>打开<code>https://www.douyin.com/</code> 扫码登入自己的账号</li><li>F12进入控制台，打开<code>网络/network</code></li><li>搜索<code>www.douyin.com</code>，把下面的一串cookie复制进去即可</li></ol><p><img src="https://s2.loli.net/2024/08/19/E8SWgNZKlHmC6oi.webp" alt=""></p><p><strong>备用方案1</strong> ：</p><ol><li>打开<code>https://www.douyin.com/</code> 扫码登入自己的账号</li><li>F12进入控制台，或者下载一个<a href="https://www.crxsoso.com/webstore/detail/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noreferrer">Cookie-Editor</a></li><li>如果是F12，就将以下参数填入到<code>tools.yaml - douyinCookie</code>，或者使用锅巴</li></ol><blockquote><p>odin_tt=xxx;passport_fe_beating_status=xxx;sid_guard=xxx;uid_tt=xxx;uid_tt_ss=xxx;sid_tt=xxx;sessionid=xxx;sessionid_ss=xxx;sid_ucp_v1=xxx;ssid_ucp_v1=xxx;passport_assist_user=xxx;ttwid=xxx;</p></blockquote><ol start="3"><li>如果是<code>Cookie-Editor</code>就直接到插件复制到<code>tools.yaml - douyinCookie</code>，或者锅巴</li></ol><p>具体图示，找以下这几个：</p><ul><li>odin_tt</li><li>passport_fe_beating_status</li><li>sid_guard</li><li>uid_tt</li><li>uid_tt_ss</li><li>sid_tt</li><li>sessionid</li><li>sessionid_ss</li><li>sid_ucp_v1</li><li>ssid_ucp_v1</li><li>passport_assist_user</li><li>ttwid</li></ul><p><img src="https://s2.loli.net/2024/08/19/2kUgsz1RntZmQje.webp" alt=""></p><p><strong>备用方案2</strong> （由<code>@重装小兔</code>提供）</p><ol><li>下载python</li></ol><blockquote><p>下载链接：<a href="https://www.python.org/" target="_blank" rel="noreferrer">官网</a> | <a href="https://apps.microsoft.com/detail/9pjpw5ldxlz5?hl=zh-cn&amp;gl=CN" target="_blank" rel="noreferrer">微软商店</a></p></blockquote><ol start="2"><li><p>下载：<a href="https://gitee.com/OvertimeBunny/tiktok-ck-douying" target="_blank" rel="noreferrer">https://gitee.com/OvertimeBunny/tiktok-ck-douying</a></p></li><li><p>扫码后自动获取ck</p></li></ol><h3 id="✖️-小蓝鸟问题" tabindex="-1">✖️ 小蓝鸟问题 <a class="header-anchor" href="#✖️-小蓝鸟问题" aria-label="Permalink to &quot;✖️ 小蓝鸟问题&quot;">​</a></h3><p><strong>2024-2-5</strong>，修复小蓝鸟的时候看到free计划已经<a href="https://developer.twitter.com/en/portal/products/basic" target="_blank" rel="noreferrer">没有给查看Tweet的api</a>，原先<a href="https://github.com/PLhery/node-twitter-api-v2" target="_blank" rel="noreferrer">使用的库也出现了403报错</a>，开通会员要100美元，不值得。目前暂停更新，后续有方案和精力再更新！</p><blockquote><p>2024/2/26 目前的替代方案：使用第三方解析，但是无法解析组图，只能解析单个图片，望周知！</p></blockquote><h3 id="☀️-拉格朗日配置" tabindex="-1">☀️ 拉格朗日配置 <a class="header-anchor" href="#☀️-拉格朗日配置" aria-label="Permalink to &quot;☀️ 拉格朗日配置&quot;">​</a></h3><p>使用拉格朗日作为驱动的同学要进行两步：</p><ol><li>配置文件，将拉格朗日的配置文件<code>appsettings.json</code>中<code>Implementations</code>加入一个正向连接<code>ForwardWebSocket</code> ，如（最好是9091，这样就不用改tools配置文件）：</li></ol><div class="language-yaml vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">yaml</span><pre class="shiki shiki-themes vitesse-light vitesse-dark vp-code" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212;" tabindex="0"><code><span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">Implementations</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#999999;--shiki-dark:#666666;"> [</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666;">  {</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">Type</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;"> &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">ReverseWebSocket</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">Host</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;"> &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">127.0.0.1</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">Port</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91;"> 9090</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">Suffix</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;"> &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">/onebot/v11/</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">ReconnectInterval</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91;"> 5000</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">HeartBeatInterval</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91;"> 5000</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">AccessToken</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;"> &quot;&quot;</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666;">  },</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666;">  {</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">Type</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;"> &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">ForwardWebSocket</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">Host</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;"> &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">127.0.0.1</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">Port</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91;"> 9091</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">HeartBeatInterval</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#2F798A;--shiki-dark:#4C9A91;"> 5000</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">HeartBeatEnable</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#1E754F;--shiki-dark:#4D9375;"> true</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">,</span></span>
<span class="line"><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">    &quot;</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;">AccessToken</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;">&quot;</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;"> &quot;&quot;</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666;">  }</span></span>
<span class="line"><span style="--shiki-light:#999999;--shiki-dark:#666666;">]</span></span></code></pre></div><ol start="2"><li>在任意群里发送<code>#设置拉格朗日</code>，转换一下视频发送方式即可</li></ol><p><img src="https://s2.loli.net/2024/08/19/G5A72aojsUezKg1.webp" alt=""></p><h3 id="微信文章总结-完全免费总结" tabindex="-1">微信文章总结 （完全免费总结） <a class="header-anchor" href="#微信文章总结-完全免费总结" aria-label="Permalink to &quot;微信文章总结 （完全免费总结）&quot;">​</a></h3><p>官方Kimi API 暂时没有看到可以联网搜索的选项，所以选用开源的<a href="https://github.com/LLM-Red-Team/kimi-free-api" target="_blank" rel="noreferrer">kimi-free-api</a></p><ol><li>部署 kimi-free-api</li></ol><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes vitesse-light vitesse-dark vp-code" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212;" tabindex="0"><code><span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665;">docker</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> run</span><span style="--shiki-light:#A65E2B;--shiki-dark:#C99076;"> -it</span><span style="--shiki-light:#A65E2B;--shiki-dark:#C99076;"> -d</span><span style="--shiki-light:#A65E2B;--shiki-dark:#C99076;"> --init</span><span style="--shiki-light:#A65E2B;--shiki-dark:#C99076;"> --name</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> kimi-free-api</span><span style="--shiki-light:#A65E2B;--shiki-dark:#C99076;"> -p</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> 8000:8000</span><span style="--shiki-light:#A65E2B;--shiki-dark:#C99076;"> -e</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> TZ=Asia/Shanghai</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> vinlic/kimi-free-api:latest</span></span></code></pre></div><ol start="2"><li>更改下面两个选项，自行修改 <code>tools.yaml</code> 或者锅巴：</li></ol><div class="language-yaml vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">yaml</span><pre class="shiki shiki-themes vitesse-light vitesse-dark vp-code" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212;" tabindex="0"><code><span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965;">aiBaseURL</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;"> &#39;&#39;</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD;"> # 用于识图的接口，kimi默认接口为：https://api.moonshot.cn，其他服务商自己填写</span></span>
<span class="line"><span style="--shiki-light:#998418;--shiki-dark:#B8A965;">aiApiKey</span><span style="--shiki-light:#999999;--shiki-dark:#666666;">:</span><span style="--shiki-light:#B5695999;--shiki-dark:#C98A7D99;"> &#39;&#39;</span><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD;"> # 用于识图的api key，kimi接口申请：https://platform.moonshot.cn/console/api-keys</span></span></code></pre></div><ul><li>aiBaseURL：你服务器的地址部署的<code>kimi-free-api</code>，例如：<code>http://localhost:8000</code></li><li>aiApiKey：kimi 的 <code>refresh_token</code> （F12 -&gt; 应用（Application） -&gt; Local Storage -&gt; <code>https://kimi.moonshot.cn</code> -&gt; 找到）</li></ul><ol start="3"><li>开始游玩</li></ol><p><img src="https://s2.loli.net/2024/08/19/7Yty51og3JGpBn2.webp" alt="wxkimi"></p><h3 id="🍠-小红书的-cookie-问题" tabindex="-1">🍠 小红书的 Cookie 问题 <a class="header-anchor" href="#🍠-小红书的-cookie-问题" aria-label="Permalink to &quot;🍠 小红书的 Cookie 问题&quot;">​</a></h3><p>小红书导出 cookie 最佳实践，由群友 <code>@辰</code> 提供解决方案：</p><ol><li>下一个 <code>Cookie-Editor</code></li></ol><blockquote><ul><li><p>Chrome：<a href="https://chrome.google.com/webstore/detail/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noreferrer">https://chrome.google.com/webstore/detail/hlkenndednhfkekhgcdicdfddnkalmdm</a></p></li><li><p>Edge： <a href="https://microsoftedge.microsoft.com/addons/detail/cookieeditor/neaplmfkghagebokkhpjpoebhdledlfi" target="_blank" rel="noreferrer">https://microsoftedge.microsoft.com/addons/detail/cookieeditor/neaplmfkghagebokkhpjpoebhdledlfi</a></p></li><li><p>国内直通：<a href="https://www.crxsoso.com/webstore/detail/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noreferrer">https://www.crxsoso.com/webstore/detail/hlkenndednhfkekhgcdicdfddnkalmdm</a></p></li></ul></blockquote><ol start="2"><li>进入小红书 - 注册 - 点击 <code>Cookie-Editor</code> 的导出 <code>Header String</code></li></ol><p><img src="https://s2.loli.net/2024/08/19/5bWtgOeMlKSaZJH.webp" alt=""></p><h3 id="📺-关于使用-bbdown-下载" tabindex="-1">📺 关于使用 BBDown 下载 <a class="header-anchor" href="#📺-关于使用-bbdown-下载" aria-label="Permalink to &quot;📺 关于使用 BBDown 下载&quot;">​</a></h3><ul><li>Linux教程：<a href="https://pwa.sspai.com/post/83345" target="_blank" rel="noreferrer">https://pwa.sspai.com/post/83345</a></li><li>Windows教程：<a href="https://github.com/nilaoda/BBDown/issues/305" target="_blank" rel="noreferrer">https://github.com/nilaoda/BBDown/issues/305</a></li></ul><h3 id="⬇️-关于使用下载方式" tabindex="-1">⬇️ 关于使用下载方式 <a class="header-anchor" href="#⬇️-关于使用下载方式" aria-label="Permalink to &quot;⬇️ 关于使用下载方式&quot;">​</a></h3><ul><li>轻量</li></ul><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes vitesse-light vitesse-dark vp-code" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212;" tabindex="0"><code><span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665;">apt</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> install</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> wget</span></span>
<span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665;">apt</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> install</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> axel</span></span></code></pre></div><ul><li><p>稳定（无须安装任何东西）</p></li><li><p>性能</p></li></ul><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes vitesse-light vitesse-dark vp-code" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212;" tabindex="0"><code><span class="line"><span style="--shiki-light:#59873A;--shiki-dark:#80A665;">apt</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> install</span><span style="--shiki-light:#B56959;--shiki-dark:#C98A7D;"> aria2</span></span></code></pre></div><h3 id="✈️-关于小飞机解析" tabindex="-1">✈️ 关于小飞机解析 <a class="header-anchor" href="#✈️-关于小飞机解析" aria-label="Permalink to &quot;✈️ 关于小飞机解析&quot;">​</a></h3><ol><li>下载 <code>Release</code></li></ol><blockquote><p><a href="https://github.com/iyear/tdl" target="_blank" rel="noreferrer">https://github.com/iyear/tdl</a></p></blockquote><ol start="2"><li><p>放到环境变量，Linux用户可以直接解压放到<code>/usr/local/bin</code>下</p></li><li><p>登录，官方提供了三种登录方式</p></li></ol><p><img src="https://s2.loli.net/2024/08/15/Nu63gMOUeWnBhob.webp" alt=""></p><ol start="4"><li>添加信任用户（下面分别是设置、查看所有、查看特定信任用户），⚠️ 使用引用的方法去使用命令</li></ol><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes vitesse-light vitesse-dark vp-code" style="--shiki-light:#393a34;--shiki-dark:#dbd7caee;--shiki-light-bg:#ffffff;--shiki-dark-bg:#121212;" tabindex="0"><code><span class="line"><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD;">#设置R信任用户</span></span>
<span class="line"><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD;">#R信任用户</span></span>
<span class="line"><span style="--shiki-light:#A0ADA0;--shiki-dark:#758575DD;">#查询R信任用户</span></span></code></pre></div><p><img src="https://s2.loli.net/2024/08/15/uaJQOAYyVCg5vbF.webp" alt=""></p><p><img src="https://s2.loli.net/2024/08/15/Ul4kOw5SLjItWzu.webp" alt=""></p><p><img src="https://s2.loli.net/2024/08/15/zVTjAKYG28MbBuL.webp" alt=""></p><p><img src="https://s2.loli.net/2024/08/15/QVmNrKnsJPlpX9S.webp" alt=""></p><ol start="5"><li>开始使用！</li></ol><h3 id="🐧-关于使用-icqq" tabindex="-1">🐧 关于使用 ICQQ <a class="header-anchor" href="#🐧-关于使用-icqq" aria-label="Permalink to &quot;🐧 关于使用 ICQQ&quot;">​</a></h3><p>👍 群友<code>@非酋</code>推荐（经过大量测试得出）：icqq建议设置 <code>27MB</code> 转群文件</p><h3 id="🧑‍🌾-关于百度翻译" tabindex="-1">🧑‍🌾 关于百度翻译 <a class="header-anchor" href="#🧑‍🌾-关于百度翻译" aria-label="Permalink to &quot;🧑‍🌾 关于百度翻译&quot;">​</a></h3><p>【可选】相关配置(apps/tools.js)：</p><blockquote><p><code>百度翻译</code>api:<a href="https://fanyi-api.baidu.com/doc/21" target="_blank" rel="noreferrer">https://fanyi-api.baidu.com/doc/21</a><br> 注册完填入方式参考上方注释url (config/tools.yaml)；另外，有群友反馈百度翻译需要充钱才能使用！</p></blockquote><h3 id="🪄-关于魔法" tabindex="-1">🪄 关于魔法 <a class="header-anchor" href="#🪄-关于魔法" aria-label="Permalink to &quot;🪄 关于魔法&quot;">​</a></h3><blockquote><p>(非必要不更改)更改魔法在<code>config/tools.yaml</code> 或 <a href="https://gitee.com/guoba-yunzai/guoba-plugin" target="_blank" rel="noreferrer">锅巴插件</a>的配置位置：<br><code>proxyAddr: &#39;127.0.0.1&#39; # 魔法地址</code><br><code>proxyPort: &#39;7890&#39; # 魔法端口</code></p></blockquote><blockquote><p>海外服务器示例：<br> 直接发送<code>#设置海外解析</code></p></blockquote>`,74),h=[l];function n(p,k,o,r,d,c){return a(),s("div",null,h)}const u=i(e,[["render",n]]);export{y as __pageData,u as default};
