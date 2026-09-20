import { expect, test } from "bun:test"
import {
  buildCodexConfigToml,
  buildModelCatalogJson,
  CODEX_MODEL_INSTRUCTIONS
} from "./codex"
import { model } from "./test-fixtures"
import type { ExportableModel } from "./shared"

test("builds a Codex model catalog from selected API models", () => {
  expect(buildModelCatalogJson([model])).toEqual({
    models: [
      {
        slug: "qwen/qwen3-coder",
        display_name: "Qwen3 Coder",
        description: "A coding model",
        context_window: 131072,
        max_context_window: 131072,
        input_modalities: ["text"],
        supported_in_api: true,
        visibility: "list",
        shell_type: "unified_exec",
        priority: 10,
        truncation_policy: { mode: "tokens", limit: 10000 },
        default_reasoning_level: "low",
        supported_reasoning_levels: [
          { effort: "low", description: "Fast responses with lighter reasoning" },
          { effort: "high", description: "Greater reasoning depth for complex problems" }
        ],
        support_verbosity: false,
        experimental_supported_tools: [],
        model_messages: { instructions_template: CODEX_MODEL_INSTRUCTIONS }
      }
    ]
  })
})

test("keeps catalog models JSON serializable and handles missing optional fields", () => {
  expect(
    buildModelCatalogJson([
      { id: "free/model", name: "Free", context_length: 0 } as unknown as ExportableModel
    ])
  ).toEqual({
    models: [
      {
        slug: "free/model",
        display_name: "Free",
        description: "Free",
        context_window: 0,
        max_context_window: 0,
        input_modalities: ["text"],
        supported_in_api: true,
        visibility: "list",
        shell_type: "unified_exec",
        priority: 10,
        truncation_policy: { mode: "tokens", limit: 10000 },
        default_reasoning_level: "medium",
        supported_reasoning_levels: [
          {
            effort: "medium",
            description: "Balances speed and reasoning depth for everyday tasks"
          }
        ],
        support_verbosity: false,
        experimental_supported_tools: [],
        model_messages: { instructions_template: CODEX_MODEL_INSTRUCTIONS }
      }
    ]
  })
})

test("drops reasoning efforts outside Codex's enum and keeps the default inside it", () => {
  const exotic = {
    ...model,
    reasoning: {
      mandatory: false,
      supported_efforts: ["disable", "high"],
      default_effort: "disable"
    }
  } as unknown as ExportableModel
  const catalog = buildModelCatalogJson([exotic])
  const entry = catalog.models[0]!
  expect(entry.supported_reasoning_levels).toEqual([
    { effort: "high", description: "Greater reasoning depth for complex problems" }
  ])
  expect(entry.default_reasoning_level).toBe("high")
})

test("filters input modalities to Codex's closed InputModality enum", () => {
  const exotic = {
    ...model,
    architecture: {
      input_modalities: ["text", "image", "audio", "video", "file", "image"],
      output_modalities: ["text"]
    }
  } as unknown as ExportableModel
  const entry = buildModelCatalogJson([exotic]).models[0]!
  expect(entry.input_modalities).toEqual(["text", "image", "audio"])
})

test("keeps extended efforts in the catalog but clamps the config default to the official enum", () => {
  const exotic = {
    ...model,
    reasoning: {
      mandatory: false,
      supported_efforts: ["disable", "max", "ultra", "high"],
      default_effort: "max"
    }
  } as unknown as ExportableModel
  const entry = buildModelCatalogJson([exotic]).models[0]!
  // catalog keeps max/ultra (some models support them)
  expect(entry.supported_reasoning_levels).toEqual([
    { effort: "max", description: "Maximum reasoning depth for the hardest problems" },
    { effort: "ultra", description: "Maximum reasoning with automatic task delegation" },
    { effort: "high", description: "Greater reasoning depth for complex problems" }
  ])
  expect(entry.default_reasoning_level).toBe("max")
  // config.toml's model_reasoning_effort only accepts up to xhigh officially
  const toml = buildCodexConfigToml([exotic])
  expect(toml).toContain('model_reasoning_effort = "high"')
})

test("builds a Codex config.toml snippet wired to the Nous provider", () => {
  const toml = buildCodexConfigToml([model])
  expect(toml).toContain('model_provider = "nous"')
  expect(toml).toContain('model = "qwen/qwen3-coder"')
  expect(toml).toContain('base_url = "https://inference-api.nousresearch.com/v1"')
  expect(toml).toContain('env_key = "NOUS_API_KEY"')
  expect(toml).toContain('wire_api = "responses"')
  // official provider fields
  expect(toml).toContain("env_key_instructions")
  expect(toml).toContain("stream_idle_timeout_ms = 600000")
  // top-level keys must precede table headers in TOML
  expect(toml.indexOf("model_catalog_json")).toBeLessThan(toml.indexOf("[model_providers.nous]"))
})

test("sets model_reasoning_effort from the first model's effective default", () => {
  expect(buildCodexConfigToml([model])).toContain('model_reasoning_effort = "low"')
  const high = {
    ...model,
    reasoning: { mandatory: false, supported_efforts: ["max", "high"], default_effort: "max" }
  } as unknown as ExportableModel
  // "max" is outside the official enum, so the effective default degrades to "high"
  expect(buildCodexConfigToml([high])).toContain('model_reasoning_effort = "high"')
})
