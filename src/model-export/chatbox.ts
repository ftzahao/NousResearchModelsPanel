import {
  NOUS_API_HOST,
  getContextWindow,
  deriveContextTokens,
  hasImageInput,
  isReasoningModel,
  supportsToolCalling,
  type ExportableModel
} from "./shared"

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
