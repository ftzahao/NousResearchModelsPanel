import { expect, test } from "bun:test"
import { buildModelCatalogJson, type ExportableModel } from "./model-export"

const model = {
  id: "qwen/qwen3-coder",
  name: "Qwen3 Coder",
  description: "A coding model",
  context_length: 131072,
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
  supported_parameters: ["reasoning", "temperature"],
  top_provider: { context_length: 131072 },
  reasoning: {
    mandatory: false,
    supported_efforts: ["low", "high"],
    default_effort: "low"
  }
} as unknown as ExportableModel

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
        default_reasoning_level: "low",
        supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }],
        support_verbosity: false
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
        context_window: 0,
        max_context_window: 0,
        supported_in_api: true,
        visibility: "list",
        support_verbosity: false
      }
    ]
  })
})
