import Base from './base.js'

export default class NeteaseModel extends Base {
    constructor (e) {
        super(e)
        this.model = 'netease'
    }

    /** 生成版本信息图片 */
    async getData (neteaseData) {
        return {
            ...this.screenData,
            saveId: 'netease',
            neteaseData: neteaseData,
        }
    }
}
