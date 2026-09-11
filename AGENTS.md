# NousResearch Models Dashboard

Bun + React 19 single-page dashboard for browsing the [NousResearch Inference API](https://inference-api.nousresearch.com) model list. The section below is project-specific; the Bun conventions that follow still apply.

## Commands

- `bun install` — install dependencies
- `bun run dev` — Bun server on port 8092 with HMR (`bun --hot index.ts`)
- `bun test` — run `src/model-export.test.ts`
- `bun run typecheck` — `tsc --noEmit`
- `bun run build` — runs `build.sh`, bundling `index.html` + `src/root.tsx` + Tailwind CSS into static assets in `docs/`

## Architecture

- `index.ts` — `Bun.serve()` on port 8092, serves `index.html` at `/` and a 5-minute cached `/api/models` proxy for the upstream API
- `src/app.tsx` — main `App`: state, filtering/sorting, model selection, and the exporter registry
- `src/hooks/` — `useModels.ts` (browser-side fetch of the API), `useCurrency.ts` (CNY/USD rate state)
- `src/components/` — presentational components plus `charts.tsx` (Recharts)
- `src/model-export.ts` — the only place that maps selected models to tool config formats; keep conversions there
- `src/i18n.ts`, `src/contexts.tsx`, `src/types.ts`, `src/utils.ts` — translations, theme/currency contexts, shared types, helpers

## Conventions

- Every user-facing string must exist in both the `zh` and `en` sections of `src/i18n.ts`
- Themes are driven by CSS variables in `index.html` plus `theme === "dark"` conditional classes; Tailwind v4 compiles locally (`src/tailwind.css` with `@theme`/`@custom-variant dark`, `bun-plugin-tailwind` via `bunfig.toml` in dev and `build.ts` in prod) — never load it from a CDN
- Adding an export format means adding a builder in `src/model-export.ts`, a registry entry in `src/app.tsx`, i18n labels for both languages, and tests in `src/model-export.test.ts`
- `docs/` is gitignored and built by CI (`.github/workflows/deploy.yml` calls `bash build.sh`); never commit its contents

---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
