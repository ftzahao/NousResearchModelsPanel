import BigNumber from "bignumber.js"
import type { Model, PriceField } from "../types"

// The exporters consume the same API models the dashboard renders, so this is an
// alias rather than a second hand-maintained copy of the response shape.
export type ExportableModel = Model

export interface ExportPreviewFile {
  fileName: string
  content: string
}

export interface ModelConfigExporter {
  id: string
  label?: string
  fileName: string
  format?: "yaml" | "toml"
  usage?: string[]
  // shown as a ⚠️ badge in the picker and a callout in the preview modal (e.g. Codex needs an API proxy)
  warning?: string
  build: (models: ExportableModel[]) => unknown
  // additional downloadable files shown in the same preview modal (e.g. Codex ships config + catalog together)
  extraFiles?: Array<{
    fileName: string
    format?: "yaml" | "toml"
    build: (models: ExportableModel[]) => unknown
  }>
}

export const GCMP_BASE_URL = "https://inference-api.nousresearch.com/v1"
export const GCMP_LIMIT = { rpm: 180, tpm: 720000 }
export const NOUS_API_HOST = "https://inference-api.nousresearch.com"
export const NOUS_API_KEY_ENV = "NOUS_API_KEY"

export const getContextWindow = (model: ExportableModel): number =>
  model.top_provider?.context_length ?? model.context_length ?? 0

// API prices are per-token; the tool configs below expect USD per 1M tokens
export const toPerMillion = (perToken: string) =>
  new BigNumber(perToken).times(1e6).decimalPlaces(6).toNumber()

export function deriveContextTokens(model: ExportableModel): {
  maxInputTokens: number
  maxOutputTokens: number
} {
  const contextWindow = getContextWindow(model)
  // reserve 1/8 of the context window for output, capped at the provider's max output
  const context = new BigNumber(contextWindow)
  const declaredMaxOutput = model.top_provider?.max_completion_tokens ?? 0
  const maxOutputTokens =
    contextWindow > 0
      ? BigNumber.min(context.dividedToIntegerBy(8), declaredMaxOutput || Infinity).toNumber()
      : 0
  const maxInputTokens = BigNumber.max(context.minus(maxOutputTokens), 0).toNumber()
  return { maxInputTokens, maxOutputTokens }
}

export const hasImageInput = (model: ExportableModel) =>
  model.architecture?.input_modalities?.includes("image") ?? false
export const isReasoningModel = (model: ExportableModel) =>
  (model.reasoning?.supported_efforts?.length ?? 0) > 0
export const supportsToolCalling = (model: ExportableModel) =>
  model.supported_parameters?.includes("tools") ?? false

export const pricingOf = (model: ExportableModel): Partial<Record<PriceField, string>> =>
  model.pricing ?? {}
