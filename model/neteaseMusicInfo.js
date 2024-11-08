import Base from './base.js'

export default class NeteaseMusicInfo extends Base {
    constructor (e) {
        super(e)
        this.model = 'neteaseMusicInfo'
    }

    /** 生成版本信息图片 */
    async getData (songInfo) {
        return {
            ...this.screenData,
            saveId: 'neteaseMusicInfo',
            songInfo: songInfo,
        }
    }
}
