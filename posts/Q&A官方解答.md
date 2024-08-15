---
title: Q&A官方解答
description: R插件的问题解答
date: 2024-08-15
tags:
  - 问题解答
---

##  🐤 Q&A
### 📺 B站扫码登录
命令：`#RBQ`，来自2024/4/1 才子 `Mix` 的命名

![rbq](https://alist.rrorangedev.net/d/Kua/PicGo/rbq.webp)

示例：
![rbq2](https://alist.rrorangedev.net/d/Kua/PicGo/rbq2.webp)

[👉 返回目录](#-qa)

### 🎵 douyin问题

由于douyin的解析变化莫测，现版本需要填入自己的cookie，具体步骤如下：

👍 **推荐方案** ：via 视频教程（由群友 `@麦满分` 录制）：https://thumbsnap.com/rKxUGKqp

![](https://51shazhu.com/autoupload/20240714/Ew6x/1024X640/rKxUGKqp.gif?type=ha)

👍 **推荐方案**（感谢群友 `@湘潭` 提供的便捷方案）：
1. 打开`https://www.douyin.com/` 扫码登入自己的账号
2. F12进入控制台，打开`网络/network`
3. 搜索`www.douyin.com`，把下面的一串cookie复制进去即可

<img src="https://alist.rrorangedev.net/d/Kua/PicGo/dy_ck.webp" alt="小程序解析" width="50%" height="50%" />

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

<img src="https://alist.rrorangedev.net/d/Kua/PicGo/douyin_cookie.webp" alt="小程序解析" width="50%" height="50%" />

**备用方案2** （由`@重装小兔`提供）

1. 下载python

> 下载链接：[官网](https://www.python.org/) | [微软商店](https://apps.microsoft.com/detail/9pjpw5ldxlz5?hl=zh-cn&gl=CN)

2. 下载：https://gitee.com/OvertimeBunny/tiktok-ck-douying

3. 扫码后自动获取ck

[👉 返回目录](#-qa)

### ✖️ 小蓝鸟问题
**2024-2-5**，修复小蓝鸟的时候看到free计划已经[没有给查看Tweet的api](https://developer.twitter.com/en/portal/products/basic)，原先[使用的库也出现了403报错](https://github.com/PLhery/node-twitter-api-v2)，开通会员要100美元，不值得。目前暂停更新，后续有方案和精力再更新！

> 2024/2/26 目前的替代方案：使用第三方解析，但是无法解析组图，只能解析单个图片，望周知！

[👉 返回目录](#-qa)

### ☀️ 拉格朗日配置

使用拉格朗日作为驱动的同学要进行两步：

1. 配置文件，将拉格朗日的配置文件`appsettings.json`中`Implementations`加入一个正向连接`ForwardWebSocket`
   ，如（最好是9091，这样就不用改tools配置文件）：

```yaml
"Implementations": [
  {
    "Type": "ReverseWebSocket",
    "Host": "127.0.0.1",
    "Port": 9090,
    "Suffix": "/onebot/v11/",
    "ReconnectInterval": 5000,
    "HeartBeatInterval": 5000,
    "AccessToken": ""
  },
  {
    "Type": "ForwardWebSocket",
    "Host": "127.0.0.1",
    "Port": 9091,
    "HeartBeatInterval": 5000,
    "HeartBeatEnable": true,
    "AccessToken": ""
  }
]
```

2. 在任意群里发送`#设置拉格朗日`，转换一下视频发送方式即可

<img src="https://alist.rrorangedev.net/d/Kua/PicGo/lagrange.webp" width="30%" height="30%">

[👉 返回目录](#-qa)

### 微信文章总结 （完全免费总结）

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

- aiBaseURL：你服务器的地址部署的`kimi-free-api`，例如：http://localhost:8000
- aiApiKey：kimi 的 `refresh_token` （F12 -> 应用（Application） -> Local Storage -> `https://kimi.moonshot.cn` -> 找到）

3. 开始游玩

![wxkimi](https://alist.rrorangedev.net/d/Kua/PicGo/wxkimi.webp)

[👉 返回目录](#-qa)

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

![](https://alist.rrorangedev.net/d/Kua/PicGo/xhs-ck-export.webp)

[👉 返回目录](#-qa)

### 📺 关于使用 BBDown 下载

- Linux教程：https://pwa.sspai.com/post/83345
- Windows教程：https://github.com/nilaoda/BBDown/issues/305

[👉 返回目录](#-qa)

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

[👉 返回目录](#-qa)

### ✈️ 关于小飞机解析

1. 下载 `Release`

> https://github.com/iyear/tdl

2. 放到环境变量，Linux用户可以直接解压放到`/usr/local/bin`下

3. 登录，官方提供了三种登录方式

<img src="https://alist.rrorangedev.net/d/Kua/PicGo/aircraft.webp" width="30%" height="30%">

4. 添加信任用户（下面分别是设置、查看所有、查看特定信任用户），⚠️ 使用引用的方法去使用命令

```shell
#设置R信任用户
#R信任用户
#查询R信任用户
```

<img src="https://alist.rrorangedev.net/d/Kua/PicGo/aircraft1.webp" width="30%" height="30%">

<img src="https://alist.rrorangedev.net/d/Kua/PicGo/aircraft2.webp" width="30%" height="30%">

<img src="https://alist.rrorangedev.net/d/Kua/PicGo/aircraft3.webp" width="30%" height="30%">

<img src="https://alist.rrorangedev.net/d/Kua/PicGo/aircraft4.webp" width="30%" height="30%">

5. 开始使用！

[👉 返回目录](#-qa)

### 🐧 关于使用 ICQQ

👍 群友`@非酋`推荐（经过大量测试得出）：icqq建议设置 `27MB` 转群文件

[👉 返回目录](#-qa)

### 🧑‍🌾 关于百度翻译

【可选】相关配置(apps/tools.js)：
> `百度翻译`api:https://fanyi-api.baidu.com/doc/21  
> 注册完填入方式参考上方注释url (config/tools.yaml)；另外，有群友反馈百度翻译需要充钱才能使用！

[👉 返回目录](#-qa)

### 🪄 关于魔法

> (非必要不更改)更改魔法在`config/tools.yaml` 或 [锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin)的配置位置：  
`proxyAddr: '127.0.0.1' # 魔法地址`  
`proxyPort: '7890' # 魔法端口`

> 海外服务器示例：  
> 直接发送`#设置海外解析`

[👉 返回目录](#-qa)