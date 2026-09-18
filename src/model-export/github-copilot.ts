import { GCMP_BASE_URL, deriveContextTokens, type ExportableModel } from "./shared"

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
