import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";
import katex from "katex";
import MarkdownIt from "markdown-it";
import markdownItKatex from "@vscode/markdown-it-katex";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(root, "_site");
const postsRoot = path.join(root, "_posts");

const macros = {
  "\\E": "\\mathbb{E}",
  "\\grad": "\\nabla_{\\theta}",
  "\\pol": "\\pi_{\\theta}",
  "\\polold": "\\pi_{\\theta_{\\text{old}}}",
  "\\polref": "\\pi_{\\text{ref}}",
  "\\polroll": "\\pi_{\\text{rollout}}",
  "\\Adv": "A^{\\pi}",
  "\\Qfn": "Q^{\\pi}",
  "\\Vfn": "V^{\\pi}",
  "\\Vhat": "V_{\\phi}",
  "\\score": "\\grad \\log \\pol",
  "\\clip": "\\operatorname{clip}",
  "\\KL": "\\operatorname{KL}",
  "\\Var": "\\operatorname{Var}"
};

// These are the same Markdown math options used by VS Code's bundled
// markdown-math extension. Rendering happens here, before publication.
const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false
}).use(markdownItKatex.default ?? markdownItKatex, {
  enableFencedBlocks: true,
  globalGroup: true,
  macros,
  katex,
  throwOnError: false
});

const excludedTopLevel = new Set([
  ".git",
  ".github",
  ".gitignore",
  "_config.yml",
  "_layouts",
  "_posts",
  "_site",
  "node_modules",
  "package.json",
  "package-lock.json",
  "README.md",
  "scripts"
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function postInfo(filename, attributes) {
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  if (!match) {
    throw new Error(`Post filename must be YYYY-MM-DD-slug.md: ${filename}`);
  }

  const [, year, month, day, slug] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid post date in ${filename}`);
  }
  if (!attributes.title) {
    throw new Error(`Missing title in ${filename}`);
  }

  return { filename, slug, date, ...attributes };
}

function formatPostDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatIndexDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function renderLayout(template, post, content) {
  const subtitle = post.subtitle
    ? ` · ${escapeHtml(post.subtitle)}`
    : "";
  const bodyClass = post.wide_tables ? "wide-tables" : "";

  const rendered = template
    .replaceAll("{{ page.title }}", escapeHtml(post.title))
    .replace("{{ page.body_class }}", bodyClass)
    .replace('{{ page.date | date: "%B %-d, %Y" }}', formatPostDate(post.date))
    .replace(
      "{% if page.subtitle %} · {{ page.subtitle }}{% endif %}",
      subtitle
    )
    .replace("{{ content }}", content);

  if (/{{|{%/.test(rendered)) {
    throw new Error(`Unresolved layout expression while rendering ${post.filename}`);
  }
  return rendered;
}

async function copyStaticFiles() {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (excludedTopLevel.has(entry.name)) continue;
    await cp(path.join(root, entry.name), path.join(outputRoot, entry.name), {
      recursive: true
    });
  }
}

async function copyKatexAssets() {
  const katexRoot = path.dirname(
    fileURLToPath(import.meta.resolve("katex/package.json"))
  );
  const destination = path.join(outputRoot, "assets", "katex");
  await mkdir(destination, { recursive: true });
  await cp(
    path.join(katexRoot, "dist", "katex.min.css"),
    path.join(destination, "katex.min.css")
  );
  await cp(path.join(katexRoot, "dist", "fonts"), path.join(destination, "fonts"), {
    recursive: true
  });
}

async function renderPosts() {
  const layout = await readFile(path.join(root, "_layouts", "post.html"), "utf8");
  const filenames = (await readdir(postsRoot))
    .filter((filename) => filename.endsWith(".md"))
    .sort();
  const posts = [];

  for (const filename of filenames) {
    const source = await readFile(path.join(postsRoot, filename), "utf8");
    const parsed = matter(source);
    const post = postInfo(filename, parsed.data);
    const content = markdown.render(parsed.content);
    const page = renderLayout(layout, post, content);
    const destination = path.join(outputRoot, "blog", post.slug);

    if (parsed.content.includes("$") && !page.includes('class="katex"')) {
      throw new Error(`Math was not rendered in ${filename}`);
    }
    if (page.includes('class="katex-error"')) {
      throw new Error(`KaTeX reported invalid math in ${filename}`);
    }

    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "index.html"), page);
    posts.push(post);
  }

  return posts.sort((a, b) => b.date - a.date);
}

// The library keeps its original dashboard and interactions. Render its note
// bodies with the same table/math support as blog posts, leaving source text intact.
async function renderLibraryNotes() {
  const filename = path.join(outputRoot, "ai-for-biology", "index.html");
  let page = await readFile(filename, "utf8");
  const pattern = /(<script id="library-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
  const match = page.match(pattern);
  if (!match) throw new Error("Missing AI-for-biology library data");
  const data = JSON.parse(match[2]);
  const notesMarkdown = new MarkdownIt({ html: false, linkify: true })
    .use(markdownItKatex.default ?? markdownItKatex, {
      enableFencedBlocks: true, globalGroup: true, katex, throwOnError: false
    });
  for (const paper of data.papers) {
    paper.summary_html = notesMarkdown.render(paper.summary_text);
    if (paper.summary_html.includes('class="katex-error"')) {
      throw new Error(`Invalid math in library paper ${paper.id}`);
    }
  }
  const json = JSON.stringify(data)
    .replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
  page = page.replace(pattern, () => match[1] + json + match[3]);
  page = page.replace("</head>", `<link rel="stylesheet" href="/assets/katex/katex.min.css">
<style>
.summary-content table { min-width: 0; table-layout: auto; display: block; overflow-x: auto; margin: 1rem 0; }
.summary-content th, .summary-content td { padding: .6rem; font-size: inherit; text-transform: none; letter-spacing: normal; }
.summary-content th { background: var(--thead); }
.summary-content .katex-display { overflow-x: auto; overflow-y: hidden; }
</style>
</head>`);
  await writeFile(filename, page);
  console.log(`Rendered notes for ${data.papers.length} library papers`);
}

async function renderBlogIndex(posts) {
  const indexPath = path.join(root, "blog", "index.html");
  const source = await readFile(indexPath, "utf8");
  const template = matter(source).content;
  const list = posts
    .map((post) => {
      const subtitle = post.subtitle
        ? `\n      <div class="sub">${escapeHtml(post.subtitle)}</div>`
        : "";
      const href = post.link_url ?? `/blog/${encodeURIComponent(post.slug)}/`;
      return `    <li>\n      <a href="${escapeHtml(href)}">${escapeHtml(post.title)}</a>\n      <span class="date">· ${formatIndexDate(post.date)}</span>${subtitle}\n    </li>`;
    })
    .join("\n");

  const rendered = template.replace(
    /  {% for post in site\.posts %}[\s\S]*?  {% endfor %}/,
    list
  );
  if (/{{|{%/.test(rendered)) {
    throw new Error("Unresolved expression while rendering the blog index");
  }

  const destination = path.join(outputRoot, "blog");
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "index.html"), rendered);
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await copyStaticFiles();
await copyKatexAssets();
await renderLibraryNotes();
const posts = await renderPosts();
await renderBlogIndex(posts);
await writeFile(path.join(outputRoot, ".nojekyll"), "");

console.log(`Built ${posts.length} posts in ${outputRoot}`);
