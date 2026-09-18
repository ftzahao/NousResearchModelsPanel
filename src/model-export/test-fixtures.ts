import type { ExportableModel } from "./shared"

export const model = {
  id: "qwen/qwen3-coder",
  name: "Qwen3 Coder",
  description: "A coding model",
  context_length: 131072,
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
  supported_parameters: ["reasoning", "temperature", "tools"],
  top_provider: { context_length: 131072 },
  reasoning: {
    mandatory: false,
    supported_efforts: ["low", "high"],
    default_effort: "low"
  }
} as unknown as ExportableModel

export const imageModel = {
  id: "glm-4.5v",
  name: "GLM 4.5V",
  description: "A vision model",
  context_length: 65536,
  architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
  supported_parameters: ["tools"],
  top_provider: { context_length: 65536 }
} as unknown as ExportableModel

export const pricedModel = {
  ...model,
  pricing: { prompt: "0.000001", completion: "0.000003", input_cache_read: "0.0000001" }
} as unknown as ExportableModel
