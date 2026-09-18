import {
  NOUS_API_HOST,
  hasImageInput,
  isReasoningModel,
  supportsToolCalling,
  type ExportableModel
} from "./shared"

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
