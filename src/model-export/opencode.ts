import {
  GCMP_BASE_URL,
  getContextWindow,
  deriveContextTokens,
  hasImageInput,
  isReasoningModel,
  supportsToolCalling,
  type ExportableModel
} from "./shared"

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
