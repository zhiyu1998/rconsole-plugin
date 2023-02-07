<p align="center">
  <a href="https://gitee.com/kyrzy0416/rconsole-plugin">
    <img width="200" src="./img/logo.png">
  </a>
</p>

<div align="center">
    <h1>R-plugin</h1>
    个人团队用的<a href="https://gitee.com/Le-niao/Yunzai-Bot" target="_blank">Yunzai-Bot</a>插件，插件的各种业务来源于周围人
<img src="https://cdn.jsdelivr.net/gh/xianxincoder/xianxincoder/assets/github-contribution-grid-snake.svg">
</div>

## 🗃️文件架构
apps -- 业务核心

config -- 配置文件

model -- 核心文件[建议不动]

resource -- 资源文件

test -- 爬虫文件[python]

index -- 主入口

## 📔使用说明
1. 【可选】下载mongodb（可能会耗费一些时间：影响功能【#沃日吗】）
> linux系统下自己装一个mongodb，上一个密码(不上有风险)
2. 【可选】`test -- main.py`爬取链接（要有python环境、配合mongodb使用）
> python3 main.py
3. 【必要】在`Yunzai-Bot`安装mongodb、axios(0.27.2)、代理工具（tunnel）、TwitterAPI依赖
> pnpm add mongodb axios tunnel twitter-api-v2 -w

4. 【必要】下载插件
> git clone https://gitee.com/kyrzy0416/rconsole-plugin.git ./plugins/rconsole-plugin/

> 注：可以不用mongodb这些操作，只是用不了一些命令而已
5. 【可选】要使用视频解析功能要下载插件【推荐ubuntu系统】
> sudo apt-get install ffmpeg

【必要】备注：如果启动不起来删除mongodb的代码即可：
```javascript
// in apps/mystery.js

// Mongodb初始化
function initMongo () {
    const MongoClient = mongodb.MongoClient
    const url = 'mongodb://localhost:27017/'
    return new Promise((resolve, reject) => {
        MongoClient.connect(url, (err, db) => {
            const dbo = db.db('test')
            if (err) {
                throw err // 和调用 reject(err) 效果类似
            }
            let collection = dbo.collection('temp')
            resolve(collection)
        })
    })
}
```

【必要】相关配置(apps/tools.js)：
> twiiter-api:https://developer.twitter.com/en  
> 百度翻译api:https://fanyi-api.baidu.com/doc/21  
## 📦业务
![help](./img/help.jpg)

## 🤳版本
![help](./img/version.jpg)

## 开发团队
| Nickname                                                     | Contribution |
| :----------------------------------------------------------: |--------------|
|[易曦翰](https://gitee.com/yixihan) | 后端开发         |
|[zhiyu](https://gitee.com/kyrzy0416) | 后端开发         |
|[Diviner](https://gitee.com/divinerJJ) | 前端开发         |
|[小白白](https://gitee.com/little_White01) | 后端开发         |

## 🚀后记
* 文件借鉴了很多插件，精简个人认为可以精简的内容。 
* 素材来源于网络，仅供交流学习使用 
* 严禁用于任何商业用途和非法行为 
* 如果对你有帮助辛苦给个star，这是对我最大的鼓励