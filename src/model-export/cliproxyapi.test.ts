import { expect, test } from "bun:test"
import { parse, stringify } from "yaml"
import { buildCliproxyapiConfig } from "./cliproxyapi"
import { imageModel, model } from "./test-fixtures"
import type { ExportableModel } from "./shared"

test("builds a CLIProxyAPI openai-compatibility config fragment", () => {
  expect(buildCliproxyapiConfig([model])).toEqual({
    "openai-compatibility": [
      {
        name: "nous",
        "base-url": "https://inference-api.nousresearch.com/v1",
        "api-key-entries": [{ "api-key": "YOUR_NOUS_API_KEY" }],
        headers: {
          "User-Agent": "HermesAgent/0.21.4",
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
