<p align="center">
  <a href="https://gitee.com/kyrzy0416/rconsole-plugin">
    <img width="200" src="./img/logo.webp">
  </a>
</p>


<div align="center">
    <h1>R-plugin</h1>
    写给朋友们用的<a href="https://gitee.com/Le-niao/Yunzai-Bot" target="_blank">Yunzai-Bot</a>插件，插件的各种业务来源于周围人
<img src="./img/github-contribution-grid-snake.svg">
</div>

> 📢 推荐 TG 个人互联网分享频道（分享日常冲浪互联网看到好玩的网站、app应用）：[RrOrange和朋友们](https://t.me/RrOrangeAndFriends)
## 🗃️ 文件架构
apps -- 业务核心

config -- 配置文件

img -- README图片

model -- 核心文件

resource -- 资源文件

utils -- 工具类



## 🧏 ‍使用实例
![help](./img/example.webp)

![xhs](./img/example2.webp)

![y2b](./img/example3.webp)

![mys](./img/example4.webp)

![zy](./img/example5.webp)

## 📔 使用说明

1.【必要】下载插件
```shell
# 国内
git clone https://gitee.com/kyrzy0416/rconsole-plugin.git ./plugins/rconsole-plugin/
# 海外
git clone https://github.com/zhiyu1998/rconsole-plugin.git ./plugins/rconsole-plugin/
```

2.【必要】在`Yunzai-Bot / Miao-Yunzai`目录下安装axios(0.27.2)、魔法工具（tunnel）、二维码处理工具（qrcode）、高性能下载队列（p-queue）、用于拉格朗日（ws）、用于识图（openai）


```shell
pnpm i -P --prefix ./plugins/rconsole-plugin/
```


3.【可选】要使用`视频解析`功能要下载插件【推荐ubuntu系统】
```shell
# ubuntu
sudo apt-get install ffmpeg
# 其他linux参考（群友推荐）：https://gitee.com/baihu433/ffmpeg
# Windows 参考：https://www.jianshu.com/p/5015a477de3c
````

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

`AM解析`需要使用两个依赖`freyr`、`atomicparsley`，现在只以Debian系统为例：

```shell
npm install -g freyr
# 或者你有yarn的话可以使用
yarn global add freyr
# 接着安装它的依赖
apt-get install atomicparsley
```

4. 【可选】小程序解析适配了：
* 喵崽：[Yoimiya / Miao-Yunzai](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
* TRSS：[时雨◎星空 / Yunzai](https://gitee.com/TimeRainStarSky/Yunzai)
* 听语惊花：[听语惊花 / Yunzai-Bot-lite](https://gitee.com/Nwflower/yunzai-bot-lite)

> 如果解析有问题参考issue：[#I6MFF7](https://gitee.com/kyrzy0416/rconsole-plugin/issues/I6MFF7)
> [#I7KQVY](https://gitee.com/kyrzy0416/rconsole-plugin/issues/I7KQVY)

<img src="./img/example6.webp" alt="小程序解析" width="50%" height="50%" />

5. 【可选】对哔哩哔哩解析进行总结：需要填写哔哩哔哩的SESSDATA，或者[【推荐】扫码登录](https://gitee.com/kyrzy0416/rconsole-plugin#b%E7%AB%99%E6%89%AB%E7%A0%81%E7%99%BB%E5%BD%95)

<img src="./img/example7.webp" alt="小程序解析" width="50%" height="50%" />

6. 【可选】增加视频的时长限制（默认8分钟(60 * 8 = 480)）：
- 在config/tools.yaml里设置`biliDuration`
- 锅巴设置

7. 【可选 & 慎重】下载指定版本的R插件：
如果你觉得当前版本的功能出现了问题，那么可以下载指定版本的插件，比如`1.5.1`：
```shell
# 删除当前的R插件
rm -rf ./plugins/rconsole-plugin/
# 克隆指定版本的R插件稳定版本
git clone -b 1.6.7-lts https://gitee.com/kyrzy0416/rconsole-plugin.git
```

##  🐤 Q&A
### B站扫码登录
命令：`#RBQ`，来自2024/4/1 才子 `Mix` 的命名

![rbq](./img/rbq.webp)

示例：
![rbq2](./img/rbq2.webp)

### 🎵 douyin问题
由于douyin的解析变化莫测，现版本需要填入自己的cookie，具体步骤如下：

> 👍 推荐方案，via 视频教程（由群友@麦满分 录制）：https://thumbsnap.com/rKxUGKqp

👍 推荐方案（感谢群友 @湘潭 提供的便捷方案）：
1. 打开`https://www.douyin.com/` 扫码登入自己的账号
2. F12进入控制台，打开`网络/network`
3. 搜索`www.douyin.com`，把下面的一串cookie复制进去即可

<img src="./img/dy_ck.webp" alt="小程序解析" width="50%" height="50%" />

备用方案1：

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

<img src="./img/douyin_cookie.webp" alt="小程序解析" width="50%" height="50%" />

备用方案2（由群友麦满分提供）:

在安卓手机下载一个via，在via那选择电脑网页版抖音，然后登录，登陆完点左上角小标有个cookie，复制

### ✖️ 小蓝鸟问题
**2024-2-5**，修复小蓝鸟的时候看到free计划已经[没有给查看Tweet的api](https://developer.twitter.com/en/portal/products/basic)，原先[使用的库也出现了403报错](https://github.com/PLhery/node-twitter-api-v2)，开通会员要100美元，不值得。目前暂停更新，后续有方案和精力再更新！

> 2024/2/26 目前的替代方案：使用第三方解析，但是无法解析组图，只能解析单个图片，望周知！

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

<img src="./img/lagrange.webp" width="30%" height="30%">

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

![wxkimi](./img/wxkimi.webp)

##  🤺 R插件交流群
扫码不行就：575663150

<img src="./img/qq.webp" width="30%" height="30%">

## 🧑‍🌾 进阶内容
【可选】相关配置(apps/tools.js)：
> `百度翻译`api:https://fanyi-api.baidu.com/doc/21  
> 注册完填入方式参考上方注释url (config/tools.yaml)；另外，有群友反馈百度翻译需要充钱才能使用！

> (非必要不更改)更改魔法在`config/tools.yaml` 或 [锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin)的配置位置：  
`proxyAddr: '127.0.0.1' # 魔法地址`  
`proxyPort: '7890' # 魔法端口`

> 海外服务器示例：  
> 直接发送`#设置海外解析`


## 📦 业务
![help](./img/help.webp)

## 📝 计划功能
- [x] YouTube解析（这个可能要🕊一久）
- [ ] Instagram解析修复
  - [ ] 单张图片解析
  - [ ] 视频解析
- [x] 哔哩哔哩总结
- [x] xhs解析去水印
- [x] kuai_shou解析
- [x] xi_gua视频解析
- [ ] ...



## 🔗 链接

- [云崽](https://gitee.com/yoimiya-kokomi/Yunzai-Bot)
- [云崽轻量级](https://gitee.com/Nwflower/yunzai-bot-lite)
- [插件库](https://gitee.com/Hikari666/Yunzai-Bot-plugins-index)

## 🙏 贡献
🌸 感谢下面的朋友对我插件的贡献（排名不分高低）
* [好冷](https://gitee.com/hetangx) 提供Windows解决方案
* [一杯凉](https://gitee.com/yibeiliang) 提供小程序解析冲突解决方案
* [x0rz4](https://gitee.com/x0rz4) 提供依赖掉包解决方案


🌸 同时鸣谢感谢以下开发者对 `R插件` 出的贡献：

<a href="https://github.com/zhiyu1998/rconsole-plugin/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=zhiyu1998/rconsole-plugin&max=1000" />
</a>

🌸 感谢以下框架的开源：
- [yt-dlp:A youtube-dl fork with additional features and fixes](https://github.com/yt-dlp/yt-dlp)
- [freyr-js](https://github.com/miraclx/freyr-js)
- [kimi-free-api](https://github.com/LLM-Red-Team/kimi-free-api)

##  ☕ 请我喝一杯瑞幸咖啡
如果你觉得插件能帮助到你增进好友关系，那么你可以在有条件的情况下[请我喝一杯瑞幸咖啡](https://afdian.net/a/zhiyu1998)，这是我开源这个插件的最大动力！
感谢以下朋友的支持！（排名不分多少）

> ps. 如果你是学生建议把钱花在饭卡上，谢谢你对R插件喜欢！

|       昵称        | 赞助   |
|:---------------:|------|
|      为爱发巅       | 1杯瑞幸 |
|       丘丘莹       | 5    |
|    Allweknow    | 1杯瑞幸 |
|      MNJv       | 5    |
|        n        | 4杯瑞幸 |
|       一杯凉       | 30   |
| 左轮（ps. 我导师，泪目！） | 1杯瑞幸 |
| mitsuha / 下次一定  | 4杯瑞幸 |
|    [Kr] 5s¹     | 1杯瑞幸 |
|     春日野穹OvO     | 25   |
|       MiX       | 30   |
|       AO        | 26   |
|       Chino        | 30   |

## 🚀 声明
* 文件借鉴了很多插件，精简个人认为可以精简的内容。
* 素材来源于网络，仅供交流学习使用
* 严禁用于任何商业用途和非法行为
* 如果对你有帮助辛苦给个star，这是对我最大的鼓励

## 📃 日志
![Alt](https://repobeats.axiom.co/api/embed/42b5a7769074be124bd9ab02456897e37d1581f1.svg "Repobeats analytics image")
[![zhiyu/rconsole-plugin](https://gitee.com/kyrzy0416/rconsole-plugin/widgets/widget_card.svg?colors=4183c4,ffffff,ffffff,e3e9ed,666666,9b9b9b)](https://gitee.com/kyrzy0416/rconsole-plugin)