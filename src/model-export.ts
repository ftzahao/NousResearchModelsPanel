import BigNumber from "bignumber.js"

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

function deriveContextTokens(model: ExportableModel): {
  maxInputTokens: number
  maxOutputTokens: number
} {
  const contextWindow = model.top_provider?.context_length ?? model.context_length ?? 0
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

export function buildGcmpCompatibleModels(models: ExportableModel[]): GcmpCompatibleModelEntry[] {
  return models.map((model) => {
    const contextWindow = model.top_provider?.context_length ?? model.context_length ?? 0
    const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
    const pricing = (model.pricing ?? {}) as Record<string, string | undefined>
    // API prices are per-token; gcmp expects USD per 1M tokens
    const toPerMillion = (perToken: string) =>
      new BigNumber(perToken).times(1e6).decimalPlaces(6).toNumber()
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
      maxInputTokens,
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

export interface GithubCopilotLanguageModelEntry {
  id: string
  name: string
  url: string
  toolCalling: boolean
  vision: boolean
  maxInputTokens: number
  maxOutputTokens: number
  thinking?: boolean
  supportsReasoningEffort?: string[]
}

export interface GithubCopilotLanguageModelsProvider {
  name: string
  vendor: "customendpoint"
  apiType: "chat-completions"
  apiKey: string
  models: GithubCopilotLanguageModelEntry[]
}

export function buildGithubCopilotLanguageModels(
  models: ExportableModel[]
): GithubCopilotLanguageModelsProvider[] {
  return [
    {
      name: "Nous Research",
      vendor: "customendpoint",
      apiType: "chat-completions",
      apiKey: "${input:nousApiKey}",
      models: models.map((model) => {
        const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
        const efforts = model.reasoning?.supported_efforts
        return {
          id: model.id,
          name: model.name,
          url: `${GCMP_BASE_URL}/chat/completions`,
          toolCalling: model.supported_parameters?.includes("tools") ?? false,
          vision: model.architecture?.input_modalities?.includes("image") ?? false,
          maxInputTokens,
          maxOutputTokens,
          ...(efforts?.length ? { thinking: true, supportsReasoningEffort: efforts } : {})
        }
      })
    }
  ]
}

export interface ZcodeModelEntry {
  limit: { context: number; output: number }
  modalities: { input: string[]; output: string[] }
  reasoning?: { enabled: true; variants: string[]; defaultVariant?: string }
}

export interface ZcodeProviderEntry {
  name: string
  kind: "openai-compatible"
  source: "custom"
  options: { apiKey: string; baseURL: string; apiKeyRequired: boolean }
  models: Record<string, ZcodeModelEntry>
}

// fixed id so every export replaces the same provider entry in ~/.zcode/v2/config.json
const ZCODE_PROVIDER_ID = "nous"

export function buildZcodeConfig(models: ExportableModel[]): Record<string, ZcodeProviderEntry> {
  return {
    [ZCODE_PROVIDER_ID]: {
      name: "Hermes Agent",
      kind: "openai-compatible",
      source: "custom",
      options: {
        apiKey: "${input:nousApiKey}",
        baseURL: GCMP_BASE_URL,
        apiKeyRequired: true
      },
      models: Object.fromEntries(
        models.map((model) => {
          const contextWindow = model.top_provider?.context_length ?? model.context_length ?? 0
          const { maxOutputTokens } = deriveContextTokens(model)
          const efforts = model.reasoning?.supported_efforts
          const entry: ZcodeModelEntry = {
            limit: { context: contextWindow, output: maxOutputTokens },
            modalities: {
              input: model.architecture?.input_modalities?.length
                ? model.architecture.input_modalities
                : ["text"],
              output: model.architecture?.output_modalities?.length
                ? model.architecture.output_modalities
                : ["text"]
            },
            ...(efforts?.length
              ? {
                  reasoning: {
                    enabled: true as const,
                    variants: efforts,
                    ...(model.reasoning?.default_effort
                      ? { defaultVariant: model.reasoning.default_effort }
                      : {})
                  }
                }
              : {})
          }
          return [model.id, entry] as const
        })
      )
    }
  }
}
