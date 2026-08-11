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
