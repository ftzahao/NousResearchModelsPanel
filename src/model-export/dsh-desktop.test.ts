import { expect, test } from "bun:test"
import { parse, stringify } from "yaml"
import { buildDshDesktopPatch } from "./dsh-desktop"
import { buildDshProviderConfig } from "./dsh"
import { model } from "./test-fixtures"
import type { ExportableModel } from "./shared"

test("wraps the nous provider in a single cordis patch entry for the DeepSeek Harness desktop profile", () => {
  expect(buildDshDesktopPatch([model])).toEqual([
    {
      id: "llm-pi-ai",
      name: "@deepseek-ai/dsh-llm-pi-ai",
      config: {
        providers: {
          nous: {
            displayName: "nous",
            apiKeyEnv: "NOUS_API_KEY",
            api: "openai-completions",
            baseURL: "https://inference-api.nousresearch.com/v1",
            compat: { supportsDeveloperRole: false, maxTokensField: "max_tokens" },
            models: [
              {
                id: "qwen/qwen3-coder",
                name: "Qwen3 Coder",
                contextWindow: 131072,
                maxTokens: 16384,
                reasoningEfforts: { low: "low", high: "high" }
              }
            ]
          }
        }
      }
    }
  ])
})

test("exports the same provider profile as the DeepSeek Harness settings.yaml export", () => {
  const desktop = buildDshDesktopPatch([model])[0]!
  const settings = buildDshProviderConfig([model])["llm-pi-ai"]

  expect(desktop.config.providers.nous).toEqual(settings.providers.nous)
})

test("keeps model-level rules of the DeepSeek Harness export in the desktop patch", () => {
  const vision = buildDshDesktopPatch([
    {
      ...model,
      architecture: { input_modalities: ["text", "image", "audio"], output_modalities: ["text"] }
    } as unknown as ExportableModel
  ])[0]!.config.providers.nous!.models[0]!
  const plain = buildDshDesktopPatch([
    { id: "free/model", name: "Free", context_length: 4096, supported_parameters: [] } as unknown as ExportableModel
  ])[0]!.config.providers.nous!.models[0]!

  expect(vision.input).toEqual(["text", "image"])
  expect(plain).toEqual({ id: "free/model", name: "Free", contextWindow: 4096, maxTokens: 512 })
})

test("serializes the desktop patch as a YAML document loadable as cordis.patch.yml", () => {
  const patch = buildDshDesktopPatch([model])

  expect(parse(stringify(patch))).toEqual(patch)
  expect(Array.isArray(parse(stringify(patch)))).toBe(true)
})
