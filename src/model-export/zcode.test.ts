import { expect, test } from "bun:test"
import { buildZcodeConfig } from "./zcode"
import { imageModel, model } from "./test-fixtures"
import type { ExportableModel } from "./shared"

test("builds a ZCode provider_config.json document for the nous provider", () => {
  expect(buildZcodeConfig([model])).toEqual({
    schemaVersion: 1,
    config: {
      providerOrder: ["nous"],
      providerConfigRules: {
        providerRules: [
          {
            providerId: "nous",
            providerName: "nous",
            config: {
              group: "standard-personal",
              access: { type: "api-key", apiKey: "${input:nousApiKey}" },
              api: {
                type: "openai-chat-completions",
                baseUrl: "https://inference-api.nousresearch.com/v1"
              },
              personalModelIds: ["qwen/qwen3-coder"],
              modelOrder: ["qwen/qwen3-coder"]
            }
          }
        ]
      },
      modelConfigRules: {
        providerModelRules: [
          {
            modelId: "qwen/qwen3-coder",
            providerId: "nous",
            config: {
              enabled: true,
              properties: {
                contextWindow: 131072,
                inputFormat: {
                  supportsText: true,
                  supportsImage: false,
                  supportsVideo: false,
                  supportsAudio: false,
                  supportsPdf: false
                },
                outputFormat: { supportsText: true },
                supportsToolCall: true,
                supportsJsonSchemaOutput: false,
                supportsNativeWebSearch: false
              },
              optionSpecs: {
                maxOutputTokens: { max: 16384, map: "{'max_tokens': maxOutputTokens}" },
                reasoningLevel: {
                  values: ["low", "high"],
                  map: '{"reasoning_effort": reasoningLevel}'
                }
              }
            }
          }
        ],
        manualProviderModelRules: []
      }
    }
  })
})

test("maps every ZCode modality and capability parameter", () => {
  const entry = buildZcodeConfig([
    {
      id: "vision/model",
      name: "Vision",
      context_length: 65536,
      architecture: {
        input_modalities: ["text", "image", "video", "audio", "file"],
        output_modalities: ["text"]
      },
      supported_parameters: ["tools", "structured_outputs", "web_search_options"]
    } as unknown as ExportableModel
  ]).config.modelConfigRules.providerModelRules[0]!
  expect(entry.config.properties).toEqual({
    contextWindow: 65536,
    inputFormat: {
      supportsText: true,
      supportsImage: true,
      supportsVideo: true,
      supportsAudio: true,
      supportsPdf: true
    },
    outputFormat: { supportsText: true },
    supportsToolCall: true,
    supportsJsonSchemaOutput: true,
    supportsNativeWebSearch: true
  })
  expect(entry.config.optionSpecs).toEqual({
    maxOutputTokens: { max: 8192, map: "{'max_tokens': maxOutputTokens}" }
  })
})

test("falls back to text modalities and marks non-text output in the ZCode export", () => {
  const entry = buildZcodeConfig([
    {
      id: "embed/model",
      name: "Embed",
      context_length: 0,
      architecture: { input_modalities: [], output_modalities: ["embeddings"] },
      supported_parameters: []
    } as unknown as ExportableModel
  ]).config.modelConfigRules.providerModelRules[0]!
  expect(entry.config).toEqual({
    enabled: true,
    properties: {
      inputFormat: {
        supportsText: true,
        supportsImage: false,
        supportsVideo: false,
        supportsAudio: false,
        supportsPdf: false
      },
      outputFormat: { supportsText: false },
      supportsToolCall: false,
      supportsJsonSchemaOutput: false,
      supportsNativeWebSearch: false
    }
  })
})

test("drops reasoning levels ZCode does not know", () => {
  const entries = buildZcodeConfig([
    {
      id: "r/model",
      name: "R",
      context_length: 8192,
      reasoning: { mandatory: false, supported_efforts: ["turbo", "high", "max"] }
    } as unknown as ExportableModel,
    {
      id: "odd/model",
      name: "Odd",
      context_length: 8192,
      reasoning: { mandatory: false, supported_efforts: ["turbo"] }
    } as unknown as ExportableModel
  ]).config.modelConfigRules.providerModelRules
  expect(entries[0]!.config.optionSpecs).toEqual({
    maxOutputTokens: { max: 1024, map: "{'max_tokens': maxOutputTokens}" },
    reasoningLevel: { values: ["high", "max"], map: '{"reasoning_effort": reasoningLevel}' }
  })
  expect(entries[1]!.config.optionSpecs).toEqual({
    maxOutputTokens: { max: 1024, map: "{'max_tokens': maxOutputTokens}" }
  })
})

test("keeps the ZCode export JSON serializable without unknown schema keys", () => {
  const config = buildZcodeConfig([model, imageModel])
  expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  expect(Object.keys(config.config.providerConfigRules)).toEqual(["providerRules"])
  expect(config.config.providerConfigRules.providerRules[0]!.config.group).toBe("standard-personal")
})
