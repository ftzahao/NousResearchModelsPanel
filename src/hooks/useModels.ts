import { useEffect, useState } from "react"
import type { Model } from "../types"

const API_URL = "https://inference-api.nousresearch.com/v1/models"
// Nous 的 /v1/models 已不再返回 benchmarks，从 OpenRouter（同一份模型目录）按 id 补齐
const BENCHMARKS_URL = "https://openrouter.ai/api/v1/models"

async function fetchBenchmarks(signal: AbortSignal): Promise<Map<string, Model["benchmarks"]>> {
  const r = await fetch(BENCHMARKS_URL, { signal })
  if (!r.ok) throw new Error(`Server returned ${r.status}`)
  const d = await r.json()
  const byId = new Map<string, Model["benchmarks"]>()
  for (const m of d.data ?? []) {
    if (m?.id && m.benchmarks) byId.set(m.id, m.benchmarks)
  }
  return byId
}

export function useModels() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const [modelsRes, benchmarksRes] = await Promise.allSettled([
          fetch(API_URL, { signal: controller.signal }).then((r) => {
            if (!r.ok) throw new Error(`Server returned ${r.status}`)
            return r.json() as Promise<{ data?: Model[] }>
          }),
          fetchBenchmarks(controller.signal)
        ])
        if (modelsRes.status === "rejected") throw modelsRes.reason
        let list: Model[] = modelsRes.value.data ?? []
        if (benchmarksRes.status === "fulfilled") {
          const byId = benchmarksRes.value
          list = list.map((m) => {
            const benchmarks = byId.get(m.id)
            return benchmarks ? { ...m, benchmarks } : m
          })
        }
        setModels(list)
        setLoading(false)
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [])

  return { models, loading, error }
}
