#!/bin/bash
# Static build for GitHub Pages deployment.
# Normally invoked through `bun run build`; CI (.github/workflows/deploy.yml) calls it directly.
# The docs/ output is gitignored — never commit it.
set -e

rm -rf docs
mkdir -p docs

# Bundle the TSX frontend into a single minified JS file (src/root.tsx is the entry point)
bun build src/root.tsx --outdir docs --target browser --minify

# Copy index.html for the static build, pointing the module script at the bundled output
sed 's|src="./src/root.tsx"|src="./root.js"|g' index.html > docs/index.html

echo "Build complete: docs/"
