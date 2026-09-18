import { expect, test } from "bun:test"
import { buildCherryStudioProvider } from "./cherry-studio"
import { imageModel, model } from "./test-fixtures"

test("builds a Cherry Studio provider entry with typed capabilities", () => {
  expect(buildCherryStudioProvider([model, imageModel])).toEqual({
    id: "nous",
    type: "openai",
    name: "nous",
    apiKey: "",
    apiHost: "https://inference-api.nousresearch.com",
    models: [
      {
        id: "qwen/qwen3-coder",
        name: "Qwen3 Coder",
        provider: "nous",
        group: "nous",
        description: "A coding model",
        capabilities: [{ type: "reasoning" }, { type: "function_calling" }]
      },
      {
        id: "glm-4.5v",
        name: "GLM 4.5V",
        provider: "nous",
        group: "nous",
        description: "A vision model",
        capabilities: [{ type: "vision" }, { type: "function_calling" }]
      }
    ],
    enabled: true,
    isSystem: false
  })
})
