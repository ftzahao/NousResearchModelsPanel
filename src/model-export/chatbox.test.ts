import { expect, test } from "bun:test"
import { buildChatboxProviderConfig } from "./chatbox"
import { imageModel, model } from "./test-fixtures"

test("builds a Chatbox one-click provider import config", () => {
  expect(buildChatboxProviderConfig([model])).toEqual({
    id: "nous",
    name: "nous",
    type: "openai",
    iconUrl: "https://nousresearch.com/favicon.ico",
    urls: { website: "https://nousresearch.com" },
    settings: {
      apiHost: "https://inference-api.nousresearch.com",
      models: [
        {
          modelId: "qwen/qwen3-coder",
          nickname: "Qwen3 Coder",
          type: "chat",
          capabilities: ["reasoning", "tool_use"],
          contextWindow: 131072,
          maxOutput: 16384
        }
      ]
    }
  })
})

test("maps vision models to the Chatbox vision capability", () => {
  const models = buildChatboxProviderConfig([imageModel]).settings.models
  expect(models[0]).toEqual({
    modelId: "glm-4.5v",
    nickname: "GLM 4.5V",
    type: "chat",
    capabilities: ["vision", "tool_use"],
    contextWindow: 65536,
    maxOutput: 8192
  })
})
