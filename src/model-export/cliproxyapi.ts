import { GCMP_BASE_URL, getContextWindow, type ExportableModel } from "./shared"

// ---- CLIProxyAPI (config.yaml openai-compatibility fragment) ----

export type CliproxyapiModality = "text" | "image"

export interface CliproxyapiApiKeyEntry {
  "api-key": string
}

export interface CliproxyapiModelEntry {
  name: string
  alias: string
  "display-name"?: string
  "max-context-length"?: number
  "input-modalities"?: CliproxyapiModality[]
  "output-modalities"?: CliproxyapiModality[]
  thinking?: { levels: string[] }
}

export interface CliproxyapiProviderEntry {
  name: string
  "base-url": string
  "api-key-entries": CliproxyapiApiKeyEntry[]
  models: CliproxyapiModelEntry[]
  headers: Record<string, string>
}

export interface CliproxyapiConfig {
  "openai-compatibility": CliproxyapiProviderEntry[]
}

// fixed provider name so every export replaces the same openai-compatibility entry
const CLIPROXYAPI_PROVIDER_NAME = "nous"
// CLIProxyAPI reads provider api keys as literal config values (no env expansion),
// so the export ships a placeholder the user replaces
const CLIPROXYAPI_API_KEY_PLACEHOLDER = "YOUR_NOUS_API_KEY"

// openai-compatibility only understands text/image modalities; video, file, audio and embeddings are dropped
const CLIPROXYAPI_KNOWN_MODALITIES = ["text", "image"]
// thinking level vocabulary from CLIProxyAPI's internal/thinking; undeclared levels fail request validation
const CLIPROXYAPI_KNOWN_LEVELS = [
  "none",
  "auto",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max"
]

function buildCliproxyapiModalities(raw: string[] | undefined): CliproxyapiModality[] {
  const known = [...new Set(raw ?? [])].filter((modality): modality is CliproxyapiModality =>
    CLIPROXYAPI_KNOWN_MODALITIES.includes(modality)
  )
  return known.length ? known : ["text"]
}

function buildCliproxyapiThinkingLevels(efforts: string[] | undefined): string[] {
  const levels = new Set<string>()
  for (const effort of efforts ?? []) {
    const level = effort.toLowerCase()
    if (CLIPROXYAPI_KNOWN_LEVELS.includes(level)) levels.add(level)
  }
  return [...levels]
}

export function buildCliproxyapiConfig(models: ExportableModel[]): CliproxyapiConfig {
  return {
    "openai-compatibility": [
      {
        name: CLIPROXYAPI_PROVIDER_NAME,
        "base-url": GCMP_BASE_URL,
        "api-key-entries": [{ "api-key": CLIPROXYAPI_API_KEY_PLACEHOLDER }],
        headers: {
          "User-Agent": "HermesAgent/0.21.3",
          Authorization: "Bearer " + CLIPROXYAPI_API_KEY_PLACEHOLDER
        },
        models: models.map((model) => {
          const contextWindow = getContextWindow(model)
          const outputModalities = buildCliproxyapiModalities(model.architecture?.output_modalities)
          const levels = buildCliproxyapiThinkingLevels(model.reasoning?.supported_efforts)
          return {
            name: model.id,
            // empty alias: CPA falls back to the upstream name, so the client-visible id is unchanged
            alias: "",
            ...(model.name ? { "display-name": model.name } : {}),
            ...(contextWindow > 0 ? { "max-context-length": contextWindow } : {}),
            "input-modalities": buildCliproxyapiModalities(model.architecture?.input_modalities),
            // text is the default output; only image-producing models need declaring
            ...(outputModalities.includes("image")
              ? { "output-modalities": outputModalities }
              : {}),
            ...(levels.length ? { thinking: { levels } } : {})
          }
        })
      }
    ]
  }
}
