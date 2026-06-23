import Base from './base.js'

export default class DouyinComment extends Base {
    constructor(e) {
        super(e)
        this.model = 'douyinComment'
    }

    async getData(douyinCommentData) {
        return {
            ...this.screenData,
            saveId: `douyinComment-${this.userId || 'default'}-${Date.now()}`,
            commentData: douyinCommentData,
            douyinCommentData,
        }
    }
}
