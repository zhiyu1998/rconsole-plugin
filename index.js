import fs from 'node:fs'
import RConfig from './model/index.js'

const versionData = RConfig.getConfig('version')

logger.info('--------------------------')
logger.info(`rconsole插件${versionData[0].version}初始化~`)
logger.info('--------------------------')

// 读取功能
const files = fs
  .readdirSync('./plugins/rconsole-plugin/apps')
  .filter((file) => file.endsWith('.js'))

let apps = {}
for (let file of files) {
  let name = file.replace('.js', '')
  apps[name] = (await import(`./apps/${file}`))[name]
}

export { apps }
