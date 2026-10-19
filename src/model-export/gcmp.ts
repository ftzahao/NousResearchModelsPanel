import {
  GCMP_BASE_URL,
  GCMP_LIMIT,
  getContextWindow,
  toPerMillion,
  deriveContextTokens,
  hasImageInput,
  supportsToolCalling,
  NOUS_PROVIDER_ID,
  perMillionPrice,
  pricingOf,
  type ExportableModel
} from "./shared"

export interface GcmpCompatibleModelEntry {
  baseUrl: string
  capabilities: { imageInput: boolean; toolCalling: boolean }
  contextWindow: number
  endpoint: string
  id: string
  limit: { rpm: number; tpm: number }
  maxInputTokens: number
  maxOutputTokens: number
  model: string
  modelsEndpoint: string
  name: string
  provider: string
  reasoningEffort?: string[]
  sdkMode: string
  tokenPricing?: { USD: number[] }
  tooltip?: string
}

export function buildGcmpCompatibleModels(models: ExportableModel[]): GcmpCompatibleModelEntry[] {
  return models.map((model) => {
    const contextWindow = getContextWindow(model)
    const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
    const pricing = pricingOf(model)
    const promptPrice = perMillionPrice(pricing, "prompt")
    const completionPrice = perMillionPrice(pricing, "completion")
    const usd: number[] = [promptPrice, completionPrice]
    if (pricing.input_cache_read != null) usd.push(toPerMillion(pricing.input_cache_read))
    if (pricing.input_cache_write != null) usd.push(toPerMillion(pricing.input_cache_write))
    return {
      baseUrl: GCMP_BASE_URL,
      capabilities: {
        imageInput: hasImageInput(model),
        toolCalling: supportsToolCalling(model)
      },
      contextWindow,
      endpoint: "/chat/completions",
      id: model.id,
      limit: GCMP_LIMIT,
      maxInputTokens,
      maxOutputTokens,
      model: model.id,
      modelsEndpoint: "/models",
      name: model.name,
      provider: NOUS_PROVIDER_ID,
      ...(model.reasoning?.supported_efforts?.length
        ? { reasoningEffort: model.reasoning.supported_efforts }
        : {}),
      sdkMode: "openai",
      ...(promptPrice || completionPrice ? { tokenPricing: { USD: usd } } : {}),
      ...(model.description ? { tooltip: model.description } : {})
    }
  })
}
