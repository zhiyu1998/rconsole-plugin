import Base from './base.js'

export default class PickSongList extends Base {
    constructor (e) {
        super(e)
        this.model = 'pick-song'
    }

    /** 生成版本信息图片 */
    async getData (songData) {
        return {
            ...this.screenData,
            saveId: 'pick-song',
            songData: songData,
        }
    }
}
