import { GCMP_BASE_URL, getContextWindow, type ExportableModel } from "./shared"

export interface CodexReasoningLevel {
  effort: string
  description: string
}

export interface ModelCatalogEntry {
  slug: string
  display_name: string
  description: string
  context_window: number
  max_context_window: number
  input_modalities: string[]
  supported_in_api: boolean
  visibility: "list"
  shell_type: "unified_exec"
  priority: number
  truncation_policy: { mode: "tokens" | "bytes"; limit: number }
  default_reasoning_level: string
  supported_reasoning_levels: CodexReasoningLevel[]
  support_verbosity: false
  experimental_supported_tools: string[]
  model_messages: { instructions_template: string }
}

export interface ModelCatalog {
  models: ModelCatalogEntry[]
}

// Codex's ReasoningEffort enum; efforts outside this set would make the whole catalog fail to parse
const CODEX_KNOWN_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]

// Codex's InputModality enum is closed (no unknown-value fallback), so anything outside
// this set fails the whole catalog parse
const CODEX_KNOWN_MODALITIES = ["text", "image", "audio"]

function buildCodexInputModalities(model: ExportableModel): string[] {
  const known = [...new Set(model.architecture?.input_modalities ?? [])].filter((modality) =>
    CODEX_KNOWN_MODALITIES.includes(modality)
  )
  // a dropped field defaults Codex to [text, image], so text-only models must say so explicitly
  return known.length ? known : ["text"]
}

const CODEX_EFFORT_DESCRIPTIONS: Record<string, string> = {
  minimal: "Minimal reasoning depth",
  low: "Fast responses with lighter reasoning",
  medium: "Balances speed and reasoning depth for everyday tasks",
  high: "Greater reasoning depth for complex problems",
  xhigh: "Extra high reasoning depth for complex problems",
  max: "Maximum reasoning depth for the hardest problems",
  ultra: "Maximum reasoning with automatic task delegation"
}

export const CODEX_MODEL_INSTRUCTIONS =
  "You are Codex, a coding agent powered by this model. You share a workspace with the user and collaborate until their goal is handled. Follow the repository's existing conventions, keep changes minimal and focused, and verify your work when possible."

export function buildModelCatalogJson(models: ExportableModel[]): ModelCatalog {
  return {
    models: models.map((model, index) => {
      const contextWindow = getContextWindow(model)
      const knownEfforts = (model.reasoning?.supported_efforts ?? []).filter((effort) =>
        CODEX_KNOWN_EFFORTS.includes(effort)
      )
      const efforts = knownEfforts.length ? knownEfforts : ["medium"]
      const requestedDefault = model.reasoning?.default_effort
      const fallbackDefault: string = efforts[0] ?? "medium"
      return {
        slug: model.id,
        display_name: model.name,
        description: model.description || model.name,
        context_window: contextWindow,
        max_context_window: contextWindow,
        input_modalities: buildCodexInputModalities(model),
        supported_in_api: true,
        visibility: "list" as const,
        shell_type: "unified_exec" as const,
        priority: index + 10,
        truncation_policy: { mode: "tokens" as const, limit: 10000 },
        default_reasoning_level:
          requestedDefault && efforts.includes(requestedDefault)
            ? requestedDefault
            : fallbackDefault,
        supported_reasoning_levels: efforts.map((effort) => ({
          effort,
          description: CODEX_EFFORT_DESCRIPTIONS[effort] ?? `Reasoning level ${effort}`
        })),
        support_verbosity: false as const,
        experimental_supported_tools: [],
        model_messages: { instructions_template: CODEX_MODEL_INSTRUCTIONS }
      }
    })
  }
}

const tomlString = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

export function buildCodexConfigToml(models: ExportableModel[]): string {
  return `# Codex CLI config snippet for the Nous Research Inference API.
# Merge these settings into ~/.codex/config.toml, then point
# model_catalog_json below at the absolute path of the exported models.json.

model_provider = "nous"
model = "${tomlString(models[0]?.id ?? "")}"
model_catalog_json = "<PATH_TO_MODELS_JSON>"

[model_providers.nous]
name = "Nous Research"
base_url = "${GCMP_BASE_URL}"
env_key = "NOUS_API_KEY"
wire_api = "responses"
`
}
