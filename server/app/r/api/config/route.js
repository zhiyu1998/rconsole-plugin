import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

const configPath = path.join(process.cwd(), "../", 'config', 'tools.yaml');

export async function GET(req, res) {
    try {
        const yamlContent = await fs.promises.readFile(configPath, 'utf8');
        const config = yaml.load(yamlContent);
        return new Response(JSON.stringify(config), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('读取配置文件失败:', error);
        return new Response(JSON.stringify({ error: '读取配置文件失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function POST(req, res) {
    try {
        const updates = await req.json();

        const yamlContent = await fs.promises.readFile(configPath, 'utf8');
        const currentConfig = yaml.load(yamlContent);

        // 只更新指定的字段
        const newConfig = { ...currentConfig, ...updates };

        // 转换回YAML并保存
        const newYamlContent = yaml.dump(newConfig, {
            indent: 2,
            lineWidth: -1,
            quotingType: '"'
        });
        await fs.promises.writeFile(configPath, newYamlContent, 'utf8');
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('更新配置文件失败:', error);
        return new Response(JSON.stringify({ error: '更新配置文件失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
