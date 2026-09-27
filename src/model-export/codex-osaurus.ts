import { buildModelCatalogJson, configReasoningEffort, effectiveCodexDefaultEffort, effectiveCodexEfforts, tomlString } from "./codex"
import type { ModelCatalog } from "./codex"
import type { ExportableModel } from "./shared"

// Osaurus serves every chat API from one local port (override with OSU_PORT) and
// forwards requests to the remote providers configured in its Management window.
export const OSAURUS_DEFAULT_PORT = 1337
export const OSAURUS_BASE_URL = `http://127.0.0.1:${OSAURUS_DEFAULT_PORT}/v1`

// Convention for the Nous Research remote provider in Osaurus: name it "nous",
// then its models are addressed as nous/<model-id> (e.g. nous/xiaomi/mimo-v2.6-flash).
export const OSAURUS_NOUS_PROVIDER = "nous"

export const osaurusModelId = (modelId: string) =>
  modelId.startsWith(`${OSAURUS_NOUS_PROVIDER}/`)
    ? modelId
    : `${OSAURUS_NOUS_PROVIDER}/${modelId}`

// Same catalog as the direct Codex export, but slugged the way Osaurus addresses
// remote models so /model switches keep matching the provider's model names.
export function buildCodexOsaurusModelCatalogJson(models: ExportableModel[]): ModelCatalog {
  const catalog = buildModelCatalogJson(models)
  return { models: catalog.models.map((entry) => ({ ...entry, slug: osaurusModelId(entry.slug) })) }
}

export function buildCodexOsaurusConfigToml(models: ExportableModel[]): string {
  const firstModel = models[0]
  const efforts = firstModel ? effectiveCodexEfforts(firstModel) : []
  const defaultEffort = firstModel ? effectiveCodexDefaultEffort(firstModel, efforts) : ""
  const modelId = firstModel ? osaurusModelId(firstModel.id) : ""
  return `# Codex CLI config snippet routed through the local Osaurus proxy.
# Prerequisite: Osaurus is running with a Remote Provider for the Nous Research
# Inference API (Management window -> Cloud Models -> Add Provider -> Custom,
# host inference-api.nousresearch.com, base path /v1, provider name "nous",
# key stored in Keychain) — its models are then addressed as nous/<model-id>.
# Merge these settings into ~/.codex/config.toml, then point
# model_catalog_json below at the absolute path of the exported models.json.

model_provider = "osaurus"
model = "${tomlString(modelId)}"
model_reasoning_effort = "${tomlString(configReasoningEffort(defaultEffort, efforts))}"
model_catalog_json = "<PATH_TO_MODELS_JSON>"

# Follow the system proxy (Clash/Verge, corporate PAC, ...) for Codex's own
# outbound requests. Key is singular — the plural "respect_system_proxies"
# parses as an unknown feature and is silently ignored. Merge this key into an
# existing [features] table if you already have one.
[features]
respect_system_proxy = true

[model_providers.osaurus]
name = "Osaurus"
base_url = "${OSAURUS_BASE_URL}"
wire_api = "responses"
request_max_retries = 4
stream_max_retries = 5
stream_idle_timeout_ms = 600000
# Loopback calls need no credential: Codex talks to Osaurus without a key and
# Osaurus authenticates upstream with the key from its Keychain. If your Osaurus
# server requires an access key, uncomment the next line and export it:
# env_key = "OSAURUS_API_KEY"
`
}
