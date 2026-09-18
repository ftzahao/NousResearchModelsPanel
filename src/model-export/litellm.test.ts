import { expect, test } from "bun:test"
import { parse, stringify } from "yaml"
import { buildLitellmConfig } from "./litellm"
import { model } from "./test-fixtures"

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

test("serializes the LiteLLM export as parseable YAML", () => {
  const config = buildLitellmConfig([model])
  expect(parse(stringify(config))).toEqual(config)
})
