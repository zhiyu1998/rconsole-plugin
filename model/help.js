import Base from './base.js'
import config from './config.js'
import cfg from '../../../lib/config/config.js'

export default class Help extends Base {
    constructor(e) {
        super(e)
        this.model = 'help'
    }

    static async get(e) {
        let html = new Help(e)
        return await html.getData()
    }

    async getData() {
        let helpData = config.getConfig('help')

        let groupCfg = cfg.getGroup(this.group_id)

        if (groupCfg.disable && groupCfg.disable.length) {
            helpData.map((item) => {
                if (groupCfg.disable.includes(item.group)) {
                    item.disable = true
                }
                return item
            })
        }

        const versionData = config.getConfig('version')

        const version =
            (versionData && versionData.length && versionData[0].version) || '1.0.0'

        return {
            ...this.screenData,
            saveId: 'help',
            version,
            helpData
        }
    }
}
