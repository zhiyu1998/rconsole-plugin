import axios from "axios";

export async function GET(request) {
    const url = new URL(request.url);  // 获取请求的 URL
    const targetUrl = url.searchParams.get("url"); // 从查询参数中获取目标 URL
    const start = Date.now(); // 记录请求开始时间

    try {
        await axios.get(targetUrl);
         // 计算结束时间减去开始时间
        return new Response(JSON.stringify({
            time: Date.now() - start
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            time: 0
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
