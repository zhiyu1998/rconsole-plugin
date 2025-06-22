---
title: QA官方解答
description: R插件的问题解答
date: 2025-06-22
tags:
  - 问题解答
---

##  🐤 Q&A

### 📢 太子专用的 AI 文档问答

~~#R文档 已弃用~~

~~现已升级为 **v🐔奇** 智能文档~~

有问题进群后咨询群里大佬即可( •̀ ω •́ )✧

1. ~~进群后发送命令，命令是：`#R文档 xxx`，比如：`#R文档 如何使用yt-dlp`~~

![](https://s2.loli.net/2024/09/17/dxMhfTZr4jw6CzX.png)

示例回答：
![](https://s2.loli.net/2024/09/17/zLEpRq9s6rXNPAc.png)

~~如果要进行文档更新，可以使用：`#R文档 更新`~~

![](https://s2.loli.net/2024/09/28/AsvmJLpylbZQoex.png)

2. 通过 GLM 进行问答（暂时的）

![](https://camo.githubusercontent.com/db979437e758fc465e2cc8496e5cb64370281f8eebb23c89ae45c104d53a0c85/68747470733a2f2f73322e6c6f6c692e6e65742f323032342f31302f31322f6544693646635949546b4d557053622e706e67)


### 🧴 关于容器视频文件发送解决方案

造成此原因是 nc 被隔离在容器中无法获取宿主机下 yunzai 目录下载好的视频文件

1. 由我的朋友@春日野穹提供的方案，重装下 napcat 就可以

> 此方法适用于 nc 为容器，yunzai 运行在宿主机
```shell
docker run -d \
-e NAPCAT_GID=$(id -g) \
-e NAPCAT_UID=$(id -u) \
-v /root/TRSS_AllBot:/root/TRSS_AllBot \
--network host \
--name napcat \
--restart=always \
mlikiowa/napcat-docker:latest
```

> 相较于原命令，将容器网络改为host，避免萌新无法ws链接宿主机网络

> 重点是 `-v <主机路径>:<容器路径> \ `映射 yunzai 宿主机文件目录至 nc 容器

2. 或简单一点使用 base64 发送文件 由@湘潭提供

修改 `yunzai目录/plugins/adapter/OneBotv11.js` (大约在42行左右)

```js
  async makeFile(file, opts) {
    file = await Bot.Buffer(file, {
      http: true, size: 10485760, ...opts,
    })
    if (Buffer.isBuffer(file))
      return `base64://${file.toString("base64")}`
    return file
  }
```
将其中的 `10485760` 数字后加两个零

> 此方法性能消耗较大且长视频可能无法发送


3. 如果你yunzai和nc都为容器？？？？？
- 将两个容器目录映射宿主机再互相映射
- 或创建并挂载共享数据卷

### ♻️ 关于更新问题

请使用我开发的可以携带数据的更新，而不是 Yunzai 的全局更新方法，防止丢失cookie

命令集合：
```shell
#R更新
#R强制更新
```

> 注意：R为大写

✅ 正确演示：

> ![](https://s2.loli.net/2024/09/28/BIcV4XM5J1TroYg.png)

❌ 错误演示：

> #强制更新rconsole-plugin
> 
> ![977AA674A05B3CB54F7C3E7721E837A1.jpg](https://s2.loli.net/2024/10/18/Nl6ZI3Se2fFXs9T.jpg)

### 🛠️ 使用方法（基础）

1.【必要】下载插件
```shell
# 国内
git clone https://gitee.com/kyrzy0416/rconsole-plugin.git ./plugins/rconsole-plugin/
# 海外
git clone https://github.com/zhiyu1998/rconsole-plugin.git ./plugins/rconsole-plugin/
```

2.【必要】在`Yunzai-Bot / Miao-Yunzai`目录下安装axios(0.27.2)、魔法工具（tunnel）、二维码处理工具（qrcode）、高性能下载队列（p-queue）、用于拉格朗日（ws）、用于识图（openai）


```shell
pnpm i --filter=rconsole-plugin
```


### 🎬 视频解析使用说明

3.【可选】要使用`视频解析`功能要下载插件【推荐ubuntu系统】
```shell
# ubuntu
sudo apt-get install ffmpeg
# 其他linux参考（群友推荐）：https://gitee.com/baihu433/ffmpeg
# Windows 参考：https://www.jianshu.com/p/5015a477de3c
````

### 🎥 油管和Tiktok使用说明

`油管解析`需要 `yt-dlp` 的依赖才能完成解析（三选一）：
```shell
# 三选一
# ubuntu （国内 or 国外，且安装了snap）
snap install yt-dlp
# debian 海外
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp
chmod a+rx ~/.local/bin/yt-dlp
# debian 国内
curl -L https://ghproxy.net/https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp
chmod a+rx ~/.local/bin/yt-dlp
# archlinux
sudo pacman -Syu yt-dlp
```

`Tiktok解析`需要将`yt-dlp`升级到`最新版本`，如果不会可以按照下面的教程（Linux），Windows换个文件应该就可以：
```shell
# 1. 去官方下载最新版本：https://github.com/yt-dlp/yt-dlp/releases
# 2. 把yt-dlp放在Linux某个位置，比如/home/YtDlpHome/yt-dlp
# 3. 删除之前的yt-dlp，删除之前可以看看是不是最新版本

# 查看最新版本
yt-dlp --version
# 如果你是 apt 安装需要卸载
apt remove yt-dlp

# 4. 将/home/YtDlpHome/yt-dlp添加到环境变量（下面二选一）
vim ~/.bashrc  # 如果你使用 bash
vim ~/.zshrc   # 如果你使用 zsh

# 5. 添加到最后一行
export PATH="/home/YtDlpHome:$PATH"

# 6. 刷新环境变量即可
source ~/.bashrc  # 如果你使用 bash
source ~/.zshrc   # 如果你使用 zsh
```

### 🚀 WebUI启动方法

> 此功能已于2024.12.1分离，后续版本默认不支持

1. 在群里发送 `#rwss` 以构建和启动网页：

2. 查看机器人发送给你的私信地址，重启 Yunzai 后即可看到

![PixPin_2024-11-25_20-08-57.png](https://s2.loli.net/2024/11/25/VQeCRZ7ojvSqBzm.png)

3. 通过 `#rws` 可以查看 WebUI的状态

### 🍏 Apple Music 和 Spotify 使用说明

`AM解析`和`Spotify解析`需要使用两个依赖`freyr`、`atomicparsley`，现在只以Debian系统为例：

```shell
npm install -g freyr
# 或者你有yarn的话可以使用
yarn global add freyr
# 接着安装它的依赖
apt-get install atomicparsley
```


### 📺 B站总结

对哔哩哔哩解析进行总结：需要填写哔哩哔哩的SESSDATA，或者[【推荐】扫码登录](https://gitee.com/kyrzy0416/rconsole-plugin#b%E7%AB%99%E6%89%AB%E7%A0%81%E7%99%BB%E5%BD%95)

<img src="https://s2.loli.net/2024/08/19/MH6f1AuEKgPIUOB.webp" alt="小程序解析" width="50%" height="50%" />

### 📺 B站扫码登录
命令：`#RBQ`，来自2024/4/1 才子 `Mix` 的命名

![rbq](https://s2.loli.net/2024/08/19/2ljBYQgSLUEXTKN.webp)

示例：
![rbq2](https://s2.loli.net/2024/08/19/kqLVxKluECW4YGN.webp)

### ⏳ 视频时长限制说明

增加视频的时长限制（默认8分钟(60 * 8 = 480)）：
- 在config/tools.yaml里设置`biliDuration`
- 锅巴设置

### 💎 关于网易云高音质解析

> 由于公开的API过老 出现有些歌曲无法解析的问题，所以必须搭建个人解析API才可使用该功能

🏅【强烈推荐】搭建个人网易云解析API
 
🦊 更多搭建方法参考[NeteaseCloudMusicApi](https://gitlab.com/Binaryify/neteasecloudmusicapi)

👍 **推荐方案** :🐬docker 部署
```shell
docker pull binaryify/netease_cloud_music_api

docker run -d -p 3000:3000 --name netease_cloud_music_api    binaryify/netease_cloud_music_api

## 或者
docker run -d -p 3000:3000 binaryify/netease_cloud_music_api

## 去掉或者设置相关的环境变量

docker run -d -p 3000:3000 --name netease_cloud_music_api -e http_proxy= -e https_proxy= -e no_proxy= -e HTTP_PROXY= -e HTTPS_PROXY= -e NO_PROXY= binaryify/netease_cloud_music_api

## 或者
docker run -d -p 3000:3000 -e http_proxy= -e https_proxy= -e no_proxy= -e HTTP_PROXY= -e HTTPS_PROXY= -e NO_PROXY= binaryify/netease_cloud_music_api
```
> 不会用docker怎么办？使用[docker desktop](https://www.docker.com/products/docker-desktop/)

打开命令行

<img src="https://s2.loli.net/2024/10/16/2i6aBethbOorIA8.png" alt="打开命令行" width="50%" height="50%" />

```shell
##拉取镜像
docker pull binaryify/netease_cloud_music_api
```
点击运行

<img src="https://s2.loli.net/2024/10/16/azIPlT5bX9sgrjF.png" alt="运行" width="70%" height="50%" />

参数设置

<img src="https://s2.loli.net/2024/10/16/pUJQv3XYo1eEsAD.png" alt="设置" width="50%" height="50%" />

看到这一行，证明服务已经跑起来了

<img src="https://s2.loli.net/2024/10/16/jw5pPLnK7M2aWVr.png" alt="run" width="70%" height="50%" />

> 请注意，如果跟我一样上面自定义的端口是2222:3000 这时候你访问你的API的地址就应该是`http://localhost:2222`

- 更改下面两个选项，自行修改 `tools.yaml` 或者锅巴：

```yaml
useLocalNeteaseAPI: 'true' # 开启自建API服务
neteaseCloudAPIServer: '' # 填入刚刚跑起来的API地址 例如上面 就填入http://localhost:2222
```
🍪 获取网易云Cookie

> 需要网易云VIP账号 VIP最高解析->高清环绕音 SVIP最高解析->超清母带

👍 **推荐方案** : 扫码登录 发送 `#rnq` 使用网易云APP进行扫码

<img src="https://s2.loli.net/2024/10/16/9FZS1PldCyuVp6c.png" alt="rnq" width="70%" height="50%" />

- Cookie获取备用方案

1. 打开`https://music.163.com/` 登入自己的账号，点击自己头像->我的主页
2. F12进入控制台，打开`网络/network`
3. 点击`Fetch/XHR`
4. 找到`info`开头的请求，把下面的一串`MUSIC_U=`开头复制到`;`结尾

> 如果请求过于多，可以点击左上角的删除，再刷新页面即可

![image.png](https://s2.loli.net/2024/10/16/WbCs2YHqzkwoAnE.png)


- 自行修改 `tools.yaml` 填写 或者锅巴：

> 注意！！要在Cookie的尾部拼接 `; os=pc` 否则无法进行最高音质解析

```yaml
neteaseCookie: '' # 网易云Cookie 例：MUSIC_U=xxxxxxxxxxxxx; os=pc
```

👑 网易云登录状态 发送 `#rns` 可以查看当前登录账号VIP状态

![image.png](https://s2.loli.net/2024/10/16/BNFUcT3DXVpYKMS.png)

🎸 网易云解析音质选择

- 自行修改 `tools.yaml` 填写 或者 锅巴：

> 不推荐杜比全景声，解析过后会发送MP4文件，编码格式为AC-4，需要设备支持才能播放

> 最高支持的解析取决于 `vip等级` 和 `歌曲本身支持最高音质` 如没有设定的音质选项则自动向下选取

```yaml
neteaseCloudAudioQuality: '' # 网易云解析最高音质 默认exhigh(极高) 分类：standard => 标准,higher => 较高, exhigh=>极高, lossless=>无损, hires=>Hi-Res, jyeffect => 高清环绕声, sky => 沉浸环绕声, dolby => 杜比全景声(不推荐), jymaster => 超清母带
```

### 🔄 R插件版本回退方法（慎重）

下载指定版本的R插件：
如果你觉得当前版本的功能出现了问题，那么可以下载指定版本的插件，比如`1.5.1`：
```shell
# 删除当前的R插件
rm -rf ./plugins/rconsole-plugin/
# 克隆指定版本的R插件稳定版本
git clone -b 1.6.7-lts https://gitee.com/kyrzy0416/rconsole-plugin.git
```

### 🎵 关于 douyin 直播切片问题

如果没法发出视频，ICQQ直接开启兼容模式

![](https://s2.loli.net/2024/10/03/YEz85pZNI7cuBXC.png)

LLO有两个选择：
- 退回版本到`3.27.2`
- 开启兼容模式

> 开启兼容模式后性能会下降，但是可以发出直播切片

### 🎵 douyin问题

由于douyin的解析变化莫测，现版本需要填入自己的cookie，具体步骤如下：

👍 **推荐方案** ：via 视频教程（由群友 `@麦满分` 录制）：https://thumbsnap.com/rKxUGKqp

![](https://51shazhu.com/autoupload/20240714/Ew6x/1024X640/rKxUGKqp.gif?type=ha)

👍 **推荐方案**（感谢群友 `@湘潭` 提供的便捷方案）：
1. 打开`https://www.douyin.com/` 扫码登入自己的账号
2. F12进入控制台，打开`网络/network`
3. 搜索`www.douyin.com`，把下面的一串cookie复制进去即可

![](https://s2.loli.net/2024/08/19/E8SWgNZKlHmC6oi.webp)

**备用方案1** ：

1. 打开`https://www.douyin.com/` 扫码登入自己的账号
2. F12进入控制台，或者下载一个[Cookie-Editor](https://www.crxsoso.com/webstore/detail/hlkenndednhfkekhgcdicdfddnkalmdm)
3. 如果是F12，就将以下参数填入到`tools.yaml - douyinCookie`，或者使用锅巴
> odin_tt=xxx;passport_fe_beating_status=xxx;sid_guard=xxx;uid_tt=xxx;uid_tt_ss=xxx;sid_tt=xxx;sessionid=xxx;sessionid_ss=xxx;sid_ucp_v1=xxx;ssid_ucp_v1=xxx;passport_assist_user=xxx;ttwid=xxx;

3. 如果是`Cookie-Editor`就直接到插件复制到`tools.yaml - douyinCookie`，或者锅巴

具体图示，找以下这几个：
- odin_tt
- passport_fe_beating_status
- sid_guard
- uid_tt
- uid_tt_ss
- sid_tt
- sessionid
- sessionid_ss
- sid_ucp_v1
- ssid_ucp_v1
- passport_assist_user
- ttwid

![](https://s2.loli.net/2024/08/19/2kUgsz1RntZmQje.webp)

**备用方案2** （由`@重装小兔`提供）

1. 下载python

> 下载链接：[官网](https://www.python.org/) | [微软商店](https://apps.microsoft.com/detail/9pjpw5ldxlz5?hl=zh-cn&gl=CN)

2. 下载：https://gitee.com/OvertimeBunny/tiktok-ck-douying

3. 扫码后自动获取ck



### ✖️ 小蓝鸟问题
**2024-2-5**，修复小蓝鸟的时候看到free计划已经[没有给查看Tweet的api](https://developer.twitter.com/en/portal/products/basic)，原先[使用的库也出现了403报错](https://github.com/PLhery/node-twitter-api-v2)，开通会员要100美元，不值得。目前暂停更新，后续有方案和精力再更新！

> 2024/2/26 目前的替代方案：使用第三方解析，但是无法解析组图，只能解析单个图片，望周知！

### 🗂️ 微信文章总结 （完全免费总结）

官方Kimi API 暂时没有看到可以联网搜索的选项，所以选用开源的[kimi-free-api](https://github.com/LLM-Red-Team/kimi-free-api)

1. 部署 kimi-free-api

```shell
docker run -it -d --init --name kimi-free-api -p 8000:8000 -e TZ=Asia/Shanghai vinlic/kimi-free-api:latest
```

2. 更改下面两个选项，自行修改 `tools.yaml` 或者锅巴：

```yaml
aiBaseURL: '' # 用于识图的接口，kimi默认接口为：https://api.moonshot.cn，其他服务商自己填写
aiApiKey: '' # 用于识图的api key，kimi接口申请：https://platform.moonshot.cn/console/api-keys
```

- aiBaseURL：你服务器的地址部署的`kimi-free-api`，例如：`http://localhost:8000`
- aiApiKey：kimi 的 `refresh_token` （F12 -> 应用（Application） -> Local Storage -> `https://kimi.moonshot.cn` -> 找到）

3. 开始游玩

![wxkimi](https://s2.loli.net/2024/08/19/7Yty51og3JGpBn2.webp)

### 🍠 小红书的 Cookie 问题

小红书导出 cookie 最佳实践，由群友 `@辰` 提供解决方案：

1. 下一个 `Cookie-Editor`

> - Chrome：https://chrome.google.com/webstore/detail/hlkenndednhfkekhgcdicdfddnkalmdm
>
> - Edge：
    >   https://microsoftedge.microsoft.com/addons/detail/cookieeditor/neaplmfkghagebokkhpjpoebhdledlfi
>
> - 国内直通：https://www.crxsoso.com/webstore/detail/hlkenndednhfkekhgcdicdfddnkalmdm


2. 进入小红书 - 注册 - 点击 `Cookie-Editor` 的导出 `Header String`

![](https://s2.loli.net/2024/08/19/5bWtgOeMlKSaZJH.webp)

### 📺 关于使用 BBDown 下载

- Linux教程：https://pwa.sspai.com/post/83345
- Windows教程：https://github.com/nilaoda/BBDown/issues/305

### ⬇️ 关于使用下载方式

- 轻量

```shell
apt install wget
apt install axel
```

- 稳定（无须安装任何东西）

- 性能
```shell
apt install aria2
```

### ✈️ 关于小飞机 & X 解析 & 验车 权限问题

1. 下载 `Release`

> https://github.com/iyear/tdl

2. 放到环境变量，Linux用户可以直接解压放到`/usr/local/bin`下

3. 登录，官方提供了三种登录方式

![](https://s2.loli.net/2024/08/15/Nu63gMOUeWnBhob.webp)

4. `X 解析`、`小飞机`、`验车`涉及添加信任用户问题（下面分别是设置、查看所有、查看特定信任用户），⚠️ 使用引用的方法去使用命令

```shell
#设置R信任用户
#R信任用户
#查询R信任用户
#删除R信任用户
```

![](https://s2.loli.net/2024/08/15/uaJQOAYyVCg5vbF.webp)

![](https://s2.loli.net/2024/08/15/Ul4kOw5SLjItWzu.webp)

![](https://s2.loli.net/2024/08/15/zVTjAKYG28MbBuL.webp)

![](https://s2.loli.net/2024/08/15/QVmNrKnsJPlpX9S.webp)

5. 开始使用！

### 👀 关于 weibo 问题汇总

关于issue提出了相关：[希望文档里加入微博使用说明](https://github.com/zhiyu1998/rconsole-plugin/issues/19)

出现：`解析失败：无法获取到wb的id` 代表什么

> 就是没有数据，识别不到

### 🐧 关于使用 ICQQ

👍 群友`@非酋`推荐（经过大量测试得出）：icqq建议设置 `27MB` 转群文件

### 🧑‍🌾 关于百度翻译

【可选】相关配置(apps/tools.js)：
> `百度翻译`api:https://fanyi-api.baidu.com/doc/21  
> 注册完填入方式参考上方注释url (config/tools.yaml)；另外，有群友反馈百度翻译需要充钱才能使用！

### 🪄 关于 魔法 && 海外服务器 问题

> (非必要不更改)更改魔法在`config/tools.yaml` 或 [锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin)的配置位置：  
`proxyAddr: '127.0.0.1' # 魔法地址`  
`proxyPort: '7890' # 魔法端口`

> 海外服务器示例：  
> 直接发送`#设置海外解析`

### 💦 海外服务器使用 yt-dlp 提示 Sign in to confirm you're not a bot. This helps protect our community. Learn more

> 🚀 由 @春日野穹 提供解决方案

![ytdlp1.png](https://s2.loli.net/2024/11/06/zXrjhe6APpB94Z2.png)

解决方案：
1. 更新最新版R插件（2024/11/06）
2. 本地使用chrome浏览器**登录**YouTube并且安装浏览器插件[Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   ![ytdlp2.png](https://s2.loli.net/2024/11/06/mwFsAZpr2j354Xf.png)
3. 打开YouTube主页并点击右上角插件，根据下图顺序点击复制cookies内容
   ![ytdlp3.png](https://s2.loli.net/2024/11/06/9c5JA4MV2inBKR6.png)
4. 打开ssh并创建cookies.txt，我的路径设置为/root/TRSS_AllBot/TRSS-Yunzai/plugins/rconsole-plugin/config/cookies.txt，如果你修改过容器的话，请确保自己的路径正确
```
nano /root/TRSS_AllBot/TRSS-Yunzai/plugins/rconsole-plugin/config/cookies.txt
```
粘贴刚刚复制来的内容，然后Ctrl+O保存Ctrl+X退出

5. 进入锅巴webui并修改R插件配置：
如下图
![ytdkp4.png](https://s2.loli.net/2024/11/06/b6k7gFyDMEI5oqH.png)
**记得保存！！！**
重启trss后生效，海外服务器记得设置  #设置海外解析

### 📱 关于小程序

小程序解析适配了：
* 喵崽：[Yoimiya / Miao-Yunzai](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
* TRSS：[时雨◎星空 / Yunzai](https://gitee.com/TimeRainStarSky/Yunzai)
* 听语惊花：[听语惊花 / Yunzai-Bot-lite](https://gitee.com/Nwflower/yunzai-bot-lite)

> 如果解析有问题参考issue：[#I6MFF7](https://gitee.com/kyrzy0416/rconsole-plugin/issues/I6MFF7)
> [#I7KQVY](https://gitee.com/kyrzy0416/rconsole-plugin/issues/I7KQVY)

<img src="https://s2.loli.net/2024/08/19/uo1J35V4vMDUSbN.webp" alt="小程序解析" width="50%" height="50%" />

