import { REDIS_RESOLVE_CONTROLLER } from "../../../../constants/redis.js";
import { GLOBAL_RESOLE_CONTROLLER } from "../../../../constants/resolve.js";
import { redis } from "../../../../utils/redis.js";

export async function GET(req, res) {
    let resolveList = await redis.get(REDIS_RESOLVE_CONTROLLER);
    if (resolveList == null) {
        // Redis中不存在就初始化进去
        await redis.set(REDIS_RESOLVE_CONTROLLER, JSON.stringify(GLOBAL_RESOLE_CONTROLLER));
        return new Response(JSON.stringify(GLOBAL_RESOLE_CONTROLLER), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(resolveList, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function POST(req) {
    try {
        const data = await req.json();
        const { selectedTags } = data;

        // 获取所有可能的标签
        const allTags = GLOBAL_RESOLE_CONTROLLER.map(item => item.label);

        // 更新控制器状态
        const updatedController = GLOBAL_RESOLE_CONTROLLER.map(item => ({
            ...item,
            value: selectedTags.includes(item.label) ? 1 : 0
        }));

        // 保存到Redis
        await redis.set(REDIS_RESOLVE_CONTROLLER, JSON.stringify(updatedController));

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
