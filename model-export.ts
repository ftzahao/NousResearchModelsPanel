export interface ExportableModel {
  id: string
  canonical_slug: string
  hugging_face_id: string | null
  name: string
  created: number
  description: string
  context_length: number
  architecture: {
    modality: string
    input_modalities: string[]
    output_modalities: string[]
    tokenizer: string
    instruct_type: string | null
  }
  pricing: object
  top_provider: {
    context_length: number
    max_completion_tokens: number
    is_moderated: boolean
  }
  per_request_limits: number | null
  supported_parameters: string[]
  default_parameters: object
  supported_voices: unknown
  knowledge_cutoff: unknown
  expiration_date: unknown
  links: {
    details: string
  }
  reasoning: {
    mandatory: boolean
    default_enabled: boolean
    supported_efforts: string[]
    default_effort: string
  }
  aliases: string[]
  synthesizedFreeVariant: boolean
}

export interface ModelCatalogEntry {
  slug: string
  display_name: string
  description?: string
  context_window: number
  max_context_window: number
  input_modalities?: string[]
  supported_in_api: true
  visibility: "list"
  default_reasoning_level?: string
  supported_reasoning_levels?: Array<{ effort: string }>
  support_verbosity: false
}

export interface ModelCatalog {
  models: ModelCatalogEntry[]
}

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

export interface ModelConfigExporter {
  id: string
  label: string
  fileName: string
  build: (models: ExportableModel[]) => unknown
}

export function buildModelCatalogJson(models: ExportableModel[]): ModelCatalog {
  console.log(models, "models")
  return {
    models: models.map((model) => {
      const contextWindow = model.top_provider?.context_length ?? model.context_length ?? 0
      const efforts = model.reasoning?.supported_efforts
      return {
        slug: model.id,
        display_name: model.name,
        ...(model.description ? { description: model.description } : {}),
        context_window: contextWindow,
        max_context_window: contextWindow,
        ...(model.architecture?.input_modalities?.length
          ? { input_modalities: model.architecture.input_modalities }
          : {}),
        supported_in_api: true,
        visibility: "list" as const,
        ...(model.reasoning?.default_effort
          ? { default_reasoning_level: model.reasoning.default_effort }
          : {}),
        ...(efforts?.length
          ? { supported_reasoning_levels: efforts.map((effort) => ({ effort })) }
          : {}),
        support_verbosity: false as const
      }
    })
  }
}

const GCMP_BASE_URL = "https://inference-api.nousresearch.com/v1"
const GCMP_LIMIT = { rpm: 180, tpm: 720000 }

export function buildGcmpCompatibleModels(models: ExportableModel[]): GcmpCompatibleModelEntry[] {
  return models.map((model) => {
    const contextWindow = model.top_provider?.context_length ?? model.context_length ?? 0
    const maxOutputTokens = model.top_provider?.max_completion_tokens ?? 0
    const pricing = (model.pricing ?? {}) as Record<string, string | undefined>
    // API prices are per-token; gcmp expects USD per 1M tokens
    const toPerMillion = (perToken: string) => Math.round(Number(perToken) * 1e12) / 1e6
    const promptPrice = pricing.prompt != null ? toPerMillion(pricing.prompt) : 0
    const completionPrice = pricing.completion != null ? toPerMillion(pricing.completion) : 0
    const usd: number[] = [promptPrice, completionPrice]
    if (pricing.input_cache_read != null) usd.push(toPerMillion(pricing.input_cache_read))
    if (pricing.input_cache_write != null) usd.push(toPerMillion(pricing.input_cache_write))
    return {
      baseUrl: GCMP_BASE_URL,
      capabilities: {
        imageInput: model.architecture?.input_modalities?.includes("image") ?? false,
        toolCalling: model.supported_parameters?.includes("tools") ?? false
      },
      contextWindow,
      endpoint: "/chat/completions",
      id: model.id,
      limit: GCMP_LIMIT,
      maxInputTokens: Math.max(contextWindow - maxOutputTokens, 0),
      maxOutputTokens,
      model: model.id,
      modelsEndpoint: "/models",
      name: model.name,
      provider: "Hermes Agent",
      ...(model.reasoning?.supported_efforts?.length
        ? { reasoningEffort: model.reasoning.supported_efforts }
        : {}),
      sdkMode: "openai",
      ...(promptPrice || completionPrice ? { tokenPricing: { USD: usd } } : {}),
      ...(model.description ? { tooltip: model.description } : {})
    }
  })
}
