<p align="center">
  <a href="https://gitee.com/kyrzy0416/rconsole-plugin">
    <img width="200" src="./img/logo.png">
  </a>
</p>

<div align="center">
    <h1>R-plugin</h1>
    写给朋友们用的<a href="https://gitee.com/Le-niao/Yunzai-Bot" target="_blank">Yunzai-Bot</a>插件，插件的各种业务来源于周围人
<img src="https://cdn.jsdelivr.net/gh/xianxincoder/xianxincoder/assets/github-contribution-grid-snake.svg">
</div>

## 🗃️ 文件架构
apps -- 业务核心

config -- 配置文件

img -- readme图片

model -- 核心文件[建议不动]

resource -- 资源文件

test -- 爬虫文件[python]

utils -- 工具类

index -- 主入口

## 🧏 ‍使用实例
![help](./img/example.png)
![help](./img/example2.png)
![help](./img/example3.png)
![help](./img/example4.png)
![help](./img/example5.png)

## 🤺 BUG及时交流群
【关于Windows适配】目前 [好冷群友](https://gitee.com/hetangx) 已经提供了一个比较可靠的解决方案，已经采纳并使用！

![help](./img/community.jpg)
> 备用方案：https://t.me/+ZsZMNE8OI7E3MDdl

## 📔 使用说明

1.【必要】在`Yunzai-Bot`安装axios(0.27.2)、代理工具（tunnel）、TwitterAPI依赖
```shell
pnpm add axios tunnel twitter-api-v2 -w
```

2.【必要】下载插件
```shell
git clone https://gitee.com/kyrzy0416/rconsole-plugin.git ./plugins/rconsole-plugin/
```

3.【可选】要使用`视频解析`功能要下载插件【推荐ubuntu系统】
```shell
# ubuntu
sudo apt-get install ffmpeg
# centos 参考：https://blog.csdn.net/XIAOGUANG_/article/details/105343886
# Windows 参考：https://www.jianshu.com/p/5015a477de3c
````

## 🧑‍🌾 【可选】进阶内容
这个功能由[烦烦同学](https://github.com/nilfunc
)提出的需求，正好符合插件的宗旨`为朋友所写的功能`。在使用这个功能之前需要安装以下：  
在Yunzai主目录使用以下命令
> pnpm add mongoose -w

安装Mongodb（别看错了，下载`4.`版本）：
> 官网地址：https://www.mongodb.com/try/download/community

### 使用Mongoose进行自定义对话
需要把代码(apps/rchat.js)注释取消（因为不是每个人都想装mongodb）：
> 注释的地方例如：// import mongoose from "mongoose";  
> 取消注释快捷键：`ctrl + /`

### 进阶内容使用说明
❓ 询问：@机器人 （问题）  
➕增加问题：@机器人 add（问题）  
❌删除问题：@机器人 del（问题）  
⭕更新问题：@机器人 update（问题）  
![help](./img/example6.png)

### 其他进阶操作
【可选】相关配置(apps/tools.js)：
> 小蓝鸟api:https://developer.twitter.com/en  
注册完之后将`Bearer Token`填入config/tools.yaml`

> 百度翻译api:https://fanyi-api.baidu.com/doc/21  
注册完填入方式参考上方注释url (config/tools.yaml)；另外，有群友反馈百度翻译需要充钱才能使用！

> 更改proxy地址在config/tools.yaml：  
`proxyAddr: '127.0.0.1' # 魔法地址`  
`proxyPort: '7890' # 魔法端口`
## 📦 业务
![help](./img/help.jpg)

## 🤳 版本
![help](./img/version.jpg)

##  ☕ 请我喝一杯瑞幸咖啡
如果你觉得插件能帮助到你增进好友关系，那么你可以在有条件的情况下[请我喝一杯瑞幸咖啡](https://afdian.net/a/zhiyu1998)，这是我开源这个插件的最大动力！
![help](./img/afdian.jpg)
感谢以下朋友的支持！（排名不分多少）

|       昵称        | 赞助   |
|:---------------:|------|
|       n        | 13*4 |
|       一杯凉       | 30   |
| 左轮（ps. 我导师，泪目！） | 13   |
|     mitsuha     | 13   |
|    [Kr] 5s¹     | 13   |

##  👩‍👩‍👧‍👧 开发团队
| Nickname                                                     | Contribution |
| :----------------------------------------------------------: |--------------|
|[易曦翰](https://gitee.com/yixihan) | 后端开发         |
|[zhiyu](https://gitee.com/kyrzy0416) | 后端开发         |
|[Diviner](https://gitee.com/divinerJJ) | 前端开发         |
|[小白白](https://gitee.com/little_White01) | 后端开发         |

## 🚀 后记
* 文件借鉴了很多插件，精简个人认为可以精简的内容。 
* 素材来源于网络，仅供交流学习使用 
* 严禁用于任何商业用途和非法行为 
* 如果对你有帮助辛苦给个star，这是对我最大的鼓励