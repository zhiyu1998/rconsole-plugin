import fs from "fs";
import Redis from "ioredis";
import yaml from "js-yaml";
import path from "path";

const configPath = path.join(process.cwd(), "../../../", "config", 'config', 'redis.yaml');

const yamlContent = await fs.promises.readFile(configPath, 'utf8');
const config = yaml.load(yamlContent);

export const redis = new Redis({
    port: config.port,
    host: config.host,
    username: config.username,
    password: config.password,
    db: config.db,
})
