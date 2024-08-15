import { dirname } from "path";
import fg from "fast-glob";
import fs from "fs-extra";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import type { FeedOptions, Item } from "feed";
import { Feed } from "feed";

const DOMAIN = "https://zhiyu1998.github.io/rconsole-plugin";
const AUTHOR = {
  name: "zhiyu1998",
  email: "renzhiyu0416@gmail.com",
  link: DOMAIN,
};
const OPTIONS: FeedOptions = {
  title: "R-Plugin",
  description: "Plugin' Blog",
  id: `${DOMAIN}/`,
  link: `${DOMAIN}/`,
  copyright: "MIT License",
  feedLinks: {
    json: DOMAIN + "/feed.json",
    atom: DOMAIN + "/feed.atom",
    rss: DOMAIN + "/feed.xml",
  },
  author: AUTHOR,
  image: "https://zhiyu1998.github.io/rconsole-plugin/horse.svg",
  favicon: "https://zhiyu1998.github.io/rconsole-plugin/horse.svg",
};

const markdown = MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
});

export async function buildBlogRSS() {
  const posts = await generateRSS();
  writeFeed("feed", posts);
}

async function generateRSS() {
  const files = await fg("posts/*.md");

  const posts: any[] = (
    await Promise.all(
      files
        .filter((i) => !i.includes("index"))
        .map(async (i) => {
          const raw = await fs.readFile(i, "utf-8");
          const { data, content } = matter(raw);
          const html = markdown
            .render(content)
            .replace('src="/', `src="${DOMAIN}/`);

          return {
            ...data,
            date: new Date(data.date),
            content: html,
            author: [AUTHOR],
            link: `${DOMAIN}/${i.replace(".md", ".html")}`,
          };
        })
    )
  ).filter(Boolean);

  posts.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return posts;
}

async function writeFeed(name: string, items: Item[]) {
  const feed = new Feed(OPTIONS);
  items.forEach((item) => feed.addItem(item));

  await fs.ensureDir(dirname(`./.vitepress/dist/${name}`));
  await fs.writeFile(`./.vitepress/dist/${name}.xml`, feed.rss2(), "utf-8");
  await fs.writeFile(`./.vitepress/dist/${name}.atom`, feed.atom1(), "utf-8");
  await fs.writeFile(`./.vitepress/dist/${name}.json`, feed.json1(), "utf-8");
}
