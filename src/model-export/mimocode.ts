import {
  GCMP_BASE_URL,
  deriveContextTokens,
  getContextWindow,
  hasImageInput,
  isReasoningModel,
  supportsToolCalling,
  toPerMillion,
  type ExportableModel
} from "./shared"

// ---- Xiaomi MiMo Desktop (mimocode.jsonc) ----
// Model entry fields per https://mimo.xiaomi.com/mimocode/config.json ProviderConfig

export interface MimocodeCost {
  input: number
  output: number
  cache_read?: number
  cache_write?: number
}

export interface MimocodeModelEntry {
  id: string
  name: string
  attachment: boolean
  reasoning: boolean
  temperature: boolean
  tool_call: boolean
  cost?: MimocodeCost
  limit: { context: number; input: number; output: number }
  modalities: { input: string[]; output: string[] }
  headers: Record<string, string>
}

export interface MimocodeProviderEntry {
  id: string
  name: string
  npm: "@ai-sdk/openai-compatible"
  models: Record<string, MimocodeModelEntry>
  options: { apiKey: string; baseURL: string }
}

export interface MimocodeConfig {
  $schema: string
  provider: Record<string, MimocodeProviderEntry>
}

// modality enum from the mimocode config schema
const INPUT_MODALITIES = ["text", "audio", "image", "video", "pdf"] as const
const OUTPUT_MODALITIES = ["text", "audio", "image", "video", "pdf"] as const

const MIMOCODE_USER_AGENT = "HermesAgent/0.21.5"

const buildModalities = (model: ExportableModel) => {
  const inputDeclared = model.architecture?.input_modalities ?? []
  const outputDeclared = model.architecture?.output_modalities ?? []
  const input = INPUT_MODALITIES.filter((modality) => inputDeclared.includes(modality))
  const output = OUTPUT_MODALITIES.filter((modality) => outputDeclared.includes(modality))
  return {
    input: input.length > 0 ? input : ["text"],
    output: output.length > 0 ? output : ["text"]
  }
}

// cost is USD per 1M tokens; omit unless the API reports both required rates
const buildCost = (model: ExportableModel): MimocodeCost | undefined => {
  const pricing = model.pricing
  if (!pricing?.prompt || !pricing?.completion) return undefined
  const cost: MimocodeCost = {
    input: toPerMillion(pricing.prompt),
    output: toPerMillion(pricing.completion)
  }
  if (pricing.input_cache_read) cost.cache_read = toPerMillion(pricing.input_cache_read)
  if (pricing.input_cache_write) cost.cache_write = toPerMillion(pricing.input_cache_write)
  return cost
}

export function buildMimocodeConfig(models: ExportableModel[]): MimocodeConfig {
  const modelEntries = Object.fromEntries(
    models.map((model) => {
      const contextWindow = getContextWindow(model)
      const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
      const cost = buildCost(model)
      const entry: MimocodeModelEntry = {
        id: model.id,
        name: model.name,
        attachment: hasImageInput(model),
        reasoning: isReasoningModel(model),
        temperature: model.supported_parameters?.includes("temperature") ?? false,
        tool_call: supportsToolCalling(model),
        ...(cost ? { cost } : {}),
        limit: { context: contextWindow, input: maxInputTokens, output: maxOutputTokens },
        modalities: buildModalities(model),
        headers: { "User-Agent": MIMOCODE_USER_AGENT }
      }
      return [model.id, entry]
    })
  )
  return {
    $schema: "https://mimo.xiaomi.com/mimocode/config.json",
    provider: {
      nous: {
        id: "nous",
        name: "nous",
        npm: "@ai-sdk/openai-compatible",
        models: modelEntries,
        options: {
          apiKey: "{env:NOUS_API_KEY}",
          baseURL: GCMP_BASE_URL
        }
      }
    }
  }
}
