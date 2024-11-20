import axiosInstance from "../../../../../utils/axiosInstance.js";

export async function GET(request, { params }) {
    const { pid } = params;
    const napcatResp = await axiosInstance.get(`/${ pid }`);
    return new Response(JSON.stringify(napcatResp), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
