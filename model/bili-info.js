import Base from './base.js'

export default class BiliInfoModel extends Base {
    constructor (e) {
        super(e)
        this.model = 'bili-info'
    }

    /** 生成版本信息图片 */
    async getData (biliInfoData) {
        return {
            ...this.screenData,
            saveId: 'bili-info',
            biliInfoData: biliInfoData,
        }
    }
}
