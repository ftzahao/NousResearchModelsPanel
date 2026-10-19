import {
  GCMP_BASE_URL,
  NOUS_API_KEY_ENV,
  getContextWindow,
  deriveContextTokens,
  hasImageInput,
  isReasoningModel,
  NOUS_PROVIDER_ID,
  perMillionPrice,
  pricingOf,
  type ExportableModel
} from "./shared"

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
        id: NOUS_PROVIDER_ID,
        name: NOUS_PROVIDER_ID,
        type: "openai",
        base_url: GCMP_BASE_URL,
        api_key: `$${NOUS_API_KEY_ENV}`,
        models: models.map((model) => {
          const pricing = pricingOf(model)
          const contextWindow = getContextWindow(model)
          const { maxOutputTokens } = deriveContextTokens(model)
          return {
            id: model.id,
            name: model.name,
            context_window: contextWindow,
            default_max_tokens: maxOutputTokens,
            // all four cost fields are schema-required; cache-write has no API price
            cost_per_1m_in: perMillionPrice(pricing, "prompt"),
            cost_per_1m_out: perMillionPrice(pricing, "completion"),
            cost_per_1m_in_cached: perMillionPrice(pricing, "input_cache_read"),
            cost_per_1m_out_cached: 0,
            can_reason: isReasoningModel(model),
            supports_attachments: hasImageInput(model)
          }
        })
      }
    }
  }
}
