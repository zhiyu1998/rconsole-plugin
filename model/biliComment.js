import Base from './base.js'

export default class BiliComment extends Base {
    constructor(e) {
        super(e)
        this.model = 'biliComment'
    }

    async getData(biliCommentData) {
        return {
            ...this.screenData,
            saveId: `biliComment-${this.userId || 'default'}-${Date.now()}`,
            commentData: biliCommentData,
            biliCommentData,
        }
    }
}
