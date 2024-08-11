import path from 'path';
import fs from "fs";

export default class Base {
  static pluginName = (() => {
    const packageJsonPath = path.join('./plugins', 'rconsole-plugin', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.name;
  })();

  constructor (e = {}) {
    this.e = e
    this.userId = e?.user_id
    this.model = Base.pluginName
    this._path = process.cwd().replace(/\\/g, '/')
  }

  get prefix () {
    return `Yz:${Base.pluginName}:${this.model}:`
  }

  /**
   * 截图默认数据
   * @param saveId html保存id
   * @param tplFile 模板html路径
   * @param pluResPath 插件资源路径
   */
  get screenData () {
    return {
      saveId: this.userId,
      tplFile: `./plugins/${Base.pluginName}/resources/html/${this.model}/${this.model}.html`,
      /** 绝对路径 */
      pluResPath: `${this._path}/plugins/${Base.pluginName}/resources/`
    }
  }
}
