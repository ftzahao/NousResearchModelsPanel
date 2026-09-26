import { expect, test } from "bun:test"
import { buildMimocodeConfig } from "./mimocode"
import { imageModel, model, pricedModel } from "./test-fixtures"
import type { ExportableModel } from "./shared"

test("builds a MiMo Desktop provider map with schema and env apiKey", () => {
  expect(buildMimocodeConfig([model])).toEqual({
    $schema: "https://mimo.xiaomi.com/mimocode/config.json",
    provider: {
      nous: {
        id: "nous",
        name: "nous",
        npm: "@ai-sdk/openai-compatible",
        options: {
          baseURL: "https://inference-api.nousresearch.com/v1",
          apiKey: "{env:NOUS_API_KEY}"
        },
        models: {
          "qwen/qwen3-coder": {
            id: "qwen/qwen3-coder",
            name: "Qwen3 Coder",
            attachment: false,
            reasoning: true,
            temperature: true,
            tool_call: true,
            limit: { context: 131072, input: 114688, output: 16384 },
            modalities: { input: ["text"], output: ["text"] },
            headers: { "User-Agent": "HermesAgent/0.21.5" }
          }
        }
      }
    }
  })
})

test("maps capabilities and modalities for MiMo Desktop vision models", () => {
  const config = buildMimocodeConfig([imageModel])
  expect(config.provider.nous?.models["glm-4.5v"]).toEqual({
    id: "glm-4.5v",
    name: "GLM 4.5V",
    attachment: true,
    reasoning: false,
    temperature: false,
    tool_call: true,
    limit: { context: 65536, input: 57344, output: 8192 },
    modalities: { input: ["text", "image"], output: ["text"] },
    headers: { "User-Agent": "HermesAgent/0.21.5" }
  })
})

test("converts per-token pricing into per-million cost for MiMo Desktop", () => {
  const config = buildMimocodeConfig([pricedModel])
  expect(config.provider.nous?.models["qwen/qwen3-coder"]?.cost).toEqual({
    input: 1,
    output: 3,
    cache_read: 0.1
  })
})

test("omits cost when pricing is absent from the API model", () => {
  const config = buildMimocodeConfig([model])
  expect(config.provider.nous?.models["qwen/qwen3-coder"]).not.toHaveProperty("cost")
})

test("falls back to text-only input when input_modalities is missing", () => {
  const bare = {
    ...model,
    id: "bare/model",
    architecture: {}
  } as unknown as ExportableModel
  const config = buildMimocodeConfig([bare])
  expect(config.provider.nous?.models["bare/model"]?.modalities).toEqual({
    input: ["text"],
    output: ["text"]
  })
})
