import { expect, test } from "bun:test"
import { buildZedSettings } from "./zed"
import { imageModel, model } from "./test-fixtures"
import type { ExportableModel } from "./shared"

const zedBaseCapabilities = {
  tools: true,
  images: false,
  parallel_tool_calls: false,
  prompt_cache_key: false,
  chat_completions: true,
  interleaved_reasoning: false,
  max_tokens_parameter: true
}

test("builds a Zed openai_compatible settings fragment", () => {
  expect(buildZedSettings([model])).toEqual({
    language_models: {
      openai_compatible: {
        nous: {
          api_url: "https://inference-api.nousresearch.com/v1",
          available_models: [
            {
              name: "qwen/qwen3-coder",
              display_name: "Qwen3 Coder",
              max_tokens: 131072,
              max_output_tokens: 16384,
              reasoning_effort: "low",
              capabilities: zedBaseCapabilities
            }
          ]
        }
      }
    }
  })
})

test("declares image support through capabilities for Zed vision models", () => {
  expect(buildZedSettings([imageModel]).language_models.openai_compatible.nous).toEqual({
    api_url: "https://inference-api.nousresearch.com/v1",
    available_models: [
      {
        name: "glm-4.5v",
        display_name: "GLM 4.5V",
        max_tokens: 65536,
        max_output_tokens: 8192,
        capabilities: { ...zedBaseCapabilities, images: true }
      }
    ]
  })
})

test("disables Zed tools for models without tool support", () => {
  const noTools = { ...model, supported_parameters: ["temperature"] } as unknown as ExportableModel
  expect(buildZedSettings([noTools]).language_models.openai_compatible.nous).toEqual({
    api_url: "https://inference-api.nousresearch.com/v1",
    available_models: [
      {
        name: "qwen/qwen3-coder",
        display_name: "Qwen3 Coder",
        max_tokens: 131072,
        max_output_tokens: 16384,
        reasoning_effort: "low",
        capabilities: { ...zedBaseCapabilities, tools: false }
      }
    ]
  })
})

test("picks the first supported non-none effort when the Zed default is unknown", () => {
  const oddEfforts = {
    ...model,
    reasoning: {
      mandatory: false,
      supported_efforts: ["none", "ultra", "high"],
      default_effort: "ultra"
    }
  } as unknown as ExportableModel
  expect(buildZedSettings([oddEfforts]).language_models.openai_compatible.nous).toEqual({
    api_url: "https://inference-api.nousresearch.com/v1",
    available_models: [
      {
        name: "qwen/qwen3-coder",
        display_name: "Qwen3 Coder",
        max_tokens: 131072,
        max_output_tokens: 16384,
        reasoning_effort: "high",
        capabilities: zedBaseCapabilities
      }
    ]
  })
})
