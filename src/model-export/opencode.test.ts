import { expect, test } from "bun:test"
import { buildOpencodeConfig } from "./opencode"
import { imageModel, model } from "./test-fixtures"

test("builds an OpenCode provider map with capability flags", () => {
  expect(buildOpencodeConfig([model])).toEqual({
    $schema: "https://opencode.ai/config.json",
    provider: {
      nous: {
        npm: "@ai-sdk/openai-compatible",
        name: "nous",
        options: {
          baseURL: "https://inference-api.nousresearch.com/v1",
          apiKey: "{env:NOUS_API_KEY}"
        },
        models: {
          "qwen/qwen3-coder": {
            name: "Qwen3 Coder",
            limit: { context: 131072, output: 16384 },
            reasoning: true,
            tool_call: true
          }
        }
      }
    }
  })
})

test("marks attachment instead of reasoning for OpenCode vision models", () => {
  const config = buildOpencodeConfig([imageModel])
  expect(config.provider.nous?.models["glm-4.5v"]).toEqual({
    name: "GLM 4.5V",
    limit: { context: 65536, output: 8192 },
    tool_call: true,
    attachment: true
  })
})
