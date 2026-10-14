import { expect, test } from "bun:test"
import { buildOpencodeConfig } from "./opencode"
import { imageModel, model } from "./test-fixtures"

test("builds a native OpenCode v2 providers map with capabilities", () => {
  expect(buildOpencodeConfig([model])).toEqual({
    $schema: "https://opencode.ai/config.json",
    providers: {
      nous: {
        package: "aisdk:@ai-sdk/openai-compatible",
        name: "nous",
        settings: {
          baseURL: "https://inference-api.nousresearch.com/v1",
          apiKey: "{env:NOUS_API_KEY}"
        },
        models: {
          "qwen/qwen3-coder": {
            name: "Qwen3 Coder",
            limit: { context: 131072, input: 114688, output: 16384 },
            capabilities: {
              tools: true,
              input: ["text"],
              output: ["text"]
            }
          }
        }
      }
    }
  })
})

test("reports image input in capabilities for OpenCode vision models", () => {
  const config = buildOpencodeConfig([imageModel])
  expect(config.providers.nous?.models["glm-4.5v"]).toEqual({
    name: "GLM 4.5V",
    limit: { context: 65536, input: 57344, output: 8192 },
    capabilities: {
      tools: true,
      input: ["text", "image"],
      output: ["text"]
    }
  })
})

test("emits no v1-only fields that OpenCode v2 ignores with a warning", () => {
  const config = buildOpencodeConfig([model, imageModel])
  const text = JSON.stringify(config)
  expect(config).not.toHaveProperty("provider")
  for (const legacy of ["tool_call", "reasoning", "attachment", '"npm"']) {
    expect(text).not.toContain(legacy)
  }
})
