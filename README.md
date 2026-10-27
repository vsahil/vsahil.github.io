# My personal website

The blog is rendered with the same Markdown math plugin bundled with VS Code:
`markdown-it` plus `@vscode/markdown-it-katex`. GitHub Actions publishes the
generated `_site` directory to GitHub Pages.

## Local preview

```sh
pnpm install
pnpm run preview
```

Then open <http://127.0.0.1:4000/blog/>. Inline math uses `$...$` and display
math uses `$$...$$`; no delimiter conversion is needed.

## Deployment

The repository currently uses GitHub Pages' legacy branch build. After these
files are pushed, change **Settings → Pages → Build and deployment → Source**
to **GitHub Actions** once. Every later push to `main` will run the renderer and
deploy `_site` automatically.

## AI-for-biology library

The blog entry at `/blog/ai-for-biology/` embeds the full reading library at
`/ai-for-biology/`. The dashboard preserves its search, filters, related-paper
links, and light/dark themes. The website build renders note tables and math.

The Markdown files in your AI-for-biology project remain authoritative. To
refresh the website snapshot after editing them:

```sh
python3 scripts/sync-ai-biology.py /path/to/AI-for-biology
pnpm run build
```

Review and commit `ai-for-biology/index.html`, then push to publish the updated
notes. Syncing alone does not deploy the website. The snapshot includes every
summary in the library; project instructions and other local files are not copied.
