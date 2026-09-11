# NousResearch Models Dashboard

[简体中文](README-ZH.md)

A single-page dashboard for browsing and comparing models available on the [NousResearch Inference API](https://inference-api.nousresearch.com).

Live demo: **https://ftzahao.github.io/NousResearchModelsPanel/**

## Features

- **Model Browser** — Filterable/searchable cards with pricing, context length, modalities, and benchmarks
- **Multi-select Filters** — Pick multiple providers and modalities at once, plus reasoning-model and free-model toggles
- **Analytics Charts** — Price comparison, intelligence vs coding scatter plot, context distribution, provider pie chart
- **Model Selection** — Select visible models, append to the current selection, or clear it, with a modal listing the current picks
- **Config Export** — Preview and download the selection as any of the supported tool config formats (see below)
- **Currency Toggle** — Display prices in CNY or USD, with a live exchange rate (open.er-api.com) or a custom rate
- **Bilingual** — Chinese/English i18n toggle
- **Dark/Light Theme** — System-aware theme switching
- **Responsive** — Mobile-friendly layout
- **Auto-refresh** — Fetches latest data from the NousResearch API on every load

## Export Formats

Select models, then choose a format in the export menu. Each format targets one tool's config schema and can be previewed before download:

| Format | Output file | Target |
| --- | --- | --- |
| Codex `model_catalog_json` | `models.json` | Codex model catalog |
| GitHub Copilot `gcmp.compatibleModels` | `gcmp-compatible-models.json` | Copilot GCMP-compatible model entries |
| GitHub Copilot `chatLanguageModels.json` | `chatLanguageModels.json` | Copilot custom-endpoint provider (`customendpoint` / `chat-completions`) |
| ZCode `v2/config.json` provider | `zcode-providers.json` | ZCode OpenAI-compatible provider entry |
| DeepSeek Harness `settings.yaml` provider | `dsh-llm-pi-ai.yaml` | DeepSeek Harness `llm-pi-ai` provider (YAML) |

All conversion logic lives in `src/model-export.ts`. The ZCode and DeepSeek Harness exports use a fixed provider id (`nous`) so re-importing replaces the same entry instead of duplicating it.

## Tech Stack

Bun + React 19 + Recharts + Tailwind CSS (CDN) + Lucide Icons + BigNumber.js + YAML

## Project Structure

- `index.ts` — Bun server (port 8092, hot reload) with a cached `/api/models` proxy for the upstream API
- `index.html` — HTML entry: Tailwind CDN config, theme CSS variables, responsive overrides
- `src/root.tsx` — React mount point
- `src/app.tsx` — Main `App` component: state, filtering/sorting, selection, exporter registry
- `src/components/` — `Header`, `StatsGrid`/`StatCard`, `FilterBar`, `ModelCard`, `ExportToolbar`, `ExportPreviewModal`, `SelectedModelsModal`, `Footer`, `charts.tsx`
- `src/hooks/` — `useModels.ts` (model fetching), `useCurrency.ts` (currency + exchange rate state)
- `src/model-export.ts` — Model selection → each export format
- `src/model-export.test.ts` — Tests for the export builders (`bun test`)
- `src/contexts.tsx`, `src/i18n.ts`, `src/types.ts`, `src/utils.ts` — Theme/currency contexts, translations, shared types, helpers
- `build.sh` — Static build script (bundles the frontend into `docs/`)

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

Runs `build.sh`, which bundles `src/root.tsx` into a single minified `docs/root.js` and writes `docs/index.html`. The `docs/` output is gitignored and built in CI, not committed.

## Deployment to GitHub Pages

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys on every push to `main`.

1. Go to **Settings → Pages** in your GitHub repo
2. Set **Source** to **GitHub Actions**
3. Push to `main` — deployment starts automatically
