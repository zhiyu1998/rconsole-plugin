import fs from "node:fs";
import path from "path";
import config from "./model/config.js";
if (!global.segment) {
    global.segment = (await import("oicq")).segment
}

// 加载版本号
const versionData = config.getConfig("version");
// 加载名称
const packageJsonPath = path.join('./plugins', 'rconsole-plugin', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const pluginName = packageJson.name;
// 初始化输出
logger.info(logger.yellow(`R插件${versionData[0].version}初始化，欢迎加入【R插件和它的朋友们】秋秋群：575663150`));

const files = fs.readdirSync(`./plugins/${pluginName}/apps`).filter(file => file.endsWith(".js"));

let ret = [];

files.forEach(file => {
    ret.push(import(`./apps/${file}`));
});

ret = await Promise.allSettled(ret);

let apps = {};
for (let i in files) {
    let name = files[i].replace(".js", "");

    if (ret[i].status !== "fulfilled") {
        logger.error(`载入插件错误：${logger.red(name)}`);
        logger.error(ret[i].reason);
        continue;
    }
    apps[name] = ret[i].value[Object.keys(ret[i].value)[0]];
}
export { apps };
