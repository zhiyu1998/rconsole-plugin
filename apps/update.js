// 主库
import Version from '../model/version.js'
import config from '../model/index.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'

/**
 * 处理插件更新
 */
export class update extends plugin {
    constructor () {
        super({
            name: '更新插件',
            dsc: '更新插件代码',
            event: 'message',
            priority: 4000,
            rule: [
                {
                    reg: '^#*R(插件)?版本$',
                    fnc: 'version'
                }
            ]
        })

        this.versionData = config.getConfig('version')
    }

    /**
     * rule - 插件版本信息
     */
    async version () {
        const data = await new Version(this.e).getData(
            this.versionData.slice(0, 3)
        )
        let img = await puppeteer.screenshot('version', data)
        this.e.reply(img)
    }
}
