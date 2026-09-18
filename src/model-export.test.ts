import { expect, test } from "bun:test"
import { parse, stringify } from "yaml"
import {
  buildCodexConfigToml,
  buildDshProviderConfig,
  buildGcmpCompatibleModels,
  buildGithubCopilotLanguageModels,
  buildModelCatalogJson,
  buildZcodeConfig,
  buildLitellmConfig,
  buildOpencodeConfig,
  buildCrushConfig,
  buildChatboxProviderConfig,
  buildCherryStudioProvider,
  buildZedSettings,
  buildCliproxyapiConfig,
  CODEX_MODEL_INSTRUCTIONS,
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
        shell_type: "unified_exec",
        priority: 10,
        truncation_policy: { mode: "tokens", limit: 10000 },
        default_reasoning_level: "low",
        supported_reasoning_levels: [
          { effort: "low", description: "Fast responses with lighter reasoning" },
          { effort: "high", description: "Greater reasoning depth for complex problems" }
        ],
        support_verbosity: false,
        experimental_supported_tools: [],
        model_messages: { instructions_template: CODEX_MODEL_INSTRUCTIONS }
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
        description: "Free",
        context_window: 0,
        max_context_window: 0,
        input_modalities: ["text"],
        supported_in_api: true,
        visibility: "list",
        shell_type: "unified_exec",
        priority: 10,
        truncation_policy: { mode: "tokens", limit: 10000 },
        default_reasoning_level: "medium",
        supported_reasoning_levels: [
          {
            effort: "medium",
            description: "Balances speed and reasoning depth for everyday tasks"
          }
        ],
        support_verbosity: false,
        experimental_supported_tools: [],
        model_messages: { instructions_template: CODEX_MODEL_INSTRUCTIONS }
      }
    ]
  })
})

test("drops reasoning efforts outside Codex's enum and keeps the default inside it", () => {
  const exotic = {
    ...model,
    reasoning: {
      mandatory: false,
      supported_efforts: ["disable", "high"],
      default_effort: "disable"
    }
  } as unknown as ExportableModel
  const catalog = buildModelCatalogJson([exotic])
  const entry = catalog.models[0]!
  expect(entry.supported_reasoning_levels).toEqual([
    { effort: "high", description: "Greater reasoning depth for complex problems" }
  ])
  expect(entry.default_reasoning_level).toBe("high")
})

test("filters input modalities to Codex's closed InputModality enum", () => {
  const exotic = {
    ...model,
    architecture: {
      input_modalities: ["text", "image", "audio", "video", "file", "image"],
      output_modalities: ["text"]
    }
  } as unknown as ExportableModel
  const entry = buildModelCatalogJson([exotic]).models[0]!
  expect(entry.input_modalities).toEqual(["text", "image", "audio"])
})

test("builds a Codex config.toml snippet wired to the Nous provider", () => {
  const toml = buildCodexConfigToml([model])
  expect(toml).toContain('model_provider = "nous"')
  expect(toml).toContain('model = "qwen/qwen3-coder"')
  expect(toml).toContain('base_url = "https://inference-api.nousresearch.com/v1"')
  expect(toml).toContain('env_key = "NOUS_API_KEY"')
  expect(toml).toContain('wire_api = "responses"')
  // top-level keys must precede table headers in TOML
  expect(toml.indexOf("model_catalog_json")).toBeLessThan(toml.indexOf("[model_providers.nous]"))
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
      provider: "nous",
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

test("builds a DeepSeek Harness llm-pi-ai provider config", () => {
  expect(buildDshProviderConfig([model])).toEqual({
    "llm-pi-ai": {
      providers: {
        nous: {
          displayName: "nous",
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

test("renames the API's none effort to the off thinking level in the DeepSeek Harness export", () => {
  const entry = buildDshProviderConfig([
    {
      ...model,
      reasoning: { mandatory: false, supported_efforts: ["none", "low", "high"] }
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry.reasoningEfforts).toEqual({ off: "none", low: "low", high: "high" })
})

test("drops effort names pi-ai has no thinking level for in the DeepSeek Harness export", () => {
  const entry = buildDshProviderConfig([
    {
      ...model,
      reasoning: { mandatory: false, supported_efforts: ["none", "medium", "turbo"] }
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry.reasoningEfforts).toEqual({ off: "none", medium: "medium" })
})

test("marks a DeepSeek Harness model that only offers none as non-reasoning", () => {
  const entry = buildDshProviderConfig([
    {
      ...model,
      reasoning: { mandatory: false, supported_efforts: ["none"] }
    } as unknown as ExportableModel
  ])["llm-pi-ai"].providers.nous!.models[0]!
  expect(entry.reasoningEfforts).toBe(false)
})

test("serializes the DeepSeek Harness export as parseable YAML", () => {
  const config = buildDshProviderConfig([model])
  expect(parse(stringify(config))).toEqual(config)
})

const imageModel = {
  id: "glm-4.5v",
  name: "GLM 4.5V",
  description: "A vision model",
  context_length: 65536,
  architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
  supported_parameters: ["tools"],
  top_provider: { context_length: 65536 }
} as unknown as ExportableModel

const pricedModel = {
  ...model,
  pricing: { prompt: "0.000001", completion: "0.000003", input_cache_read: "0.0000001" }
} as unknown as ExportableModel

test("builds LiteLLM proxy model_list entries", () => {
  expect(buildLitellmConfig([model])).toEqual([
    {
      model_name: "nous/qwen/qwen3-coder",
      litellm_params: {
        model: "openai/qwen/qwen3-coder",
        api_base: "https://inference-api.nousresearch.com/v1",
        api_key: "os.environ/NOUS_API_KEY"
      }
    }
  ])
})

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

test("builds a Crush provider with the schema-required cost fields", () => {
  expect(buildCrushConfig([pricedModel])).toEqual({
    $schema: "https://charm.land/crush.json",
    providers: {
      nous: {
        id: "nous",
        name: "nous",
        type: "openai",
        base_url: "https://inference-api.nousresearch.com/v1",
        api_key: "$NOUS_API_KEY",
        models: [
          {
            id: "qwen/qwen3-coder",
            name: "Qwen3 Coder",
            context_window: 131072,
            default_max_tokens: 16384,
            cost_per_1m_in: 1,
            cost_per_1m_out: 3,
            cost_per_1m_in_cached: 0.1,
            cost_per_1m_out_cached: 0,
            can_reason: true,
            supports_attachments: false
          }
        ]
      }
    }
  })
})

test("zeroes Crush cost fields for unpriced models and flags image support", () => {
  const entry = buildCrushConfig([imageModel]).providers.nous?.models[0]
  expect(entry).toMatchObject({
    id: "glm-4.5v",
    context_window: 65536,
    default_max_tokens: 8192,
    cost_per_1m_in: 0,
    cost_per_1m_out: 0,
    cost_per_1m_in_cached: 0,
    cost_per_1m_out_cached: 0,
    can_reason: false,
    supports_attachments: true
  })
})

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

test("serializes the LiteLLM export as parseable YAML", () => {
  const config = buildLitellmConfig([model])
  expect(parse(stringify(config))).toEqual(config)
})

test("builds a CLIProxyAPI openai-compatibility config fragment", () => {
  expect(buildCliproxyapiConfig([model])).toEqual({
    "openai-compatibility": [
      {
        name: "nous",
        "base-url": "https://inference-api.nousresearch.com/v1",
        "api-key-entries": [{ "api-key": "YOUR_NOUS_API_KEY" }],
        headers: {
          "User-Agent": "HermesAgent/0.21.3",
          Authorization: "Bearer YOUR_NOUS_API_KEY"
        },
        models: [
          {
            name: "qwen/qwen3-coder",
            alias: "",
            "display-name": "Qwen3 Coder",
            "max-context-length": 131072,
            "input-modalities": ["text"],
            thinking: { levels: ["low", "high"] }
          }
        ]
      }
    ]
  })
})

test("filters CLIProxyAPI modalities to the text/image vocabulary", () => {
  const entry = buildCliproxyapiConfig([
    {
      ...model,
      architecture: {
        input_modalities: ["text", "image", "video", "file", "image"],
        output_modalities: ["text"]
      }
    } as unknown as ExportableModel
  ])["openai-compatibility"][0]!.models[0]!
  expect(entry["input-modalities"]).toEqual(["text", "image"])
  expect(entry).not.toHaveProperty("output-modalities")
})

test("declares image output for CLIProxyAPI models that produce images", () => {
  const entry = buildCliproxyapiConfig([
    {
      ...model,
      architecture: { input_modalities: ["text"], output_modalities: ["image", "text"] }
    } as unknown as ExportableModel
  ])["openai-compatibility"][0]!.models[0]!
  expect(entry["output-modalities"]).toEqual(["image", "text"])
})

test("omits context length and thinking for CLIProxyAPI models without them", () => {
  const entry = buildCliproxyapiConfig([
    {
      id: "free/model",
      name: "Free",
      context_length: 0,
      supported_parameters: []
    } as unknown as ExportableModel
  ])["openai-compatibility"][0]!.models[0]!
  expect(entry).toEqual({
    name: "free/model",
    alias: "",
    "display-name": "Free",
    "input-modalities": ["text"]
  })
})

test("drops thinking levels CLIProxyAPI does not know", () => {
  const known = buildCliproxyapiConfig([
    {
      ...model,
      reasoning: { mandatory: false, supported_efforts: ["turbo", "xhigh", "high"] }
    } as unknown as ExportableModel
  ])["openai-compatibility"][0]!.models[0]!
  expect(known.thinking).toEqual({ levels: ["xhigh", "high"] })

  const unknownOnly = buildCliproxyapiConfig([
    {
      ...model,
      reasoning: { mandatory: false, supported_efforts: ["turbo"] }
    } as unknown as ExportableModel
  ])["openai-compatibility"][0]!.models[0]!
  expect(unknownOnly).not.toHaveProperty("thinking")
})

test("serializes the CLIProxyAPI export as parseable YAML", () => {
  const config = buildCliproxyapiConfig([model, imageModel])
  expect(parse(stringify(config))).toEqual(config)
})
