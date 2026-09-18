import {
  GCMP_BASE_URL,
  NOUS_API_KEY_ENV,
  getContextWindow,
  toPerMillion,
  deriveContextTokens,
  hasImageInput,
  isReasoningModel,
  type ExportableModel
} from "./shared"
import type { PriceField } from "../types"

// ---- Crush (crush.json) ----

export interface CrushModelEntry {
  id: string
  name: string
  context_window: number
  default_max_tokens: number
  cost_per_1m_in: number
  cost_per_1m_out: number
  cost_per_1m_in_cached: number
  cost_per_1m_out_cached: number
  can_reason: boolean
  supports_attachments: boolean
}

export interface CrushProviderEntry {
  id: string
  name: string
  type: "openai"
  base_url: string
  api_key: string
  models: CrushModelEntry[]
}

export interface CrushConfig {
  $schema: string
  providers: Record<string, CrushProviderEntry>
}

export function buildCrushConfig(models: ExportableModel[]): CrushConfig {
  return {
    $schema: "https://charm.land/crush.json",
    providers: {
      nous: {
        id: "nous",
        name: "nous",
        type: "openai",
        base_url: GCMP_BASE_URL,
        api_key: `$${NOUS_API_KEY_ENV}`,
        models: models.map((model) => {
          const pricing: Partial<Record<PriceField, string>> = model.pricing ?? {}
          const contextWindow = getContextWindow(model)
          const { maxOutputTokens } = deriveContextTokens(model)
          return {
            id: model.id,
            name: model.name,
            context_window: contextWindow,
            default_max_tokens: maxOutputTokens,
            // all four cost fields are schema-required; cache-write has no API price
            cost_per_1m_in: pricing.prompt != null ? toPerMillion(pricing.prompt) : 0,
            cost_per_1m_out: pricing.completion != null ? toPerMillion(pricing.completion) : 0,
            cost_per_1m_in_cached:
              pricing.input_cache_read != null ? toPerMillion(pricing.input_cache_read) : 0,
            cost_per_1m_out_cached: 0,
            can_reason: isReasoningModel(model),
            supports_attachments: hasImageInput(model)
          }
        })
      }
    }
  }
}
