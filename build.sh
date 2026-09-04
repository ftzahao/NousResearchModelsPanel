#!/bin/bash
set -e

# Build script for GitHub Pages static deployment
rm -rf docs
mkdir -p docs

# Bundle the TSX frontend into a single JS file
bun build frontend.tsx --outdir docs --target browser --minify

# Copy index.html and update script reference
sed 's|src="./frontend.tsx"|src="./frontend.js"|g' index.html > docs/index.html

echo "Build complete: docs/"
