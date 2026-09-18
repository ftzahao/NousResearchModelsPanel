import { GCMP_BASE_URL, getContextWindow, deriveContextTokens, type ExportableModel } from "./shared"

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
