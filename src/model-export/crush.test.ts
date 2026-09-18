import { expect, test } from "bun:test"
import { buildCrushConfig } from "./crush"
import { imageModel, pricedModel } from "./test-fixtures"

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
