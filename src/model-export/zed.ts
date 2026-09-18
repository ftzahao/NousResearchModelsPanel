import {
  GCMP_BASE_URL,
  getContextWindow,
  deriveContextTokens,
  hasImageInput,
  supportsToolCalling,
  type ExportableModel
} from "./shared"

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
// var name from it (NOUS → NOUS_API_KEY)
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
