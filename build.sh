#!/bin/bash
# Static build for GitHub Pages deployment.
# Normally invoked through `bun run build`; CI (.github/workflows/deploy.yml) calls it directly.
# The docs/ output is gitignored — never commit it.
set -e

rm -rf docs
mkdir -p docs

# Bundle index.html + src/root.tsx + Tailwind CSS into static assets (build.ts wires the Tailwind plugin)
bun build.ts

echo "Build complete: docs/"
