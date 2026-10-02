// shared types + helpers
export type { ExportableModel, ExportPreviewFile, ModelConfigExporter } from "./shared"
export {
  GCMP_BASE_URL,
  GCMP_LIMIT,
  NOUS_API_HOST,
  NOUS_API_KEY_ENV,
  getContextWindow,
  toPerMillion,
  deriveContextTokens,
  hasImageInput,
  isReasoningModel,
  supportsToolCalling
} from "./shared"

// one file per exporter
export { buildModelCatalogJson, buildCodexConfigToml, CODEX_MODEL_INSTRUCTIONS } from "./codex"
export type { CodexReasoningLevel, ModelCatalog, ModelCatalogEntry } from "./codex"

export {
  buildCodexOsaurusConfigToml,
  buildCodexOsaurusModelCatalogJson,
  osaurusModelId,
  OSAURUS_BASE_URL,
  OSAURUS_DEFAULT_PORT,
  OSAURUS_NOUS_PROVIDER
} from "./codex-osaurus"

export { buildGcmpCompatibleModels } from "./gcmp"
export type { GcmpCompatibleModelEntry } from "./gcmp"

export { buildGithubCopilotLanguageModels } from "./github-copilot"
export type {
  GithubCopilotLanguageModelEntry,
  GithubCopilotLanguageModelsProvider
} from "./github-copilot"

export { buildLitellmConfig } from "./litellm"
export type { LitellmModelEntry } from "./litellm"

export { buildOpencodeConfig } from "./opencode"
export type { OpencodeConfig, OpencodeModelEntry, OpencodeProviderEntry } from "./opencode"

export { buildCrushConfig } from "./crush"
export type { CrushConfig, CrushModelEntry, CrushProviderEntry } from "./crush"

export { buildChatboxProviderConfig } from "./chatbox"
export type { ChatboxCapability, ChatboxModelEntry, ChatboxProviderConfig } from "./chatbox"

export { buildCherryStudioProvider } from "./cherry-studio"
export type {
  CherryStudioCapability,
  CherryStudioModelEntry,
  CherryStudioProviderEntry
} from "./cherry-studio"

export { buildZcodeConfig } from "./zcode"
export type {
  ZcodeConfig,
  ZcodeInputFormat,
  ZcodeModelConfig,
  ZcodeModelOptionSpecs,
  ZcodeModelProperties,
  ZcodeModelRule,
  ZcodeProviderRule
} from "./zcode"

export {
  buildDshProviderConfig,
  buildDshProviderProfile,
  DSH_PROVIDER_ID,
  DSH_API_KEY_ENV,
  DSH_LLM_PI_AI_ID
} from "./dsh"
export type { DshModality, DshModelProfile, DshProviderProfile, DshSettings } from "./dsh"

export { buildDshDesktopPatch } from "./dsh-desktop"
export type { DshDesktopPatchEntry } from "./dsh-desktop"

export { buildZedSettings } from "./zed"
export type {
  ZedAvailableModel,
  ZedModelCapabilities,
  ZedOpenAiCompatibleProvider,
  ZedReasoningEffort,
  ZedSettings
} from "./zed"

export { buildCliproxyapiConfig } from "./cliproxyapi"
export type {
  CliproxyapiApiKeyEntry,
  CliproxyapiConfig,
  CliproxyapiModelEntry,
  CliproxyapiModality,
  CliproxyapiProviderEntry
} from "./cliproxyapi"

export { buildMimocodeConfig } from "./mimocode"
export type { MimocodeConfig, MimocodeCost, MimocodeModelEntry, MimocodeProviderEntry } from "./mimocode"

export { exporterRegistry, serializeExport } from "./registry"
