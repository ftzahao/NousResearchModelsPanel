import { expect, test } from "bun:test"
import { buildGithubCopilotLanguageModels } from "./github-copilot"
import { model } from "./test-fixtures"
import type { ExportableModel } from "./shared"

test("builds a GitHub Copilot chatLanguageModels.json provider config", () => {
  expect(buildGithubCopilotLanguageModels([model])).toEqual([
    {
      name: "nous",
      vendor: "customendpoint",
      apiType: "chat-completions",
      apiKey: "${input:nousApiKey}",
      models: [
        {
          id: "qwen/qwen3-coder",
          name: "Qwen3 Coder",
          url: "https://inference-api.nousresearch.com/v1/chat/completions",
          toolCalling: true,
          vision: false,
          maxInputTokens: 114688,
          maxOutputTokens: 16384,
          thinking: true,
          supportsReasoningEffort: ["low", "high"]
        }
      ]
    }
  ])
})

test("marks vision and toolCalling from modalities and parameters", () => {
  const multimodal = {
    ...model,
    architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
    supported_parameters: ["temperature"]
  } as unknown as ExportableModel
  const entry = buildGithubCopilotLanguageModels([multimodal])[0]!.models[0]!
  expect(entry.vision).toBe(true)
  expect(entry.toolCalling).toBe(false)
})

test("omits thinking and supportsReasoningEffort for models without reasoning support", () => {
  const entry = buildGithubCopilotLanguageModels([
    {
      id: "free/model",
      name: "Free",
      context_length: 4096,
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      supported_parameters: []
    } as unknown as ExportableModel
  ])[0]!.models[0]!
  expect(entry).not.toHaveProperty("thinking")
  expect(entry).not.toHaveProperty("supportsReasoningEffort")
  expect(entry.maxInputTokens).toBe(3584)
  expect(entry.maxOutputTokens).toBe(512)
})
