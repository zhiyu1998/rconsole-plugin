import fs from 'node:fs'
import _ from 'lodash'
import YAML from 'yaml'
import chokidar from 'chokidar'

class RConfig {
  constructor () {
    // 配置文件
    this.configPath = './plugins/rconsole-plugin/config/'
    this.config = {}

    // 监听文件
    this.watcher = { config: {} }
  }

  /**
   * 获取配置文件
   * @param name
   * @returns {any}
   */
  getConfig (name) {
    let ignore = []

    if (ignore.includes(`${name}`)) {
      return this.getYaml(name)
    }

    return this.getYaml(name)
  }

  /**
   * 获取配置yaml
   * @param name 名称
   */
  getYaml (name) {
    // 获取文件路径
    let file = this.getFilePath(name)
    // 解析xml
    const yaml = YAML.parse(fs.readFileSync(file, 'utf8'))
    // 监听文件
    this.watch(file, name)
    return yaml
  }

  /**
   * 获取文件路径
   * @param name
   * @returns {string}
   */
  getFilePath (name) {
    return `${this.configPath}${name}.yaml`
  }

  /**
   * 听配置文件
   * @param file
   * @param name
   */
  watch (file, name) {
    const watcher = chokidar.watch(file)

    watcher.on('change', (path) => {
      logger.mark(`[修改配置文件][${name}]`)
    })
  }

  /**
   * 保存配置
   * @param name
   * @param data
   */
  saveSet (name, data) {
    let file = this.getFilePath(name)
    if (_.isEmpty(data)) {
      fs.existsSync(file) && fs.unlinkSync(file)
    } else {
      let yaml = YAML.stringify(data)
      fs.writeFileSync(file, yaml, 'utf8')
    }
  }
}

export default new RConfig()
