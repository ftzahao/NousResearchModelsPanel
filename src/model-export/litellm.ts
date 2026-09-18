import { GCMP_BASE_URL, NOUS_API_KEY_ENV, type ExportableModel } from "./shared"

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
