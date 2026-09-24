import { stringify } from "yaml"
import type { ModelConfigExporter } from "./shared"
import { buildCodexConfigToml, buildModelCatalogJson } from "./codex"
import { buildGcmpCompatibleModels } from "./gcmp"
import { buildGithubCopilotLanguageModels } from "./github-copilot"
import { buildZcodeConfig } from "./zcode"
import { buildDshProviderConfig } from "./dsh"
import { buildLitellmConfig } from "./litellm"
import { buildCliproxyapiConfig } from "./cliproxyapi"
import { buildOpencodeConfig } from "./opencode"
import { buildCrushConfig } from "./crush"
import { buildChatboxProviderConfig } from "./chatbox"
import { buildCherryStudioProvider } from "./cherry-studio"
import { buildZedSettings } from "./zed"
import { buildMimocodeConfig } from "./mimocode"

export const exporterRegistry: readonly ModelConfigExporter[] = [
  {
    id: "codex",
    fileName: "codex-config.toml",
    format: "toml",
    build: (items) => buildCodexConfigToml(items),
    extraFiles: [{ fileName: "models.json", build: (items) => buildModelCatalogJson(items) }]
  },
  {
    id: "github-copilot-gcmp",
    fileName: "gcmp-compatible-models.json",
    build: (items) => buildGcmpCompatibleModels(items)
  },
  {
    id: "github-copilot-language-models",
    fileName: "chatLanguageModels.json",
    build: (items) => buildGithubCopilotLanguageModels(items)
  },
  {
    id: "zcode",
    fileName: "zcode-provider-config.json",
    build: (items) => buildZcodeConfig(items)
  },
  {
    id: "deepseek-harness",
    fileName: "dsh-llm-pi-ai.yaml",
    format: "yaml",
    build: (items) => buildDshProviderConfig(items)
  },
  {
    id: "litellm",
    fileName: "litellm-config.yaml",
    format: "yaml",
    build: (items) => buildLitellmConfig(items)
  },
  {
    id: "cliproxyapi",
    fileName: "cliproxyapi-config.yaml",
    format: "yaml",
    build: (items) => buildCliproxyapiConfig(items)
  },
  {
    id: "opencode",
    fileName: "opencode.json",
    build: (items) => buildOpencodeConfig(items)
  },
  {
    id: "crush",
    fileName: "crush.json",
    build: (items) => buildCrushConfig(items)
  },
  {
    id: "chatbox",
    fileName: "chatbox-nous-provider.json",
    build: (items) => buildChatboxProviderConfig(items)
  },
  {
    id: "cherry-studio",
    fileName: "cherry-studio-nous.json",
    build: (items) => buildCherryStudioProvider(items)
  },
  {
    id: "zed",
    fileName: "zed-language-models.json",
    build: (items) => buildZedSettings(items)
  },
  {
    id: "mimocode",
    fileName: "mimocode.jsonc",
    build: (items) => buildMimocodeConfig(items)
  }
]

export function serializeExport(payload: unknown, format?: "yaml" | "toml"): string {
  return format === "yaml"
    ? stringify(payload)
    : format === "toml"
      ? String(payload)
      : JSON.stringify(payload, null, 2)
}
