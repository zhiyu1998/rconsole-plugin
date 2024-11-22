async function getLatestTag() {
    // GitHub 和 Gitee 的 API URL
    const githubUrl = `https://api.github.com/repos/zhiyu1998/rconsole-plugin/tags`;
    const giteeUrl = `https://gitee.com/api/v5/repos/kyrzy0416/rconsole-plugin/tags`;

    // 定义 fetch 请求
    const fetchGitHub = fetch(githubUrl).then(async (response) => {
        if (!response.ok) throw new Error("GitHub请求失败");
        const data = await response.json();
        return { source: "GitHub", tag: data };
    });

    const fetchGitee = fetch(giteeUrl).then(async (response) => {
        if (!response.ok) throw new Error("Gitee请求失败");
        const data = await response.json();
        return { source: "Gitee", tag: data };
    });

    // 使用 Promise.race 竞速
    try {
        return await Promise.race([fetchGitHub, fetchGitee]);
    } catch (error) {
        console.error("无法获取最新的标签:", error.message);
        return null;
    }
}

export async function GET(req, res) {
    const tags = await getLatestTag();
    console.log(tags);

    let latestTag;
    if (tags.source === "Gitee") {
        latestTag = tags.tag[tags.length - 1];
    }
    latestTag = tags.tag[0];
    console.log(latestTag);

    return new Response(JSON.stringify(latestTag), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
