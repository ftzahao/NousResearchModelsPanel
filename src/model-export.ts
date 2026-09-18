import BigNumber from "bignumber.js"
import type { Model, PriceField } from "./types"

// The exporters consume the same API models the dashboard renders, so this is an
// alias rather than a second hand-maintained copy of the response shape.
export type ExportableModel = Model

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
  input_modalities: string[]
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

// Codex's ReasoningEffort enum; efforts outside this set would make the whole catalog fail to parse
const CODEX_KNOWN_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]

// Codex's InputModality enum is closed (no unknown-value fallback), so anything outside
// this set fails the whole catalog parse
const CODEX_KNOWN_MODALITIES = ["text", "image", "audio"]

function buildCodexInputModalities(model: ExportableModel): string[] {
  const known = [...new Set(model.architecture?.input_modalities ?? [])].filter((modality) =>
    CODEX_KNOWN_MODALITIES.includes(modality)
  )
  // a dropped field defaults Codex to [text, image], so text-only models must say so explicitly
  return known.length ? known : ["text"]
}

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
      const contextWindow = getContextWindow(model)
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
        input_modalities: buildCodexInputModalities(model),
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

const getContextWindow = (model: ExportableModel): number =>
  model.top_provider?.context_length ?? model.context_length ?? 0

// API prices are per-token; the tool configs below expect USD per 1M tokens
const toPerMillion = (perToken: string) =>
  new BigNumber(perToken).times(1e6).decimalPlaces(6).toNumber()

function deriveContextTokens(model: ExportableModel): {
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

export function buildGcmpCompatibleModels(models: ExportableModel[]): GcmpCompatibleModelEntry[] {
  return models.map((model) => {
    const contextWindow = getContextWindow(model)
    const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
    const pricing: Partial<Record<PriceField, string>> = model.pricing ?? {}
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
          const contextWindow = getContextWindow(model)
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
            const contextWindow = getContextWindow(model)
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

const NOUS_API_HOST = "https://inference-api.nousresearch.com"
const NOUS_API_KEY_ENV = "NOUS_API_KEY"

const hasImageInput = (model: ExportableModel) =>
  model.architecture?.input_modalities?.includes("image") ?? false
const isReasoningModel = (model: ExportableModel) =>
  (model.reasoning?.supported_efforts?.length ?? 0) > 0
const supportsToolCalling = (model: ExportableModel) =>
  model.supported_parameters?.includes("tools") ?? false

// ---- LiteLLM (proxy config.yaml) ----

export interface LitellmModelEntry {
  model_name: string
  litellm_params: {
    model: string
    api_base: string
    api_key: string
  }
}

export function buildLitellmConfig(models: ExportableModel[]): LitellmModelEntry[] {
  return models.map((model) => ({
    model_name: `nous/${model.id}`,
    litellm_params: {
      model: `openai/${model.id}`,
      api_base: GCMP_BASE_URL,
      api_key: `os.environ/${NOUS_API_KEY_ENV}`
    }
  }))
}

// ---- OpenCode (opencode.json) ----

export interface OpencodeModelEntry {
  name: string
  limit: { context: number; output: number }
  reasoning?: boolean
  tool_call?: boolean
  attachment?: boolean
}

export interface OpencodeProviderEntry {
  npm: "@ai-sdk/openai-compatible"
  name: string
  options: { baseURL: string; apiKey: string }
  models: Record<string, OpencodeModelEntry>
}

export interface OpencodeConfig {
  $schema: string
  provider: Record<string, OpencodeProviderEntry>
}

export function buildOpencodeConfig(models: ExportableModel[]): OpencodeConfig {
  const modelEntries = Object.fromEntries(
    models.map((model) => {
      const contextWindow = getContextWindow(model)
      const { maxOutputTokens } = deriveContextTokens(model)
      const entry: OpencodeModelEntry = {
        name: model.name,
        limit: { context: contextWindow, output: maxOutputTokens },
        ...(isReasoningModel(model) ? { reasoning: true } : {}),
        ...(supportsToolCalling(model) ? { tool_call: true } : {}),
        ...(hasImageInput(model) ? { attachment: true } : {})
      }
      return [model.id, entry]
    })
  )
  return {
    $schema: "https://opencode.ai/config.json",
    provider: {
      nous: {
        npm: "@ai-sdk/openai-compatible",
        name: "nous",
        options: {
          baseURL: GCMP_BASE_URL,
          apiKey: "{env:NOUS_API_KEY}"
        },
        models: modelEntries
      }
    }
  }
}

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

// ---- Chatbox (one-click provider import) ----

export type ChatboxCapability = "vision" | "reasoning" | "tool_use"

export interface ChatboxModelEntry {
  modelId: string
  nickname: string
  type: "chat"
  capabilities?: ChatboxCapability[]
  contextWindow?: number
  maxOutput?: number
}

export interface ChatboxProviderConfig {
  id: string
  name: string
  type: "openai"
  iconUrl: string
  urls: { website: string }
  settings: {
    apiHost: string
    models: ChatboxModelEntry[]
  }
}

export function buildChatboxProviderConfig(models: ExportableModel[]): ChatboxProviderConfig {
  return {
    id: "nous",
    name: "nous",
    type: "openai",
    iconUrl: "https://nousresearch.com/favicon.ico",
    urls: { website: "https://nousresearch.com" },
    settings: {
      // chatbox appends /v1/chat/completions itself, so no /v1 here
      apiHost: NOUS_API_HOST,
      models: models.map((model) => {
        const contextWindow = getContextWindow(model)
        const { maxOutputTokens } = deriveContextTokens(model)
        const capabilities: ChatboxCapability[] = []
        if (hasImageInput(model)) capabilities.push("vision")
        if (isReasoningModel(model)) capabilities.push("reasoning")
        if (supportsToolCalling(model)) capabilities.push("tool_use")
        return {
          modelId: model.id,
          nickname: model.name,
          type: "chat",
          ...(capabilities.length ? { capabilities } : {}),
          ...(contextWindow ? { contextWindow } : {}),
          ...(maxOutputTokens ? { maxOutput: maxOutputTokens } : {})
        }
      })
    }
  }
}

// ---- Cherry Studio (provider entry for settings.json data.providers) ----

export type CherryStudioCapability = "vision" | "reasoning" | "function_calling"

export interface CherryStudioModelEntry {
  id: string
  name: string
  provider: string
  group: string
  description?: string
  capabilities?: Array<{ type: CherryStudioCapability }>
}

export interface CherryStudioProviderEntry {
  id: string
  type: "openai"
  name: string
  apiKey: string
  apiHost: string
  models: CherryStudioModelEntry[]
  enabled: boolean
  isSystem: false
}

export function buildCherryStudioProvider(models: ExportableModel[]): CherryStudioProviderEntry {
  return {
    id: "nous",
    type: "openai",
    name: "nous",
    apiKey: "",
    // cherry studio appends /v1 itself, so no /v1 here
    apiHost: NOUS_API_HOST,
    models: models.map((model) => {
      const capabilities: CherryStudioCapability[] = []
      if (hasImageInput(model)) capabilities.push("vision")
      if (isReasoningModel(model)) capabilities.push("reasoning")
      if (supportsToolCalling(model)) capabilities.push("function_calling")
      return {
        id: model.id,
        name: model.name,
        provider: "nous",
        group: "nous",
        ...(model.description ? { description: model.description } : {}),
        ...(capabilities.length ? { capabilities: capabilities.map((type) => ({ type })) } : {})
      }
    }),
    enabled: true,
    isSystem: false
  }
}

// ---- Zed (language_models.openai_compatible settings fragment) ----

// Zed's reasoning_effort enum for OpenAI-compatible providers
const ZED_KNOWN_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"]

export type ZedReasoningEffort = (typeof ZED_KNOWN_EFFORTS)[number]

export interface ZedModelCapabilities {
  tools: boolean
  images: boolean
  parallel_tool_calls: boolean
  prompt_cache_key: boolean
  chat_completions: boolean
  interleaved_reasoning: boolean
  max_tokens_parameter: boolean
}

export interface ZedAvailableModel {
  name: string
  display_name?: string
  max_tokens: number
  max_output_tokens?: number
  reasoning_effort?: ZedReasoningEffort
  capabilities?: ZedModelCapabilities
}

export interface ZedOpenAiCompatibleProvider {
  api_url: string
  available_models: ZedAvailableModel[]
}

export interface ZedSettings {
  language_models: {
    openai_compatible: Record<string, ZedOpenAiCompatibleProvider>
  }
}

// fixed provider id so every export replaces the same entry; Zed derives the env
// var name from it (NOUS → NOUS_API_KEY), matching NOUS_API_KEY_ENV
const ZED_PROVIDER_ID = "nous"

function buildZedReasoningEffort(
  efforts: string[] | undefined,
  defaultEffort: string | undefined
): ZedReasoningEffort | undefined {
  const known = efforts?.filter((e): e is ZedReasoningEffort => ZED_KNOWN_EFFORTS.includes(e)) ?? []
  const nonNone = known.filter((effort) => effort !== "none")
  const usableDefault =
    defaultEffort && defaultEffort !== "none" && ZED_KNOWN_EFFORTS.includes(defaultEffort)
      ? (defaultEffort as ZedReasoningEffort)
      : undefined
  // Zed's provider setup only exposes non-none levels: prefer the model's default,
  // falling back to its first supported non-none effort
  return usableDefault ?? nonNone[0]
}

// emitted in full (not just deviations from Zed's defaults) so exports stay stable if
// Zed changes them; max_tokens_parameter is true because the gateway expects the output
// limit as max_tokens, not max_completion_tokens (same fix the DeepSeek Harness compat applies)
function buildZedCapabilities(model: ExportableModel): ZedModelCapabilities {
  return {
    tools: supportsToolCalling(model),
    images: hasImageInput(model),
    parallel_tool_calls: false,
    prompt_cache_key: false,
    chat_completions: true,
    interleaved_reasoning: false,
    max_tokens_parameter: true
  }
}

export function buildZedSettings(models: ExportableModel[]): ZedSettings {
  return {
    language_models: {
      openai_compatible: {
        [ZED_PROVIDER_ID]: {
          api_url: GCMP_BASE_URL,
          available_models: models.map((model) => {
            const contextWindow = getContextWindow(model)
            const { maxOutputTokens } = deriveContextTokens(model)
            const reasoningEffort = buildZedReasoningEffort(
              model.reasoning?.supported_efforts,
              model.reasoning?.default_effort
            )
            return {
              name: model.id,
              ...(model.name ? { display_name: model.name } : {}),
              max_tokens: contextWindow,
              ...(maxOutputTokens ? { max_output_tokens: maxOutputTokens } : {}),
              ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
              capabilities: buildZedCapabilities(model)
            }
          })
        }
      }
    }
  }
}

// ---- CLIProxyAPI (config.yaml openai-compatibility fragment) ----

export type CliproxyapiModality = "text" | "image"

export interface CliproxyapiApiKeyEntry {
  "api-key": string
}

export interface CliproxyapiModelEntry {
  name: string
  alias: string
  "display-name"?: string
  "max-context-length"?: number
  "input-modalities"?: CliproxyapiModality[]
  "output-modalities"?: CliproxyapiModality[]
  thinking?: { levels: string[] }
}

export interface CliproxyapiProviderEntry {
  name: string
  "base-url": string
  "api-key-entries": CliproxyapiApiKeyEntry[]
  models: CliproxyapiModelEntry[]
  headers: Record<string, string>
}

export interface CliproxyapiConfig {
  "openai-compatibility": CliproxyapiProviderEntry[]
}

// fixed provider name so every export replaces the same openai-compatibility entry
const CLIPROXYAPI_PROVIDER_NAME = "nous"
// CLIProxyAPI reads provider api keys as literal config values (no env expansion),
// so the export ships a placeholder the user replaces
const CLIPROXYAPI_API_KEY_PLACEHOLDER = "YOUR_NOUS_API_KEY"

// openai-compatibility only understands text/image modalities; video, file, audio and embeddings are dropped
const CLIPROXYAPI_KNOWN_MODALITIES = ["text", "image"]
// thinking level vocabulary from CLIProxyAPI's internal/thinking; undeclared levels fail request validation
const CLIPROXYAPI_KNOWN_LEVELS = [
  "none",
  "auto",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max"
]

function buildCliproxyapiModalities(raw: string[] | undefined): CliproxyapiModality[] {
  const known = [...new Set(raw ?? [])].filter((modality): modality is CliproxyapiModality =>
    CLIPROXYAPI_KNOWN_MODALITIES.includes(modality)
  )
  return known.length ? known : ["text"]
}

function buildCliproxyapiThinkingLevels(efforts: string[] | undefined): string[] {
  const levels = new Set<string>()
  for (const effort of efforts ?? []) {
    const level = effort.toLowerCase()
    if (CLIPROXYAPI_KNOWN_LEVELS.includes(level)) levels.add(level)
  }
  return [...levels]
}

export function buildCliproxyapiConfig(models: ExportableModel[]): CliproxyapiConfig {
  return {
    "openai-compatibility": [
      {
        name: CLIPROXYAPI_PROVIDER_NAME,
        "base-url": GCMP_BASE_URL,
        "api-key-entries": [{ "api-key": CLIPROXYAPI_API_KEY_PLACEHOLDER }],
        headers: {
          "User-Agent": "HermesAgent/0.21.3",
          Authorization: "Bearer " + CLIPROXYAPI_API_KEY_PLACEHOLDER
        },
        models: models.map((model) => {
          const contextWindow = getContextWindow(model)
          const outputModalities = buildCliproxyapiModalities(model.architecture?.output_modalities)
          const levels = buildCliproxyapiThinkingLevels(model.reasoning?.supported_efforts)
          return {
            name: model.id,
            // the client-visible alias stays equal to the upstream id to avoid a rename layer
            alias: model.id,
            ...(model.name ? { "display-name": model.name } : {}),
            ...(contextWindow > 0 ? { "max-context-length": contextWindow } : {}),
            "input-modalities": buildCliproxyapiModalities(model.architecture?.input_modalities),
            // text is the default output; only image-producing models need declaring
            ...(outputModalities.includes("image")
              ? { "output-modalities": outputModalities }
              : {}),
            ...(levels.length ? { thinking: { levels } } : {})
          }
        })
      }
    ]
  }
}
