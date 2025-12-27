import axios from "axios";
import fs from "node:fs";
import { formatTime, toGBorTB } from '../utils/other.js'
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import PickSongList from "../model/pick-song.js";
import NeteaseMusicInfo from '../model/neteaseMusicInfo.js'
import { NETEASE_API_CN, NETEASE_SONG_DOWNLOAD, NETEASE_TEMP_API } from "../constants/tools.js";
import { COMMON_USER_AGENT, REDIS_YUNZAI_ISOVERSEA, REDIS_YUNZAI_SONGINFO, REDIS_YUNZAI_CLOUDSONGLIST } from "../constants/constant.js";
import { downloadAudio, retryAxiosReq } from "../utils/common.js";
import { redisExistKey, redisGetKey, redisSetKey } from "../utils/redis-util.js";
import { checkAndRemoveFile, checkFileExists, splitPaths } from "../utils/file.js";
import { sendMusicCard, sendCustomMusicCard, getGroupFileUrl, getReplyMsg } from "../utils/yunzai-util.js";
import config from "../model/config.js";
import FormData from 'form-data';
import NodeID3 from 'node-id3';

let FileSuffix = 'flac'

export class songRequest extends plugin {
    constructor() {
        super({
            name: "R插件点歌",
            dsc: "实现快捷点歌",
            priority: 300,
            rule: [
                {
                    reg: '^#点歌\\s*(.+?)(?:\\s+([12]))?$|#听[1-9][0-9]*|#听[1-9]*$',
                    fnc: 'pickSong'
                },
                {
                    reg: "^#播放\\s*(.+?)(?:\\s+([12]))?$",
                    fnc: "playSong"
                },
                {
                    reg: "^#?上传$",
                    fnc: "upLoad"
                },
                {
                    reg: '^#?我的云盘$|#rnc|#RNC',
                    fnc: 'myCloud',
                    permission: 'master'
                },
                {
                    reg: '^#?云盘更新$|#?更新云盘$',
                    fnc: 'songCloudUpdate',
                    permission: 'master'
                },
                {
                    reg: '^#?上传云盘|#?上传网盘$|#rnu|#RNU',
                    fnc: 'uploadCloud',
                    permission: 'master'
                },
                {
                    reg: '^#?清除云盘缓存$',
                    fnc: 'cleanCloudData',
                    permission: 'master'
                },
                {
                    reg: '^#?文件上传云盘$|#?群文件上传云盘$|#rngu|#RNGU',
                    fnc: 'getLatestDocument',
                    permission: 'master'
                }
            ]
        });
        this.toolsConfig = config.getConfig("tools");
        // 加载网易云Cookie
        this.neteaseCookie = this.toolsConfig.neteaseCookie
        this.neteaseCloudCookie = this.toolsConfig.neteaseCloudCookie
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
        // uid
        this.uid = this.toolsConfig.neteaseUserId
        this.cloudUid = this.toolsConfig.neteaseCloudUserId
    }

    async pickSong(e) {
        // 判断功能是否开启
        if (!this.useNeteaseSongRequest) {
            logger.info('当前未开启网易云点歌')
            return false
        }
        // 获取自定义API
        const autoSelectNeteaseApi = await this.pickApi()
        // 只在群里可以使用
        let group_id = e.group_id
        if (!group_id) return
        // 初始化
        let songInfo = await redisGetKey(REDIS_YUNZAI_SONGINFO) || []
        const saveId = songInfo.findIndex(item => item.group_id === e.group_id)
        let musicDate = { 'group_id': group_id, data: [] }
        // 获取搜索歌曲列表信息
        let detailUrl = autoSelectNeteaseApi + "/song/detail?ids={}&time=" + Date.now() //歌曲详情API
        const match = e.msg.match(/^#点歌\s*(.+?)(?:\s+([12]))?$/);
        if (match) {
            const songKeyWord = match[1];
            const songType = match[2] || '1';
            // 获取云盘歌单列表
            const cloudSongList = await this.getCloudSong()
            // 搜索云盘歌单并进行搜索
            const matchedSongs = cloudSongList.filter(({ songName, singerName }) =>
                songName.includes(songKeyWord) || singerName.includes(songKeyWord) || songName == songKeyWord || singerName == songKeyWord
            );
            // 计算列表数
            let songListCount = matchedSongs.length >= this.songRequestMaxList ? this.songRequestMaxList : matchedSongs.length
            let searchCount = this.songRequestMaxList - songListCount
            for (let i = 0; i < songListCount; i++) {
                musicDate.data.push({
                    'id': matchedSongs[i].id,
                    'songName': matchedSongs[i].songName,
                    'singerName': matchedSongs[i].singerName,
                    'duration': matchedSongs[i].duration
                });
            }
            let searchUrl;
            if (songType === '2') {
                searchUrl = `${autoSelectNeteaseApi}/search?keywords={}&type=2000&limit=${searchCount}`; // 播客声音接口(暂时只加入播客声音)
            } else {
                searchUrl = `${autoSelectNeteaseApi}/search?keywords={}&limit=${searchCount}`; // 歌曲接口
            }
            searchUrl = searchUrl.replace("{}", encodeURIComponent(songKeyWord))
            await axios.get(searchUrl, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT
                },
            }).then(async res => {
                const results = songType === '2' ? res.data.data?.resources : res.data.result?.songs;
                if (results || musicDate.data[0]) {
                    try {
                        if (results) {
                            for (const info of results) {
                                if (songType === '2') {
                                    musicDate.data.push({
                                        'programId': info.baseInfo.id,
                                        'id': info.baseInfo.mainSong.id,
                                        'songName': info.baseInfo.mainSong.name,
                                        'singerName': info.baseInfo.dj.nickname,
                                        'duration': formatTime(info.baseInfo.duration),
                                        'cover': info.baseInfo.coverUrl,
                                        'type': 'podcast'
                                    });
                                } else {
                                    musicDate.data.push({
                                        'id': info.id,
                                        'songName': info.name,
                                        'singerName': info.artists[0]?.name,
                                        'duration': formatTime(info.duration),
                                        'type': 'song'
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        logger.info('并未获取云服务歌曲')
                    }
                    const songIds = musicDate.data.filter(item => item.type !== 'podcast').map(item => item.id).join(',');
                    if (songIds) {
                        detailUrl = detailUrl.replace("{}", songIds)
                        await axios.get(detailUrl, {
                            headers: {
                                "User-Agent": COMMON_USER_AGENT
                            },
                        }).then(res => {
                            let imgList = {};
                            for (const songDetail of res.data.songs) {
                                const songId = songDetail.id;
                                if (songDetail.al.picUrl.includes('109951169484091680.jpg')) {
                                    imgList[songId] = 'def';
                                } else {
                                    imgList[songId] = songDetail.al.picUrl;
                                }
                                const musicDataIndex = musicDate.data.findIndex(item => item.id === songId);
                                if (musicDataIndex !== -1) {
                                    musicDate.data[musicDataIndex].songName = songDetail.name;
                                    musicDate.data[musicDataIndex].singerName = songDetail.ar[0]?.name;
                                }
                            }
                            for (let i = 0; i < musicDate.data.length; i++) {
                                const songId = musicDate.data[i].id;
                                if (imgList[songId]) {
                                    musicDate.data[i].cover = imgList[songId];
                                }
                            }
                        })
                    }
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
            if (e.msg.replace(/\s+/g, "").match(/^#听(\d+)/)) {
                const pickNumber = e.msg.replace(/\s+/g, "").match(/^#听(\d+)/)[1] - 1
                let group_id = e.group_id
                if (!group_id) return
                let songInfo = await redisGetKey(REDIS_YUNZAI_SONGINFO)
                const saveId = songInfo.findIndex(item => item.group_id === e.group_id)
                const selectedSong = songInfo[saveId].data[pickNumber];
                const songId = selectedSong.id;
                const songType = selectedSong.type || 'song';
                const AUTO_NETEASE_SONG_DOWNLOAD = autoSelectNeteaseApi + "/song/url/v1?id={}&level=" + this.neteaseCloudAudioQuality;
                const pickSongUrl = AUTO_NETEASE_SONG_DOWNLOAD.replace("{}", songId);
                const songWikiUrl = autoSelectNeteaseApi + '/song/wiki/summary?id=' + songId;
                const statusUrl = autoSelectNeteaseApi + '/login/status'; //用户状态API
                // 判断选中的歌曲是否来自云盘
                const isCloudSong = selectedSong.duration === '云盘';
                // 检查 Cookie 有效性，根据歌曲来源选择 Cookie 类型
                const isCkExpired = await this.checkCooike(statusUrl, isCloudSong ? 'cloud' : 'song');
                // 请求netease数据并播放
                this.neteasePlay(e, pickSongUrl, songWikiUrl, songInfo[saveId].data, pickNumber, isCkExpired, isCloudSong, songType);
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
        let group_id = e.group_id
        if (!group_id) return
        const autoSelectNeteaseApi = await this.pickApi()
        let songInfo = []
        // 获取搜索歌曲列表信息
        const AUTO_NETEASE_SONG_DOWNLOAD = autoSelectNeteaseApi + "/song/url/v1?id={}&level=" + this.neteaseCloudAudioQuality;
        const match = e.msg.match(/^#播放\s*(.+?)(?:\s+([12]))?$/);
        if (match) {
            const songKeyWord = match[1];
            const songType = match[2] || '1';
            let searchUrl;
            if (songType === '2') {
                searchUrl = `${autoSelectNeteaseApi}/search?keywords={}&type=2000&limit=1`; // 播客声音接口(暂时只加入播客声音)
            } else {
                searchUrl = `${autoSelectNeteaseApi}/cloudsearch?keywords={}&limit=1`; // 歌曲接口
            }
            searchUrl = searchUrl.replace("{}", encodeURIComponent(songKeyWord))
            await axios.get(searchUrl, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT
                },
            }).then(async res => {
                const results = songType === '2' ? res.data.data?.resources : res.data.result?.songs;
                if (results && results.length > 0) {
                    const info = results[0];
                    let programId, id, songName, singerName, duration, cover, type;
                    if (songType === '2') {
                        programId = info.baseInfo.id
                        id = info.baseInfo.mainSong.id;
                        songName = info.baseInfo.mainSong.name;
                        singerName = info.baseInfo.dj.nickname;
                        duration = formatTime(info.baseInfo.duration);
                        cover = info.baseInfo.coverUrl;
                        type = 'podcast';
                    } else {
                        id = info.id;
                        songName = info.name;
                        singerName = info.ar[0]?.name;
                        duration = formatTime(info.dt);
                        cover = info.al.picUrl;
                        type = 'song';
                    }
                    songInfo.push({ programId, id, songName, singerName, duration, cover, type });
                    const pickSongUrl = AUTO_NETEASE_SONG_DOWNLOAD.replace("{}", id)
                    const statusUrl = autoSelectNeteaseApi + '/login/status' //用户状态API
                    const songWikiUrl = autoSelectNeteaseApi + '/song/wiki/summary?id=' + id;
                    const isCkExpired = await this.checkCooike(statusUrl, 'song')
                    this.neteasePlay(e, pickSongUrl, songWikiUrl, songInfo, 0, isCkExpired, false, songType)
                } else {
                    e.reply('暂未找到你想听的歌哦~')
                }
            })
        }
    }


    // 获取云盘信息
    async myCloud(e) {
        const autoSelectNeteaseApi = await this.pickApi()
        const cloudUrl = autoSelectNeteaseApi + '/user/cloud'
        // 云盘数据API
        await axios.get(cloudUrl, {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
                "Cookie": this.getCookie(true)
            },
        }).then(res => {
            const cloudData = {
                'songCount': res.data.count,
                'useSize': toGBorTB(res.data.size),
                'cloudSize': toGBorTB(res.data.maxSize)
            }
            e.reply(`云盘数据\n歌曲数量:${cloudData.songCount}\n云盘容量:${cloudData.cloudSize}\n已使用容量:${cloudData.useSize}\n数据可能有延迟`)
        })
    }

    // 更新云盘
    async songCloudUpdate(e) {
        try {
            await this.cleanCloudData()
            await this.getCloudSong(e, true)
            try {
                await e?.reply('更新成功')
            } catch (error) {
                logger.error('trss又拉屎了？')
            }
            await this.myCloud(e)
        } catch (error) {
            logger.error('更新云盘失败', error)
        }
    }

    // 上传音频文件
    async upLoad(e) {
        let msg = await getReplyMsg(e);
        // 检查消息数据有效性
        const msgData = msg?.message?.[0]?.data?.data;
        if (!msgData) {
            e.reply('请回复一条网易云音乐卡片消息再使用此命令');
            return;
        }
        const autoSelectNeteaseApi = await this.pickApi()
        const musicUrlReg = /(http:|https:)\/\/music.163.com\/song\/media\/outer\/url\?id=(\d+)/;
        const musicUrlReg2 = /(http:|https:)\/\/y.music.163.com\/m\/song\?(.*)&id=(\d+)/;
        const musicUrlReg3 = /(http:|https:)\/\/music.163.com\/m\/song\/(\d+)/;
        let id =
            musicUrlReg2.exec(msgData)?.[3] ||
            musicUrlReg.exec(msgData)?.[2] ||
            musicUrlReg3.exec(msgData)?.[2] ||
            /(?<!user)id=(\d+)/.exec(msgData)?.[1] || "";
        let title = msgData.match(/"title":"([^"]+)"/)?.[1]
        let desc = msgData.match(/"desc":"([^"]+)"/)?.[1]
        const jumpUrl = msgData.match(/"jumpUrl":"([^"]+)"/)?.[1];
        const isPodcast = /dj\?id=/.test(jumpUrl);
        if (id === "") return
        if (isPodcast) {
            const programDetailUrl = `${autoSelectNeteaseApi}/dj/program/detail?id=${id}`;
            try {
                const programRes = await axios.get(programDetailUrl);
                const mainSong = programRes.data.program.mainSong;
                id = mainSong.id;
                title = mainSong.name;
                desc = mainSong.artists[0].name || '喵喵~';
            } catch (error) {
                logger.error('出现错误，无法上传', error);
                e.reply('出现错误，无法上传');
                return;
            }
        }
        let path = this.getCurDownloadPath(e) + '/' + desc + '-' + title + '.' + FileSuffix
        const fileExists = await this.waitForFile(path, e);
        if (!fileExists) {
            return;
        }
        try {
            // 上传群文件
            await this.uploadGroupFile(e, path);
            // 删除文件
            await checkAndRemoveFile(path);
        } catch (error) {
            logger.error(error);
        }
    }

    // 上传云盘
    async uploadCloud(e) {
        let msg = await getReplyMsg(e)
        // 检查消息数据有效性
        const msgData = msg?.message?.[0]?.data?.data;
        if (!msgData) {
            e.reply('请回复一条网易云音乐卡片消息再使用此命令');
            return;
        }
        const autoSelectNeteaseApi = await this.pickApi()
        const musicUrlReg = /(http:|https:)\/\/music.163.com\/song\/media\/outer\/url\?id=(\d+)/;
        const musicUrlReg2 = /(http:|https:)\/\/y.music.163.com\/m\/song\?(.*)&id=(\d+)/;
        const musicUrlReg3 = /(http:|https:)\/\/music.163.com\/m\/song\/(\d+)/;
        let id =
            musicUrlReg2.exec(msgData)?.[3] ||
            musicUrlReg.exec(msgData)?.[2] ||
            musicUrlReg3.exec(msgData)?.[2] ||
            /(?<!user)id=(\d+)/.exec(msgData)?.[1] || "";
        let title = msgData.match(/"title":"([^"]+)"/)?.[1]
        let desc = msgData.match(/"desc":"([^"]+)"/)?.[1]
        const jumpUrl = msgData.match(/"jumpUrl":"([^"]+)"/)?.[1];
        const isPodcast = /dj\?id=/.test(jumpUrl);
        if (id === "") return
        if (isPodcast) {
            const programDetailUrl = `${autoSelectNeteaseApi}/dj/program/detail?id=${id}`;
            try {
                const programRes = await axios.get(programDetailUrl);
                const mainSong = programRes.data.program.mainSong;
                id = mainSong.id;
                title = mainSong.name;
                desc = mainSong.artists[0].name || '喵喵~';
            } catch (error) {
                logger.error('出现错误，无法上传', error);
                e.reply('出现错误，无法上传');
                return;
            }
        }
        let path = this.getCurDownloadPath(e) + '/' + desc + '-' + title + '.' + FileSuffix
        const fileExists = await this.waitForFile(path, e);
        if (!fileExists) {
            return;
        }
        const tryUpload = async () => {
            let formData = new FormData();
            formData.append('songFile', fs.createReadStream(path));
            const headers = {
                ...formData.getHeaders(),
                'Cookie': this.getCookie(true),
            };
            const updateUrl = `${autoSelectNeteaseApi}/cloud?time=${Date.now()}`;
            try {
                const res = await axios({
                    method: 'post',
                    url: updateUrl,
                    headers: headers,
                    data: formData,
                });
                if (res.data.code == 200) {
                    let matchUrl = `${autoSelectNeteaseApi}/cloud/match?uid=${this.cloudUid || this.uid}&sid=${res.data.privateCloud.songId}&asid=${id}`;
                    try {
                        const matchRes = await axios.get(matchUrl, {
                            headers: {
                                "User-Agent": COMMON_USER_AGENT,
                                "Cookie": this.getCookie(true)
                            },
                        });
                        logger.info('歌曲信息匹配成功');
                    } catch (error) {
                        logger.error('歌曲信息匹配错误', error);
                    }
                    this.songCloudUpdate(e);
                    return res;

                } else {
                    throw new Error('上传失败，响应不正确');
                }
            } catch (error) {
                throw error;
            }
        };
        await retryAxiosReq(() => tryUpload())
        await checkAndRemoveFile(path)
    }

    // 获取云盘歌单
    async getCloudSong(e, cloudUpdate = false) {
        let songList = await redisGetKey(REDIS_YUNZAI_CLOUDSONGLIST) || []
        if (!songList[0] || cloudUpdate) {
            const autoSelectNeteaseApi = await this.pickApi();
            const limit = 100;
            let offset = 0;
            let cloudUrl = autoSelectNeteaseApi + `/user/cloud?limit=${limit}&offset=${offset}&timestamp=${Date.now()}`;
            while (true) {
                try {
                    const res = await axios.get(cloudUrl, {
                        headers: {
                            "User-Agent": COMMON_USER_AGENT,
                            "Cookie": this.getCookie(true)
                        }
                    });
                    const songs = res.data.data.map(({ songId, songName, artist }) => ({
                        'songName': songName,
                        'id': songId,
                        'singerName': artist || '喵喵~',
                        'duration': '云盘'
                    }));
                    songList.push(...songs);
                    if (!res.data.hasMore) {
                        break;
                    }
                    offset += limit;
                    cloudUrl = autoSelectNeteaseApi + `/user/cloud?limit=${limit}&offset=${offset}`;
                } catch (error) {
                    console.error("获取歌单失败", error);
                    break;
                }
            }
            await redisSetKey(REDIS_YUNZAI_CLOUDSONGLIST, songList)
            return songList;
        } else {
            return songList;
        }
    }

    // 群文件上传云盘
    async getLatestDocument(e) {
        const autoSelectNeteaseApi = await this.pickApi();
        const result = await getGroupFileUrl(e);
        // 检查返回值有效性
        if (!result || !result.cleanPath) {
            e.reply('未找到群文件，请先在群内发送音频文件再使用此命令');
            return;
        }
        let { cleanPath, file_id, fileName: extractedFileName, fileFormat: extractedFormat } = result;
        // NapCat 和 LLBot 解决方案
        if (cleanPath.startsWith("https")) {
            const songName = extractedFileName || file_id.match(/\.(.*?)\.(\w+)$/)?.[1];
            const format = extractedFormat || file_id.match(/\.(.*?)\.(\w+)$/)?.[2];
            // 检测文件是否存在 已提升性能
            if (await checkFileExists(cleanPath)) {
                // 如果文件已存在
                logger.mark(`[R插件][云盘] 上传路径审计：已存在下载文件`);
                cleanPath = `${this.getCurDownloadPath(e)}/${songName}.${format}`;
            } else {
                // 如果文件不存在
                logger.mark(`[R插件][云盘] 上传路径审计：不存在下载文件，将进行下载...`);
                cleanPath = await downloadAudio(cleanPath, this.getCurDownloadPath(e), songName, "manual", format);
            }
        }
        logger.info(`[R插件][云盘] 上传路径审计： ${cleanPath}`);
        // 使用 splitPaths 提取信息
        const [{ dir: dirPath, fileName, extension, baseFileName }] = splitPaths(cleanPath);
        // 文件名拆解为两部分
        const parts = baseFileName.trim().match(/^([\s\S]+)\s*-\s*([\s\S]+)$/);
        // 命令不规范检测
        if (parts == null || parts.length < 2) {
            logger.warn("[R插件][云盘] 上传路径审计：命名不规范");
            e.reply("请规范上传文件的命名：歌手-歌名，例如：梁静茹-勇气");
            return true;
        }
        // 生成新文件名
        const newFileName = `${dirPath}/${parts[2].trim()}${extension}`;
        // 进行元数据编辑
        if (parts) {
            const tags = {
                title: parts[2].replace(/^\s+|\s+$/g, ''),
                artist: parts[1].replace(/^\s+|\s+$/g, '')
            };
            // 写入元数据
            let success = NodeID3.write(tags, cleanPath)
            if (fs.existsSync(newFileName)) {
                logger.info(`音频已存在`);
                fs.unlinkSync(newFileName);
            }
            // 文件重命名
            fs.renameSync(cleanPath, newFileName)
            if (success) logger.info('写入元数据成功')
        } else {
            logger.info('未按照标准命名')
        }
        // 上传请求
        const tryUpload = async () => {
            let formData = new FormData()
            await formData.append('songFile', fs.createReadStream(newFileName))
            const headers = {
                ...formData.getHeaders(),
                'Cookie': this.getCookie(true),
            };
            const updateUrl = autoSelectNeteaseApi + `/cloud?time=${Date.now()}`
            try {
                const res = await axios({
                    method: 'post',
                    url: updateUrl,
                    headers: headers,
                    data: formData,
                });
                this.songCloudUpdate(e);
                return res;

            } catch (error) {
                throw error;
            }
        };
        // 重试
        await retryAxiosReq(() => tryUpload())
        checkAndRemoveFile(newFileName)
    }


    // 清除缓存
    async cleanCloudData(e) {
        await redisSetKey(REDIS_YUNZAI_CLOUDSONGLIST, [])
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
    async checkCooike(statusUrl, cookieType = 'song') {
        const cookie = cookieType === 'cloud' ? this.neteaseCloudCookie : this.neteaseCookie
        let status
        await axios.get(statusUrl, {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
                "Cookie": cookie
            },
        }).then(async res => {
            const userInfo = res.data.data.profile
            if (cookieType === 'song') {
                await config.updateField("tools", "neteaseUserId", res.data.data.profile.userId);
            } else if (cookieType === 'cloud') {
                await config.updateField("tools", "neteaseCloudUserId", res.data.data.profile.userId);
            }
            if (userInfo) {
                logger.info(`[R插件][ncm-Cookie检测][${cookieType}]ck活着，使用ck进行高音质下载`)
                status = true
            } else {
                logger.info(`[R插件][ncm-Cookie检测][${cookieType}]ck失效，将启用临时接口下载`)
                status = false
            }
        })
        return status
    }

    // 网易云音乐下载策略
    neteasePlay(e, pickSongUrl, songWikiUrl, songInfo, pickNumber = 0, isCkExpired, isCloudSong = false) {
        axios.get(pickSongUrl, {
            headers: {
                "User-Agent": COMMON_USER_AGENT,
                "Cookie": this.getCookie(isCloudSong)
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
            let title = songInfo[pickNumber].singerName + '-' + songInfo[pickNumber].songName
            let typelist = []
            // 歌曲百科API
            await axios.get(songWikiUrl, {
                headers: {
                    "User-Agent": COMMON_USER_AGENT,
                    // "Cookie": this.neteaseCookie
                },
            }).then(res => {
                const wikiData = res.data.data.blocks[1]?.creatives || []
                if (wikiData[0]) {
                    typelist.push(wikiData[0]?.resources?.[0]?.uiElement?.mainTitle?.title)
                    // 防止数据过深出错
                    const recTags = wikiData[1]
                    if (recTags?.resources?.[0]) {
                        for (let i = 0; i < Math.min(3, recTags.resources.length); i++) {
                            if (recTags.resources[i]?.uiElement?.mainTitle?.title) {
                                typelist.push(recTags.resources[i].uiElement.mainTitle.title)
                            }
                        }
                    } else {
                        if (recTags?.uiElement?.textLinks?.[0]?.text) typelist.push(recTags.uiElement.textLinks[0].text)
                    }
                    if (wikiData[2]?.uiElement?.mainTitle?.title == 'BPM') {
                        typelist.push('BPM ' + wikiData[2]?.uiElement?.textLinks?.[0]?.text)
                    } else {
                        typelist.push(wikiData[2]?.uiElement?.textLinks?.[0]?.text)
                    }
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
            FileSuffix = musicExt
            let cardSentSuccessfully = false;
            try {
                // 发送卡片
                const song = songInfo[pickNumber];
                if (song.type === 'podcast') { //播客声音貌似只能用自定义卡片
                    const musicurl = `https://music.163.com/dj?id=${song.programId}&userid=`; //暂时不知道怎么弄到userid(似乎也用不上)
                    const musicaudio = resp.data.data[0].url;
                    const musictitle = song.songName;
                    const musicimage = song.cover;
                    await sendCustomMusicCard(e, musicurl, musicaudio, musictitle, musicimage);
                } else {
                    await sendMusicCard(e, '163', song.id);
                }
                cardSentSuccessfully = true;
            } catch (error) {
                if (error.message) {
                    logger.error("发送卡片错误错误:", error.message, '将尝试发送文件/语音');
                } else {
                    logger.error("发送卡片错误错误，请查看控制台报错，将尝试发送文件/语音")
                    logger.error(error)
                }
                cardSentSuccessfully = false;
            }
            // 下载音乐
            downloadAudio(url, this.getCurDownloadPath(e), title, 'follow', musicExt)
                .then(async path => {
                    if (!cardSentSuccessfully) {
                        try {
                            // 发送群文件
                            await this.uploadGroupFile(e, path);
                            // 发送语音
                            if (musicExt != 'mp4' && this.isSendVocal) {
                                await e.reply(segment.record(path));
                            }
                        } finally {
                            // 删除文件
                            await checkAndRemoveFile(path);
                        }
                    }
                })
                .catch(err => {
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
 * 根据操作类型获取对应的Cookie
 * @param {boolean} isCloud - 是否为云盘相关操作
 * @returns {string} - 返回相应的Cookie字符串
 */
    getCookie(isCloud = false) {
        if (isCloud) {
            // 云盘操作，优先使用云盘Cookie，否则回退到通用Cookie
            return this.neteaseCloudCookie || this.neteaseCookie;
        }
        // 非云盘操作，使用通用Cookie
        return this.neteaseCookie;
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

    /**
     * 等待文件出现在指定路径并确认下载完成
     * @param {string} path 文件路径
     * @param {object} e 事件对象，用于回复
     * @param {number} timeoutSeconds 超时时间（秒），默认为60秒
     * @returns {Promise<boolean>} 文件是否在超时前出现并下载完成
     */
    async waitForFile(path, e, timeoutSeconds = 60) {
        let attempts = 0;
        let lastSize = -1;
        let stableChecks = 0;
        const maxAttempts = timeoutSeconds;
        const requiredStableChecks = 2;
        while (attempts < maxAttempts) {
            if (await checkFileExists(path)) {
                try {
                    const stats = fs.statSync(path);
                    const currentSize = stats.size;

                    if (currentSize > 0 && currentSize === lastSize) {
                        stableChecks++;
                    } else {
                        stableChecks = 0;
                    }

                    lastSize = currentSize;

                    if (stableChecks >= requiredStableChecks) {
                        logger.info(`文件已发现: ${path}，开始上传。`);
                        return true;
                    }
                } catch (error) {
                    logger.warn(`获取文件状态时出错: ${error.message}`);
                    lastSize = -1;
                    stableChecks = 0;
                }
            } else {
                lastSize = -1;
                stableChecks = 0;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        logger.error(`超时: ${maxAttempts}秒后文件仍未下载完成: ${path}`);
        e.reply(`等待文件下载${maxAttempts}秒超时，上传任务已取消。`);
        return false;
    }
}
