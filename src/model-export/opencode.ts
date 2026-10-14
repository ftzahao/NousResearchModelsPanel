import {
  GCMP_BASE_URL,
  getContextWindow,
  deriveContextTokens,
  hasImageInput,
  supportsToolCalling,
  type ExportableModel
} from "./shared"

// ---- OpenCode (opencode.json, native v2 shape) ----
// Field names per https://opencode.ai/v2/docs/providers/ and the V1→V2
// migration guide: provider→providers, npm→package (with the aisdk: prefix),
// options→settings, tool_call/attachment→capabilities. V1's reasoning,
// attachment, and tool_call flags are ignored by v2 with a warning, so the
// export no longer emits them.

export type OpencodeModality = "text" | "image"

export interface OpencodeModelCapabilities {
  tools: boolean
  input: OpencodeModality[]
  output: OpencodeModality[]
}

export interface OpencodeModelEntry {
  name: string
  limit: { context: number; input: number; output: number }
  capabilities: OpencodeModelCapabilities
}

export interface OpencodeProviderEntry {
  package: "aisdk:@ai-sdk/openai-compatible"
  name: string
  settings: { baseURL: string; apiKey: string }
  models: Record<string, OpencodeModelEntry>
}

export interface OpencodeConfig {
  $schema: string
  providers: Record<string, OpencodeProviderEntry>
}

// v2 always writes capabilities, so fall back to text-only output
const buildCapabilities = (model: ExportableModel): OpencodeModelCapabilities => {
  const inputDeclared = model.architecture?.input_modalities ?? []
  const outputDeclared = model.architecture?.output_modalities ?? []
  const pick = (declared: string[]) =>
    (["text", "image"] as const).filter((modality) => declared.includes(modality))
  const input = pick(inputDeclared)
  const output = pick(outputDeclared)
  return {
    tools: supportsToolCalling(model),
    input: input.length > 0 ? input : ["text"],
    output: output.length > 0 ? output : ["text"]
  }
}

export function buildOpencodeConfig(models: ExportableModel[]): OpencodeConfig {
  const modelEntries = Object.fromEntries(
    models.map((model) => {
      const contextWindow = getContextWindow(model)
      const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
      const entry: OpencodeModelEntry = {
        name: model.name,
        limit: { context: contextWindow, input: maxInputTokens, output: maxOutputTokens },
        capabilities: buildCapabilities(model)
      }
      return [model.id, entry]
    })
  )
  return {
    $schema: "https://opencode.ai/config.json",
    providers: {
      nous: {
        package: "aisdk:@ai-sdk/openai-compatible",
        name: "nous",
        settings: {
          baseURL: GCMP_BASE_URL,
          apiKey: "{env:NOUS_API_KEY}"
        },
        models: modelEntries
      }
    }
  }
}
