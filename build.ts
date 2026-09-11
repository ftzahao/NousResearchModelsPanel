import tailwindPlugin from "bun-plugin-tailwind"

// Static build for GitHub Pages: bundles index.html, the TSX entry and the
// Tailwind v4 stylesheet into docs/. Plugins only work via the JS API.
const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "docs",
  minify: true,
  plugins: [tailwindPlugin]
})

if (!result.success) {
  console.error(result.logs.join("\n"))
  process.exit(1)
}

for (const asset of result.outputs) {
  console.log(`  ${asset.path}`)
}
