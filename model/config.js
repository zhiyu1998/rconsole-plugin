import fs from 'node:fs';
import path from 'node:path';
import _ from 'lodash';
import YAML from 'yaml';
import chokidar from 'chokidar';
import Base from "./base.js";

class RConfig extends Base{
    constructor(e) {
        super(e);
        this.configPath = `./plugins/${RConfig.pluginName}/config/`;
        this.previousContent = new Map(); // 存储每个文件之前的内容
        this.watchers = new Map();
        this.templateSchemaOptions = {
            tools: {
                strict: true,
                preserveExtraKeyPaths: [],
            },
        };
    }

    get templateConfigNames() {
        return new Set(Object.keys(this.templateSchemaOptions));
    }

    getConfig(name) {
        return this.getYaml(name);
    }

    getField(name, field) {
        const config = this.getConfig(name);
        return config[field];
    }

    updateField(name, field, value) {
        let config = this.getConfig(name);
        config[field] = value;
        logger.mark(`[R插件][修改配置项][${name}][${field}]修改为：${value}`);
        this.saveAllConfig(name, config);
    }

    deleteField(name, field) {
        let config = this.getConfig(name);
        delete config[field];
        this.saveAllConfig(name, config);
    }

    getYaml(name, isWatch = true) {
        let file = this.getFilePath(name);
        const yaml = this.hasTemplate(name)
            ? this.ensureTemplateConfig(name)
            : this.readYamlFile(file);

        if (isWatch) {
            this.previousContent.set(name, yaml); // 保存初始内容
            this.watch(file, name);
        }
        return yaml;
    }

    getFilePath(name) {
        return this.normalizePath(path.join(this.configPath, `${name}.yaml`));
    }

    getTemplatePath(name) {
        return this.normalizePath(path.join(this.configPath, `${name}.template.yaml`));
    }

    hasTemplate(name) {
        if (!this.templateConfigNames.has(name)) {
            return false;
        }

        return fs.existsSync(this.getTemplatePath(name));
    }

    normalizePath(filePath) {
        return filePath.replace(/\\/g, '/');
    }

    readYamlFile(file) {
        if (!fs.existsSync(file)) {
            return {};
        }

        const content = fs.readFileSync(file, 'utf8');
        if (!content.trim()) {
            return {};
        }

        return YAML.parse(content) ?? {};
    }

    ensureTemplateConfig(name) {
        const templateFile = this.getTemplatePath(name);
        const file = this.getFilePath(name);
        const templateConfig = this.readYamlFile(templateFile);
        const templateSchemaOptions = this.getTemplateSchemaOptions(name);

        if (!fs.existsSync(file)) {
            fs.copyFileSync(templateFile, file);
            logger.mark(`[R插件][配置文件]：${name}已根据模板初始化`);
            return templateConfig;
        }

        const localConfig = this.readYamlFile(file);
        const mergedConfig = this.alignWithTemplate(templateConfig, localConfig, templateSchemaOptions);

        if (!_.isEqual(localConfig, mergedConfig)) {
            this.writeYamlFile(file, mergedConfig);
            logger.mark(`[R插件][配置文件]：${name}已根据模板增量同步`);
        }

        return mergedConfig;
    }

    getTemplateSchemaOptions(name) {
        return this.templateSchemaOptions[name] ?? {
            strict: false,
            preserveExtraKeyPaths: [],
        };
    }

    shouldPreserveExtraKeys(currentPath, options) {
        if (!options.strict) {
            return true;
        }

        const currentPathText = currentPath.join('.');
        return (options.preserveExtraKeyPaths || []).includes(currentPathText);
    }

    alignWithTemplate(templateConfig, localConfig, options = {}, currentPath = []) {
        if (Array.isArray(templateConfig)) {
            return Array.isArray(localConfig) ? localConfig : _.cloneDeep(templateConfig);
        }

        if (_.isPlainObject(templateConfig)) {
            const result = {};
            const source = _.isPlainObject(localConfig) ? localConfig : {};

            for (const key of Object.keys(templateConfig)) {
                const localValue = Object.prototype.hasOwnProperty.call(source, key)
                    ? source[key]
                    : undefined;
                result[key] = this.alignWithTemplate(templateConfig[key], localValue, options, [...currentPath, key]);
            }

            if (this.shouldPreserveExtraKeys(currentPath, options)) {
                for (const key of Object.keys(source)) {
                    if (!Object.prototype.hasOwnProperty.call(templateConfig, key)) {
                        result[key] = _.cloneDeep(source[key]);
                    }
                }
            }

            return result;
        }

        return localConfig !== undefined ? localConfig : templateConfig;
    }

    writeYamlFile(file, data) {
        let yaml = YAML.stringify(data);
        fs.writeFileSync(file, yaml, 'utf8');
    }

    watch(file, name) {
        if (this.watchers.has(name)) {
            return;
        }

        const watcher = chokidar.watch(file, { ignoreInitial: true });

        watcher.on('change', changedPath => {
            const currentContent = this.readYamlFile(changedPath);
            const previousContent = this.previousContent.get(name);

            if (!_.isEqual(previousContent, currentContent)) {
                logger.mark(`[R插件][配置文件]：${name}已经被重置`);
                this.previousContent.set(name, currentContent); // 更新之前的内容
            }
        });

        this.watchers.set(name, watcher);
    }

    saveAllConfig(name, data) {
        let file = this.getFilePath(name);
        const finalData = this.hasTemplate(name)
            ? this.alignWithTemplate(
                this.readYamlFile(this.getTemplatePath(name)),
                data,
                this.getTemplateSchemaOptions(name),
            )
            : data;

        if (!this.hasTemplate(name) && _.isEmpty(finalData)) {
            fs.existsSync(file) && fs.unlinkSync(file);
        } else {
            this.writeYamlFile(file, finalData);
        }
        this.previousContent.set(name, finalData);
        this.watch(file, name);
    }
}

export default new RConfig();
