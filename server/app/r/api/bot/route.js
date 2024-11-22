import { REDIS_YUNZAI_WEBUI } from "../../../../../constants/constant.js";
import { redis } from "../../../../utils/redis.js";


export async function GET(req, res) {
    const botInfo = JSON.parse(await redis.get(REDIS_YUNZAI_WEBUI));

    return new Response(JSON.stringify(botInfo), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
