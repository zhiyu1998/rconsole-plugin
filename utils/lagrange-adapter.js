import { randomUUID } from 'crypto'
import path from "path";
import fs from 'fs'
import { WebSocket } from 'ws'

export class LagrangeAdapter {
    /**
     * 构造拉格朗日适配器
     * @param wsAddr 形如：ws://127.0.0.1:9091/
     */
    constructor(wsAddr) {
        this.ws = new WebSocket(wsAddr)
    }

    /**
     * 上传群文件
     * @param bot_id - 云崽机器人id
     * @param group_id - 群号
     * @param file - 文件所在位置
     * @returns {Promise<void>}
     */
    async uploadGroupFile(bot_id, group_id, file) {
        file = await this.formatFile(file)
        if (!file.match(/^file:\/\//)) {
            file = await this.fileToPath(file)
            file = await this.formatFile(file)
        }
        file = file.replace(/^file:\/\//, '')
        const name = path.basename(file) || Date.now() + path.extname(file)
        logger.info("[R插件][拉格朗日适配器] 连接到拉格朗日");
        logger.info(bot_id, group_id, file, name);
        this.ws.on("open", () => {
            this.upload_private_file_api(bot_id, group_id, file, name);
        })
    }

    /**
     * 上传群文件的拉格朗日API
     * @param {string} id - 机器人QQ 通过e.bot、Bot调用无需传入
     * @param {number} group_id - 群号
     * @param {string} file - 本地文件路径
     * @param {string} name - 储存名称
     * @param {string} folder - 目标文件夹 默认群文件根目录
     */
    async upload_private_file_api(id, group_id, file, name, folder = '/') {
        const params = { group_id, file, name, folder }
        const echo = randomUUID()
        /** 序列化 */
        const log = JSON.stringify({ echo, action: "upload_group_file", params })
        logger.info("[R插件][拉格朗日适配器] 发送视频中...");
        /** 发送到拉格朗日 */
        this.ws.send(log);
    }

    /**
     * 处理segment中的i||i.file，主要用于一些sb字段，标准化他们
     * @param {string|object} file - i.file
     */
    async formatFile(file) {
        const str = function () {
            if (file.includes('gchat.qpic.cn') && !file.startsWith('https://')) {
                return `https://${ file }`
            } else if (file.startsWith('base64://')) {
                return file
            } else if (file.startsWith('http://') || file.startsWith('https://')) {
                return file
            } else if (fs.existsSync(path.resolve(file.replace(/^file:\/\//, '')))) {
                return `file://${ path.resolve(file.replace(/^file:\/\//, '')) }`
            } else if (fs.existsSync(path.resolve(file.replace(/^file:\/\/\//, '')))) {
                return `file://${ path.resolve(file.replace(/^file:\/\/\//, '')) }`
            }
            return file
        }

        switch (typeof file) {
            case 'object':
                /** 这里会有复读这样的直接原样不动把message发过来... */
                if (file.url) {
                    if (file?.url?.includes('gchat.qpic.cn') && !file?.url?.startsWith('https://')) return `https://${ file.url }`
                    return file.url
                }

                /** 老插件渲染出来的图有这个字段 */
                if (file?.type === 'Buffer') return Buffer.from(file?.data)
                if (Buffer.isBuffer(file) || file instanceof Uint8Array) return file

                /** 流 */
                if (file instanceof fs.ReadStream) return await Bot.Stream(file, { base: true })

                /** i.file */
                if (file.file) return str(file.file)
                return file
            case 'string':
                return str(file)
            default:
                return file
        }
    }

    /**
     * 传入文件，返回本地路径
     * 可以是http://、file://、base64://、buffer
     * @param {file://|base64://|http://|buffer} file
     * @param {string} _path - 可选，不传默认为图片
     */
    async fileToPath(file, _path) {
        if (!_path) _path = `./temp/FileToUrl/${ Date.now() }.png`
        if (Buffer.isBuffer(file) || file instanceof Uint8Array) {
            fs.writeFileSync(_path, file)
            return _path
        } else if (file instanceof fs.ReadStream) {
            const buffer = await Bot.Stream(file)
            fs.writeFileSync(_path, buffer)
            return _path
        } else if (fs.existsSync(file.replace(/^file:\/\//, ''))) {
            fs.copyFileSync(file.replace(/^file:\/\//, ''), _path)
            return _path
        } else if (fs.existsSync(file.replace(/^file:\/\/\//, ''))) {
            fs.copyFileSync(file.replace(/^file:\/\/\//, ''), _path)
            return _path
        } else if (file.startsWith('base64://')) {
            const buffer = Buffer.from(file.replace(/^base64:\/\//, ''), 'base64')
            fs.writeFileSync(_path, buffer)
            return _path
        } else if (/^http(s)?:\/\//.test(file)) {
            const res = await fetch(file)
            if (!res.ok) {
                throw new Error(`请求错误！状态码: ${ res.status }`)
            } else {
                const buffer = Buffer.from(await res.arrayBuffer())
                fs.writeFileSync(_path, buffer)
                return _path
            }
        } else {
            throw new Error('传入的文件类型不符合规则，只接受url、buffer、file://路径或者base64编码的图片')
        }
    }
}