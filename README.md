# NousResearch Models Dashboard

[简体中文](README-ZH.md)

A single-page dashboard for browsing and comparing models available on the [NousResearch Inference API](https://inference-api.nousresearch.com).

Live demo: **https://ftzahao.github.io/NousResearchModelsPanel/**

## Features

- **Model Browser** — Filterable/searchable cards with pricing, context length, modalities, and benchmarks
- **Analytics Charts** — Price comparison, intelligence vs coding scatter plot, context distribution, provider pie chart
- **Model Export** — Select models and export a Codex model catalog JSON (`model-export.ts`)
- **Currency Toggle** — Display prices in CNY or USD
- **Bilingual** — Chinese/English i18n toggle
- **Dark/Light Theme** — System-aware theme switching
- **Responsive** — Mobile-friendly layout
- **Auto-refresh** — Fetches latest data from the NousResearch API on every load

## Tech Stack

Bun + React 19 + Recharts + Tailwind CSS + Lucide Icons + BigNumber.js

## Project Structure

- `index.ts` — Bun server (serves the app at port 8092)
- `index.html` / `src/` — Frontend (`app.tsx`, `components/`, `contexts.tsx`, `i18n.ts`, `utils.ts`)
- `model-export.ts` — Model selection → Codex catalog JSON export logic

## Local Development

```bash
bun install
bun run dev
```

Opens at `http://localhost:8092` with hot reload.

## Testing & Type Check

```bash
bun test
bun run typecheck
```

## Build

```bash
bun run build
```

Produces static files in `docs/` directory.

## Deployment to GitHub Pages

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys on every push to `main`.

1. Go to **Settings → Pages** in your GitHub repo
2. Set **Source** to **GitHub Actions**
3. Push to `main` — deployment starts automatically
