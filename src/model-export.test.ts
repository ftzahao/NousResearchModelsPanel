import { expect, test } from "bun:test"
import { parse, stringify } from "yaml"
import {
  buildDshProviderConfig,
  buildGcmpCompatibleModels,
  buildGithubCopilotLanguageModels,
  buildModelCatalogJson,
  buildZcodeConfig,
  type ExportableModel
} from "./model-export"

const model = {
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

test("builds GitHub Copilot gcmp compatible model entries", () => {
  expect(buildGcmpCompatibleModels([model])).toEqual([
    {
      baseUrl: "https://inference-api.nousresearch.com/v1",
      capabilities: { imageInput: false, toolCalling: true },
      contextWindow: 131072,
      endpoint: "/chat/completions",
      id: "qwen/qwen3-coder",
      limit: { rpm: 180, tpm: 720000 },
      maxInputTokens: 114688,
      maxOutputTokens: 16384,
      model: "qwen/qwen3-coder",
      modelsEndpoint: "/models",
      name: "Qwen3 Coder",
      provider: "Hermes Agent",
      reasoningEffort: ["low", "high"],
      sdkMode: "openai",
      tooltip: "A coding model"
    }
  ])
})

test("derives maxOutputTokens as contextWindow / 8 and maxInputTokens as the remainder", () => {
  const cases = [
    { context_length: 1050000, maxOutput: 131250, maxInput: 918750 },
    { context_length: 65536, maxOutput: 8192, maxInput: 57344 },
    { context_length: 4096, maxOutput: 512, maxInput: 3584 },
    { context_length: 0, maxOutput: 0, maxInput: 0 }
  ]
  for (const c of cases) {
    const entry = buildGcmpCompatibleModels([
      { ...model, top_provider: { context_length: c.context_length } } as unknown as ExportableModel
    ])[0]!
    expect(entry.maxOutputTokens).toBe(c.maxOutput)
    expect(entry.maxInputTokens).toBe(c.maxInput)
  }
})

test("caps maxOutputTokens at the provider's declared max_completion_tokens", () => {
  // declared max output below context/8 caps the output
  const capped = {
    ...model,
    top_provider: { context_length: 131072, max_completion_tokens: 4096 }
  } as unknown as ExportableModel
  const cappedEntry = buildGcmpCompatibleModels([capped])[0]!
  expect(cappedEntry.maxOutputTokens).toBe(4096)
  expect(cappedEntry.maxInputTokens).toBe(126976)

  // declared max output above context/8 leaves the quotient untouched
  const generous = {
    ...model,
    top_provider: { context_length: 131072, max_completion_tokens: 65536 }
  } as unknown as ExportableModel
  const generousEntry = buildGcmpCompatibleModels([generous])[0]!
  expect(generousEntry.maxOutputTokens).toBe(16384)
  expect(generousEntry.maxInputTokens).toBe(114688)
})

test("omits tokenPricing for free models and includes it for priced ones", () => {
  const priced = {
    ...model,
    pricing: {
      prompt: "0.0000002",
      completion: "0.0000012",
      input_cache_read: "0.00000002",
      input_cache_write: "0.00000025"
    },
    architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] }
  } as unknown as ExportableModel
  const pricedEntries = buildGcmpCompatibleModels([priced])
  expect(pricedEntries[0]!.tokenPricing).toEqual({ USD: [0.2, 1.2, 0.02, 0.25] })
  expect(pricedEntries[0]!.capabilities.imageInput).toBe(true)

  const freeEntries = buildGcmpCompatibleModels([
    {
      id: "free/model",
      name: "Free",
      pricing: { prompt: "0", completion: "0" }
    } as unknown as ExportableModel
  ])
  expect(freeEntries[0]!.tokenPricing).toBeUndefined()
})

test("tokenPricing.USD only appends cache prices that exist", () => {
  const cacheReadOnly = {
    ...model,
    pricing: { prompt: "0.00000006", completion: "0.0000002", input_cache_read: "0.000000012" }
  } as unknown as ExportableModel
  expect(buildGcmpCompatibleModels([cacheReadOnly])[0]!.tokenPricing).toEqual({
    USD: [0.06, 0.2, 0.012]
  })
})

test("keeps full price precision for long decimal per-token prices", () => {
  const precise = {
    ...model,
    pricing: {
      prompt: "0.000000123456",
      completion: "0.000000987654",
      input_cache_read: "0.000000030012",
      input_cache_write: "0.000001234567"
    }
  } as unknown as ExportableModel
  expect(buildGcmpCompatibleModels([precise])[0]!.tokenPricing).toEqual({
    USD: [0.123456, 0.987654, 0.030012, 1.234567]
  })
})

test("builds a GitHub Copilot chatLanguageModels.json provider config", () => {
  expect(buildGithubCopilotLanguageModels([model])).toEqual([
    {
      name: "Nous Research",
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

test("builds a ZCode provider entry for the Hermes Agent channel", () => {
  expect(buildZcodeConfig([model])).toEqual({
    nous: {
      name: "Hermes Agent",
      kind: "openai-compatible",
      source: "custom",
      options: {
        apiKey: "${input:nousApiKey}",
        baseURL: "https://inference-api.nousresearch.com/v1",
        apiKeyRequired: true
      },
      models: {
        "qwen/qwen3-coder": {
          limit: { context: 131072, output: 16384 },
          modalities: { input: ["text"], output: ["text"] },
          reasoning: { enabled: true, variants: ["low", "high"], defaultVariant: "low" }
        }
      }
    }
  })
})

test("omits reasoning and defaults modalities in the ZCode export", () => {
  const provider = buildZcodeConfig([
    {
      id: "free/model",
      name: "Free",
      context_length: 4096,
      supported_parameters: []
    } as unknown as ExportableModel
  ])["nous"]!
  expect(provider.models["free/model"]).toEqual({
    limit: { context: 4096, output: 512 },
    modalities: { input: ["text"], output: ["text"] }
  })
})

test("keeps ZCode reasoning variants without a default effort", () => {
  const entry = buildZcodeConfig([
    {
      id: "r/model",
      name: "R",
      context_length: 8192,
      architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
      reasoning: { mandatory: false, supported_efforts: ["high", "max"] }
    } as unknown as ExportableModel
  ])["nous"]!.models["r/model"]!
  expect(entry.reasoning).toEqual({ enabled: true, variants: ["high", "max"] })
  expect(entry.modalities).toEqual({ input: ["text", "image"], output: ["text"] })
})

test("builds a DeepSeek Harness llm-pi-ai provider config", () => {
  expect(buildDshProviderConfig([model])).toEqual({
    "llm-pi-ai": {
      providers: {
        nous: {
          displayName: "Nous Research",
          apiKeyEnv: "NOUS_API_KEY",
          api: "openai-completions",
          baseURL: "https://inference-api.nousresearch.com/v1",
          compat: { supportsDeveloperRole: false, maxTokensField: "max_tokens" },
          models: [
            {
              id: "qwen/qwen3-coder",
              name: "Qwen3 Coder",
              contextWindow: 131072,
              maxTokens: 16384,
              reasoningEfforts: { low: "low", high: "high" }
            }
          ]
        }
      }
    }
  })
})

test("declares filtered input modalities for DeepSeek Harness vision models", () => {
  const entry = buildDshProviderConfig([
    {
      ...model,
      architecture: {
        input_modalities: ["text", "image", "audio"],
        output_modalities: ["text"]
      }
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry.input).toEqual(["text", "image"])
})

test("omits input and reasoningEfforts when a DeepSeek Harness model declares neither", () => {
  const entry = buildDshProviderConfig([
    {
      id: "free/model",
      name: "Free",
      context_length: 4096,
      supported_parameters: []
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry).toEqual({
    id: "free/model",
    name: "Free",
    contextWindow: 4096,
    maxTokens: 512
  })
})

test("maps the off level to an empty wire value in DeepSeek Harness reasoningEfforts", () => {
  const entry = buildDshProviderConfig([
    {
      ...model,
      reasoning: { mandatory: false, supported_efforts: ["off", "high"] }
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry.reasoningEfforts).toEqual({ off: null, high: "high" })
})

test("serializes the DeepSeek Harness export as parseable YAML", () => {
  const config = buildDshProviderConfig([model])
  expect(parse(stringify(config))).toEqual(config)
})
