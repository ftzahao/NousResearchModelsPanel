import {
  GCMP_BASE_URL,
  getContextWindow,
  deriveContextTokens,
  supportsToolCalling,
  type ExportableModel
} from "./shared"

export interface ZcodeInputFormat {
  supportsText: boolean
  supportsImage: boolean
  supportsVideo: boolean
  supportsAudio: boolean
  supportsPdf: boolean
}

export interface ZcodeModelProperties {
  contextWindow?: number
  inputFormat: ZcodeInputFormat
  outputFormat: { supportsText: boolean }
  supportsToolCall: boolean
  supportsJsonSchemaOutput: boolean
  supportsNativeWebSearch: boolean
}

export interface ZcodeModelOptionSpecs {
  maxOutputTokens?: { max: number; map: string }
  reasoningLevel?: { values: string[]; map: string }
}

export interface ZcodeModelConfig {
  enabled: true
  properties: ZcodeModelProperties
  optionSpecs?: ZcodeModelOptionSpecs
}

export interface ZcodeModelRule {
  modelId: string
  providerId: string
  config: ZcodeModelConfig
}

export interface ZcodeProviderRule {
  providerId: string
  providerName: string
  config: {
    group: "standard-personal"
    access: { type: "api-key"; apiKey: string; apiKeyManagementUrl?: string }
    api: { type: "openai-chat-completions"; baseUrl: string }
    personalModelIds: string[]
    modelOrder: string[]
  }
}

export interface ZcodeConfig {
  schemaVersion: 1
  config: {
    providerOrder: string[]
    providerConfigRules: { providerRules: ZcodeProviderRule[] }
    modelConfigRules: {
      providerModelRules: ZcodeModelRule[]
      manualProviderModelRules: []
    }
  }
}

// fixed id so every export replaces the same provider entry in ~/.zcode/v2/provider_config.json;
// "builtin:" / "account:" prefixes are reserved for ZCode's own providers
// schema is the open-source client's zod contracts: packages/provider/src/config/rule-data-schema.ts
// and packages/shared/src/model-config.ts in https://github.com/zai-org/ZCode
const ZCODE_PROVIDER_ID = "nous"
// ZCode's reasoningLevel option vocabulary (from the bundled provider catalog);
// values must be sorted by ascending semantic strength
const ZCODE_KNOWN_LEVELS = ["disabled", "none", "minimal", "low", "medium", "high", "xhigh", "max"]
// ZCode's default openai-chat-completions map sends max_completion_tokens; the Nous gateway wants max_tokens
const ZCODE_MAX_TOKENS_MAP = "{'max_tokens': maxOutputTokens}"
const ZCODE_REASONING_MAP = '{"reasoning_effort": reasoningLevel}'
// Nous Portal is where inference API keys are managed; ZCode's settings UI links to it
const NOUS_API_KEY_MANAGEMENT_URL = "https://portal.nousresearch.com"

function buildZcodeReasoningValues(efforts: string[] | undefined): string[] {
  const values = new Set<string>()
  for (const effort of efforts ?? []) {
    const level = effort.toLowerCase()
    if (ZCODE_KNOWN_LEVELS.includes(level)) values.add(level)
  }
  // ZCode's schema expects values ordered from weakest to strongest
  return ZCODE_KNOWN_LEVELS.filter((level) => values.has(level))
}

export function buildZcodeConfig(models: ExportableModel[]): ZcodeConfig {
  const modelIds = models.map((model) => model.id)
  return {
    schemaVersion: 1,
    config: {
      providerOrder: [ZCODE_PROVIDER_ID],
      providerConfigRules: {
        providerRules: [
          {
            providerId: ZCODE_PROVIDER_ID,
            providerName: ZCODE_PROVIDER_ID,
            config: {
              group: "standard-personal",
              access: {
                type: "api-key",
                apiKey: "${input:nousApiKey}",
                apiKeyManagementUrl: NOUS_API_KEY_MANAGEMENT_URL
              },
              api: { type: "openai-chat-completions", baseUrl: GCMP_BASE_URL },
              personalModelIds: modelIds,
              modelOrder: modelIds
            }
          }
        ]
      },
      modelConfigRules: {
        providerModelRules: models.map((model) => {
          const contextWindow = getContextWindow(model)
          const { maxOutputTokens } = deriveContextTokens(model)
          const inputModalities = model.architecture?.input_modalities?.length
            ? model.architecture.input_modalities
            : ["text"]
          const outputModalities = model.architecture?.output_modalities?.length
            ? model.architecture.output_modalities
            : ["text"]
          const parameters = model.supported_parameters ?? []
          const reasoningValues = buildZcodeReasoningValues(model.reasoning?.supported_efforts)
          const optionSpecs: ZcodeModelOptionSpecs = {
            ...(reasoningValues.length
              ? { reasoningLevel: { values: reasoningValues, map: ZCODE_REASONING_MAP } }
              : {}),
            ...(maxOutputTokens > 0
              ? { maxOutputTokens: { max: maxOutputTokens, map: ZCODE_MAX_TOKENS_MAP } }
              : {})
          }
          return {
            modelId: model.id,
            config: {
              enabled: true as const,
              properties: {
                ...(contextWindow > 0 ? { contextWindow } : {}),
                inputFormat: {
                  supportsText: inputModalities.includes("text"),
                  supportsImage: inputModalities.includes("image"),
                  supportsVideo: inputModalities.includes("video"),
                  supportsAudio: inputModalities.includes("audio"),
                  // the API's "file" modality covers document uploads such as PDFs
                  supportsPdf: inputModalities.includes("file")
                },
                outputFormat: { supportsText: outputModalities.includes("text") },
                supportsToolCall: supportsToolCalling(model),
                supportsJsonSchemaOutput: parameters.includes("structured_outputs"),
                supportsNativeWebSearch: parameters.includes("web_search_options")
              },
              ...(Object.keys(optionSpecs).length ? { optionSpecs } : {})
            },
            providerId: ZCODE_PROVIDER_ID
          }
        }),
        manualProviderModelRules: []
      }
    }
  }
}
