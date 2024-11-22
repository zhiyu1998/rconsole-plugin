async function getLatestCommit(platform = "github") {
    // 构建 API URL
    const baseUrl =
        platform === "github"
            ? `https://api.github.com/repos/zhiyu1998/rconsole-plugin/commits`
            : `https://gitee.com/api/v5/repos/kyrzy0416/rconsole-plugin/commits`;

    try {
        const response = await fetch(baseUrl);
        if (!response.ok) throw new Error("获取提交信息失败");

        const commits = await response.json();
        const latestCommit = commits[0]; // 最新提交
        const { sha, commit, html_url } = latestCommit;

        return { sha, author: commit.author.name, message: commit.message, url: html_url };
    } catch (error) {
        console.error("无法获取最新的提交:", error.message);
        return null;
    }
}

export async function GET(req, res) {
    const latestCommit = await getLatestCommit();

    return new Response(JSON.stringify(latestCommit), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
