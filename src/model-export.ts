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

export interface CodexReasoningLevel {
  effort: string
  description: string
}

export interface ModelCatalogEntry {
  slug: string
  display_name: string
  description: string
  context_window: number
  max_context_window: number
  input_modalities?: string[]
  supported_in_api: boolean
  visibility: "list"
  shell_type: "unified_exec"
  priority: number
  truncation_policy: { mode: "tokens" | "bytes"; limit: number }
  default_reasoning_level: string
  supported_reasoning_levels: CodexReasoningLevel[]
  support_verbosity: false
  experimental_supported_tools: string[]
  model_messages: { instructions_template: string }
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

export interface ExportPreviewFile {
  fileName: string
  content: string
}

export interface ModelConfigExporter {
  id: string
  label: string
  fileName: string
  format?: "yaml" | "toml"
  usage?: string[]
  build: (models: ExportableModel[]) => unknown
  // additional downloadable files shown in the same preview modal (e.g. Codex ships config + catalog together)
  extraFiles?: Array<{
    fileName: string
    format?: "yaml" | "toml"
    build: (models: ExportableModel[]) => unknown
  }>
}

// Codex's ReasoningEffort enum; efforts outside this set would make the whole catalog fail to parse
const CODEX_KNOWN_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]

const CODEX_EFFORT_DESCRIPTIONS: Record<string, string> = {
  minimal: "Minimal reasoning depth",
  low: "Fast responses with lighter reasoning",
  medium: "Balances speed and reasoning depth for everyday tasks",
  high: "Greater reasoning depth for complex problems",
  xhigh: "Extra high reasoning depth for complex problems",
  max: "Maximum reasoning depth for the hardest problems",
  ultra: "Maximum reasoning with automatic task delegation"
}

export const CODEX_MODEL_INSTRUCTIONS =
  "You are Codex, a coding agent powered by this model. You share a workspace with the user and collaborate until their goal is handled. Follow the repository's existing conventions, keep changes minimal and focused, and verify your work when possible."

export function buildModelCatalogJson(models: ExportableModel[]): ModelCatalog {
  return {
    models: models.map((model, index) => {
      const contextWindow = model.top_provider?.context_length ?? model.context_length ?? 0
      const knownEfforts = (model.reasoning?.supported_efforts ?? []).filter((effort) =>
        CODEX_KNOWN_EFFORTS.includes(effort)
      )
      const efforts = knownEfforts.length ? knownEfforts : ["medium"]
      const requestedDefault = model.reasoning?.default_effort
      const fallbackDefault: string = efforts[0] ?? "medium"
      return {
        slug: model.id,
        display_name: model.name,
        description: model.description || model.name,
        context_window: contextWindow,
        max_context_window: contextWindow,
        ...(model.architecture?.input_modalities?.length
          ? { input_modalities: model.architecture.input_modalities }
          : {}),
        supported_in_api: true,
        visibility: "list" as const,
        shell_type: "unified_exec" as const,
        priority: index + 10,
        truncation_policy: { mode: "tokens" as const, limit: 10000 },
        default_reasoning_level:
          requestedDefault && efforts.includes(requestedDefault)
            ? requestedDefault
            : fallbackDefault,
        supported_reasoning_levels: efforts.map((effort) => ({
          effort,
          description: CODEX_EFFORT_DESCRIPTIONS[effort] ?? `Reasoning level ${effort}`
        })),
        support_verbosity: false as const,
        experimental_supported_tools: [],
        model_messages: { instructions_template: CODEX_MODEL_INSTRUCTIONS }
      }
    })
  }
}

const tomlString = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

export function buildCodexConfigToml(models: ExportableModel[]): string {
  return `# Codex CLI config snippet for the Nous Research Inference API.
# Merge these settings into ~/.codex/config.toml, then point
# model_catalog_json below at the absolute path of the exported models.json.

model_provider = "nous"
model = "${tomlString(models[0]?.id ?? "")}"
model_catalog_json = "<PATH_TO_MODELS_JSON>"

[model_providers.nous]
name = "Nous Research"
base_url = "${GCMP_BASE_URL}"
env_key = "NOUS_API_KEY"
wire_api = "responses"
`
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
      provider: "nous",
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
      name: "nous",
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
      name: "nous",
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

export type DshModality = "text" | "image"

export interface DshModelProfile {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
  input?: DshModality[]
  reasoningEfforts?: false | Record<string, string | null>
}

export interface DshProviderProfile {
  displayName: string
  apiKeyEnv: string
  api: "openai-completions"
  baseURL: string
  compat: { supportsDeveloperRole: false; maxTokensField: "max_tokens" }
  models: DshModelProfile[]
}

export interface DshSettings {
  "llm-pi-ai": { providers: Record<string, DshProviderProfile> }
}

// fixed route id so every export replaces the same provider in $DSH_HOME/settings.yaml
const DSH_PROVIDER_ID = "nous"
const DSH_API_KEY_ENV = "NOUS_API_KEY"

// pi-ai only accepts its own level names as reasoningEfforts keys and rejects the whole section otherwise
const DSH_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"]
// the API calls the level that turns thinking off "none"; pi-ai calls it "off"
const DSH_EFFORT_ALIASES: Record<string, string> = { none: "off" }

function buildDshReasoningEfforts(efforts: string[] | undefined) {
  const declared = new Map<string, string>()
  for (const effort of efforts ?? []) {
    const level = DSH_EFFORT_ALIASES[effort] ?? effort
    if (!DSH_THINKING_LEVELS.includes(level)) continue
    // the value is the wire spelling dispatch sends when that level is picked
    declared.set(level, effort)
  }
  if (declared.size === 0) return undefined
  // reasoningEfforts must offer a level beyond "off"; "off" alone is not a reasoning model
  if ([...declared.keys()].every((level) => level === "off")) return false
  return Object.fromEntries(declared) as Record<string, string | null>
}

export function buildDshProviderConfig(models: ExportableModel[]): DshSettings {
  return {
    "llm-pi-ai": {
      providers: {
        [DSH_PROVIDER_ID]: {
          displayName: "nous",
          apiKeyEnv: DSH_API_KEY_ENV,
          api: "openai-completions",
          baseURL: GCMP_BASE_URL,
          // pi-ai treats an unrecognized gateway URL as plain OpenAI; these are the docs' first corrections
          compat: { supportsDeveloperRole: false, maxTokensField: "max_tokens" },
          models: models.map((model) => {
            const contextWindow = model.top_provider?.context_length ?? model.context_length ?? 0
            const { maxOutputTokens } = deriveContextTokens(model)
            const input = (model.architecture?.input_modalities ?? []).filter(
              (modality): modality is DshModality => modality === "text" || modality === "image"
            )
            const reasoningEfforts = buildDshReasoningEfforts(model.reasoning?.supported_efforts)
            const entry: DshModelProfile = {
              id: model.id,
              name: model.name,
              contextWindow,
              maxTokens: maxOutputTokens,
              // only images need declaring: text is the route's default input
              ...(input.includes("image") ? { input } : {}),
              ...(reasoningEfforts === undefined ? {} : { reasoningEfforts })
            }
            return entry
          })
        }
      }
    }
  }
}
