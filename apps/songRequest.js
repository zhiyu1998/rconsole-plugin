import axios from "axios";
import { formatTime } from '../utils/other.js'
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import PickSongList from "../model/pick-song.js";
import NeteaseMusicInfo from '../model/neteaseMusicInfo.js'
import { NETEASE_API_CN, NETEASE_SONG_DOWNLOAD, NETEASE_TEMP_API } from "../constants/tools.js";
import { COMMON_USER_AGENT, REDIS_YUNZAI_ISOVERSEA, REDIS_YUNZAI_SONGINFO } from "../constants/constant.js";
import { downloadAudio } from "../utils/common.js";
import { redisExistKey, redisGetKey, redisSetKey } from "../utils/redis-util.js";
import { checkAndRemoveFile } from "../utils/file.js";
import { sendMusicCard } from "../utils/yunzai-util.js";
import config from "../model/config.js";

export class songRequest extends plugin {
    constructor() {
        super({
            name: "R插件点歌",
            dsc: "实现快捷点歌",
            priority: 300,
            rule: [
                {
                    reg: '^#点歌|#?听[1-9][0-9]*|#?听[1-9]*$',
                    fnc: 'pickSong'
                },
                {
                    reg: "^#播放(.*)",
                    fnc: "playSong"
                },
                {
                    reg: "^#?上传(.*)",
                    fnc: "upLoad"
                },
            ]
        });
        this.toolsConfig = config.getConfig("tools");
        // 加载网易云Cookie
        this.neteaseCookie = this.toolsConfig.neteaseCookie
        // 加载是否转化群语音
        this.isSendVocal = this.toolsConfig.isSendVocal
        // 加载是否自建服务器
        this.useLocalNeteaseAPI = this.toolsConfig.useLocalNeteaseAPI
        // 加载自建服务器API
        this.neteaseCloudAPIServer = this.toolsConfig.neteaseCloudAPIServer
        // 加载网易云解析最高音质
        this.neteaseCloudAudioQuality = this.toolsConfig.neteaseCloudAudioQuality
        // 加载识别前缀
        this.identifyPrefix = this.toolsConfig.identifyPrefix;
        // 加载是否开启网易云点歌功能
        this.useNeteaseSongRequest = this.toolsConfig.useNeteaseSongRequest
        // 加载点歌列表长度
        this.songRequestMaxList = this.toolsConfig.songRequestMaxList
        // 视频保存路径
        this.defaultPath = this.toolsConfig.defaultPath;
    }

    async pickSong(e) {
        // 判断功能是否开启
        if (!this.useNeteaseSongRequest) {
            logger.info('当前未开启网易云点歌')
            return
        }
        const autoSelectNeteaseApi = await this.pickApi()
        // 只在群里可以使用
        let group_id = e.group.group_id
        if (!group_id) return
        // 初始化
        let songInfo = await redisGetKey(REDIS_YUNZAI_SONGINFO) || []
        const saveId = songInfo.findIndex(item => item.group_id === e.group.group_id)
        let musicDate = { 'group_id': group_id, data: [] }
        // 获取搜索歌曲列表信息
        let searchUrl = autoSelectNeteaseApi + '/search?keywords={}&limit=' + this.songRequestMaxList //搜索API
        let detailUrl = autoSelectNeteaseApi + "/song/detail?ids={}" //歌曲详情API
        if (e.msg.replace(/\s+/g, "").match(/点歌(.+)/)) {
            const songKeyWord = e.msg.replace(/\s+/g, "").match(/点歌(.+)/)[1]
            searchUrl = searchUrl.replace("{}", songKeyWord)
            await axios.get(searchUrl, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT
                },
            }).then(async res => {
                if (res.data.result.songs) {
                    for (const info of res.data.result.songs) {
                        musicDate.data.push({
                            'id': info.id,
                            'songName': info.name,
                            'singerName': info.artists[0]?.name,
                            'duration': formatTime(info.duration)
                        });
                    }
                    const ids = musicDate.data.map(item => item.id).join(',');
                    detailUrl = detailUrl.replace("{}", ids)
                    await axios.get(detailUrl, {
                        headers: {
                            "User-Agent": COMMON_USER_AGENT
                        },
                    }).then(res => {
                        for (let i = 0; i < res.data.songs.length; i++) {
                            musicDate.data[i].cover = res.data.songs[i].al.picUrl
                        }
                    })
                    if (saveId == -1) {
                        songInfo.push(musicDate)
                    } else {
                        songInfo[saveId] = musicDate
                    }
                    await redisSetKey(REDIS_YUNZAI_SONGINFO, songInfo)
                    const data = await new PickSongList(e).getData(musicDate.data)
                    let img = await puppeteer.screenshot("pick-song", data);
                    e.reply(img);
                } else {
                    e.reply('暂未找到你想听的歌哦~')
                }
            })
        } else if (await redisGetKey(REDIS_YUNZAI_SONGINFO) != []) {
            if (e.msg.replace(/\s+/g, "").match(/听(\d+)/)) {
                const pickNumber = e.msg.replace(/\s+/g, "").match(/听(\d+)/)[1] - 1
                let group_id = e.group.group_id
                if (!group_id) return
                let songInfo = await redisGetKey(REDIS_YUNZAI_SONGINFO)
                const saveId = songInfo.findIndex(item => item.group_id === e.group.group_id)
                const AUTO_NETEASE_SONG_DOWNLOAD = autoSelectNeteaseApi + "/song/url/v1?id={}&level=" + this.neteaseCloudAudioQuality;
                const pickSongUrl = AUTO_NETEASE_SONG_DOWNLOAD.replace("{}", songInfo[saveId].data[pickNumber].id)
                const songWikiUrl = autoSelectNeteaseApi + '/song/wiki/summary?id=' + songInfo[saveId].data[pickNumber].id
                const statusUrl = autoSelectNeteaseApi + '/login/status' //用户状态API
                const isCkExpired = await this.checkCooike(statusUrl)
                // // 请求netease数据
                this.neteasePlay(e, pickSongUrl, songWikiUrl, songInfo[saveId].data, pickNumber, isCkExpired)
            }
        }

    }

    // 播放策略
    async playSong(e) {
        if (!this.useNeteaseSongRequest) {
            logger.info('当前未开启网易云点歌')
            return
        }
        // 只在群里可以使用
        let group_id = e.group.group_id
        if (!group_id) return
        const autoSelectNeteaseApi = await this.pickApi()
        let songInfo = []
        // 获取搜索歌曲列表信息
        const AUTO_NETEASE_SONG_DOWNLOAD = autoSelectNeteaseApi + "/song/url/v1?id={}&level=" + this.neteaseCloudAudioQuality;
        let searchUrl = autoSelectNeteaseApi + '/search?keywords={}&limit=1' //搜索API
        let detailUrl = autoSelectNeteaseApi + "/song/detail?ids={}" //歌曲详情API
        if (e.msg.replace(/\s+/g, "").match(/播放(.+)/)) {
            const songKeyWord = e.msg.replace(/\s+/g, "").match(/播放(.+)/)[1]
            searchUrl = searchUrl.replace("{}", songKeyWord)
            await axios.get(searchUrl, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT
                },
            }).then(async res => {
                if (res.data.result.songs) {
                    for (const info of res.data.result.songs) {
                        songInfo.push({
                            'id': info.id,
                            'songName': info.name,
                            'singerName': info.artists[0]?.name,
                            'duration': formatTime(info.duration)
                        });
                    }
                    const ids = songInfo.map(item => item.id).join(',');
                    detailUrl = detailUrl.replace("{}", ids)
                    await axios.get(detailUrl, {
                        headers: {
                            "User-Agent": COMMON_USER_AGENT
                        },
                    }).then(res => {
                        for (let i = 0; i < res.data.songs.length; i++) {
                            songInfo[i].cover = res.data.songs[i].al.picUrl
                        }
                    })
                    const pickSongUrl = AUTO_NETEASE_SONG_DOWNLOAD.replace("{}", songInfo[0].id)
                    const statusUrl = autoSelectNeteaseApi + '/login/status' //用户状态API
                    const songWikiUrl = autoSelectNeteaseApi + '/song/wiki/summary?id=' + songInfo[0].id
                    const isCkExpired = await this.checkCooike(statusUrl)
                    this.neteasePlay(e, pickSongUrl, songWikiUrl, songInfo, 0, isCkExpired)
                } else {
                    e.reply('暂未找到你想听的歌哦~')
                }
            })
        }
    }

    async upLoad(e) {
        let msg = await e.getReply();
        const musicUrlReg = /(http:|https:)\/\/music.163.com\/song\/media\/outer\/url\?id=(\d+)/;
        const musicUrlReg2 = /(http:|https:)\/\/y.music.163.com\/m\/song\?(.*)&id=(\d+)/;
        const musicUrlReg3 = /(http:|https:)\/\/music.163.com\/m\/song\/(\d+)/;
        const id =
            musicUrlReg2.exec(msg.message[0].data)?.[3] ||
            musicUrlReg.exec(msg.message[0].data)?.[2] ||
            musicUrlReg3.exec(msg.message[0].data)?.[2] ||
            /(?<!user)id=(\d+)/.exec(msg.message[0].data)[1] || "";
        const title = msg.message[0].data.match(/"title":"([^"]+)"/)[1]
        const desc = msg.message[0].data.match(/"desc":"([^"]+)"/)[1]
        if (id === "") return
        let path = this.getCurDownloadPath(e) + '/' + title + '-' + desc + '.' + 'flac'
        try {
            // 上传群文件
            await this.uploadGroupFile(e, path);
            // 删除文件
            await checkAndRemoveFile(path);
        } catch (error) {
            logger.error(error)
        }
    }


    // 判断是否海外服务器
    async isOverseasServer() {
        // 如果第一次使用没有值就设置
        if (!(await redisExistKey(REDIS_YUNZAI_ISOVERSEA))) {
            await redisSetKey(REDIS_YUNZAI_ISOVERSEA, {
                os: false,
            })
            return true;
        }
        // 如果有就取出来
        return (await redisGetKey(REDIS_YUNZAI_ISOVERSEA)).os;
    }

    // API选择
    async pickApi() {
        const isOversea = await this.isOverseasServer();
        let autoSelectNeteaseApi
        if (this.useLocalNeteaseAPI) {
            // 使用自建 API
            return autoSelectNeteaseApi = this.neteaseCloudAPIServer
        } else {
            // 自动选择 API
            return autoSelectNeteaseApi = isOversea ? NETEASE_SONG_DOWNLOAD : NETEASE_API_CN;
        }
    }

    // 检测cooike活性

    async checkCooike(statusUrl) {
        let status
        await axios.get(statusUrl, {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
                "Cookie": this.neteaseCookie
            },
        }).then(res => {
            const userInfo = res.data.data.profile
            if (userInfo) {
                logger.info('ck活着，使用ck进行高音质下载')
                status = true
            } else {
                logger.info('ck失效，将启用临时接口下载')
                status = false
            }
        })
        return status
    }

    // 网易云音乐下载策略
    neteasePlay(e, pickSongUrl, songWikiUrl, songInfo, pickNumber = 0, isCkExpired) {
        axios.get(pickSongUrl, {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
                "Cookie": this.neteaseCookie
            },
        }).then(async resp => {
            // 国内解决方案，替换API后这里也需要修改

            // 英转中字典匹配
            const translationDict = {
                'standard': '标准',
                'higher': '较高',
                'exhigh': '极高',
                'lossless': '无损',
                'hires': 'Hi-Res',
                'jyeffect': '高清环绕声',
                'sky': '沉浸环绕声',
                'dolby': '杜比全景声',
                'jymaster': '超清母带'
            };

            // 英转中
            function translateToChinese(word) {
                return translationDict[word] || word;  // 如果找不到对应翻译，返回原词
            }

            // 字节转MB
            function bytesToMB(sizeInBytes) {
                const sizeInMB = sizeInBytes / (1024 * 1024);  // 1 MB = 1024 * 1024 bytes
                return sizeInMB.toFixed(2);  // 保留两位小数
            }
            let url = await resp.data.data?.[0]?.url || null;
            const AudioLevel = translateToChinese(resp.data.data?.[0]?.level)
            const AudioSize = bytesToMB(resp.data.data?.[0]?.size)

            // 获取歌曲标题
            let title = songInfo[pickNumber].songName + '-' + songInfo[pickNumber].singerName
            let typelist = []
            // 歌曲百科API
            await axios.get(songWikiUrl, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT,
                    // "Cookie": this.neteaseCookie
                },
            }).then(res => {
                const wikiData = res.data.data.blocks[1].creatives

                typelist.push(wikiData[0].resources[0].uiElement.mainTitle.title)
                // 防止数据过深出错
                const recTags = wikiData[1]
                if (recTags.resources[0]) {
                    for (let i = 0; i < Math.min(3, recTags.resources.length); i++) {
                        if (recTags.resources[i] && recTags.resources[i].uiElement && recTags.resources[i].uiElement.mainTitle.title) {
                            typelist.push(recTags.resources[i].uiElement.mainTitle.title)
                        }
                    }
                } else {
                    if (recTags.uiElement.textLinks[0].text) typelist.push(recTags.uiElement.textLinks[0].text)
                }
                if (wikiData[2].uiElement.mainTitle.title == 'BPM') {
                    typelist.push('BPM ' + wikiData[2].uiElement.textLinks[0].text)
                } else {
                    typelist.push(wikiData[2].uiElement.textLinks[0].text)
                }
                typelist.push(AudioLevel)
            })
            let musicInfo = {
                'cover': songInfo[pickNumber].cover,
                'songName': songInfo[pickNumber].songName,
                'singerName': songInfo[pickNumber].singerName,
                'size': AudioSize + ' MB',
                'musicType': typelist
            }
            // 一般这个情况是VIP歌曲 (如果没有url或者是国内,公用接口暂时不可用，必须自建并且ck可用状态才能进行高质量解析)
            if (!isCkExpired || url == null) {
                url = await this.musicTempApi(e, musicInfo, title);
            } else {
                // 拥有ck，并且有效，直接进行解析
                let audioInfo = AudioLevel;
                if (AudioLevel == '杜比全景声') {
                    audioInfo += '\n(杜比下载文件为MP4，编码格式为AC-4，需要设备支持才可播放)';
                }
                const data = await new NeteaseMusicInfo(e).getData(musicInfo)
                let img = await puppeteer.screenshot("neteaseMusicInfo", data);
                e.reply(img);
            }
            // 动态判断后缀名
            let musicExt = resp.data.data?.[0]?.type
            // 下载音乐
            downloadAudio(url, this.getCurDownloadPath(e), title, 'follow', musicExt).then(async path => {
                try {
                    // 发送卡片
                    await sendMusicCard(e, '163', songInfo[pickNumber].id)
                } catch (error) {
                    if (error.error.message) {
                        logger.error("发送卡片错误错误:", error.error.message, '发送群语音');
                    } else {
                        logger.error("发送卡片错误错误，请查看控制台报错，将发送群语音")
                        logger.error(error)
                    }
                    // 发送群文件
                    await this.uploadGroupFile(e, path);
                    // 发送语音
                    if (musicExt != 'mp4' && this.isSendVocal) {
                        await e.reply(segment.record(path));
                    }
                    // 删除文件
                    await checkAndRemoveFile(path);
                }
            }).catch(err => {
                logger.error(`下载音乐失败，错误信息为: ${err}`);
            });
        });
    }

    async musicTempApi(e, musicInfo, title) {
        let musicReqApi = NETEASE_TEMP_API;
        // 临时接口，title经过变换后搜索到的音乐质量提升
        const vipMusicData = await axios.get(musicReqApi.replace("{}", title.replace("-", " ")), {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
            },
        });
        const url = vipMusicData.data?.music_url
        const id = vipMusicData.data?.id ?? vipMusicData.data?.data?.quality ?? vipMusicData.data?.pay;
        musicInfo.size = id
        musicInfo.musicType = musicInfo.musicType.slice(0, -1)
        const data = await new NeteaseMusicInfo(e).getData(musicInfo)
        let img = await puppeteer.screenshot("neteaseMusicInfo", data);
        e.reply(img);
        return url;
    }

    /**
  * 获取当前发送人/群的下载路径
  * @param e Yunzai 机器人事件
  * @returns {string}
  */
    getCurDownloadPath(e) {
        return `${this.defaultPath}${e.group_id || e.user_id}`
    }

    /**
     * 上传到群文件
     * @param e             交互事件
     * @param path          上传的文件所在路径
     * @return {Promise<void>}
     */
    async uploadGroupFile(e, path) {
        // 判断是否是ICQQ
        if (e.bot?.sendUni) {
            await e.group.fs.upload(path);
        } else {
            await e.group.sendFile(path);
        }
    }
}