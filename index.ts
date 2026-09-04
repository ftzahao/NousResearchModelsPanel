import index from "./index.html"

const API_URL = "https://inference-api.nousresearch.com/v1/models"

// Cache the API response for 5 minutes
let cachedData: { data: unknown; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000
let inflight: Promise<unknown> | null = null

async function fetchModels() {
  const now = Date.now()
  if (cachedData && now - cachedData.timestamp < CACHE_TTL) {
    return cachedData.data
  }
  // Deduplicate concurrent requests
  if (inflight) return inflight

  inflight = (async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch(API_URL, { signal: controller.signal })
      if (!res.ok) throw new Error(`Upstream API returned ${res.status}`)
      const data = await res.json()
      cachedData = { data, timestamp: Date.now() }
      return data
    } finally {
      clearTimeout(timeout)
      inflight = null
    }
  })()

  return inflight
}

const server = Bun.serve({
  port: 8092,
  routes: {
    "/": index,
    "/api/models": {
      GET: async () => {
        try {
          const data = await fetchModels()
          return Response.json(data, {
            headers: {
              "Cache-Control": "public, max-age=300"
            }
          })
        } catch (e) {
          return Response.json({ error: "Failed to fetch models" }, { status: 502 })
        }
      }
    }
  },
  development: {
    hmr: true,
    console: true
  }
})

console.log(`🚀 Dashboard running at http://localhost:${server.port}`)
