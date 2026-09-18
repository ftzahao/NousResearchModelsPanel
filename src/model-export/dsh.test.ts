import { expect, test } from "bun:test"
import { parse, stringify } from "yaml"
import { buildDshProviderConfig } from "./dsh"
import { model } from "./test-fixtures"
import type { ExportableModel } from "./shared"

test("builds a DeepSeek Harness llm-pi-ai provider config", () => {
  expect(buildDshProviderConfig([model])).toEqual({
    "llm-pi-ai": {
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
  })
})

test("declares filtered input modalities for DeepSeek Harness vision models", () => {
  const entry = buildDshProviderConfig([
    {
      ...model,
      architecture: {
        input_modalities: ["text", "image", "audio"],
        output_modalities: ["text"]
      }
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry.input).toEqual(["text", "image"])
})

test("omits input and reasoningEfforts when a DeepSeek Harness model declares neither", () => {
  const entry = buildDshProviderConfig([
    {
      id: "free/model",
      name: "Free",
      context_length: 4096,
      supported_parameters: []
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry).toEqual({
    id: "free/model",
    name: "Free",
    contextWindow: 4096,
    maxTokens: 512
  })
})

test("renames the API's none effort to the off thinking level in the DeepSeek Harness export", () => {
  const entry = buildDshProviderConfig([
    {
      ...model,
      reasoning: { mandatory: false, supported_efforts: ["none", "low", "high"] }
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry.reasoningEfforts).toEqual({ off: "none", low: "low", high: "high" })
})

test("drops effort names pi-ai has no thinking level for in the DeepSeek Harness export", () => {
  const entry = buildDshProviderConfig([
    {
      ...model,
      reasoning: { mandatory: false, supported_efforts: ["none", "medium", "turbo"] }
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry.reasoningEfforts).toEqual({ off: "none", medium: "medium" })
})

test("marks a DeepSeek Harness model that only offers none as non-reasoning", () => {
  const entry = buildDshProviderConfig([
    {
      ...model,
      reasoning: { mandatory: false, supported_efforts: ["none"] }
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry.reasoningEfforts).toBe(false)
})

test("serializes the DeepSeek Harness export as parseable YAML", () => {
  const config = buildDshProviderConfig([model])
  expect(parse(stringify(config))).toEqual(config)
})
