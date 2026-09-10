import { useEffect, useState } from "react"
import type { Model } from "../types"

const API_URL = "https://inference-api.nousresearch.com/v1/models"

export function useModels() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(API_URL, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setModels(d.data ?? [])
        setLoading(false)
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  return { models, loading, error }
}
