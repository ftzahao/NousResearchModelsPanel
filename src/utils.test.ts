import { test, expect } from "bun:test"
import { missingFavorites, reorderFavorites, sortByFavorites, modelParamsLines, formatParamsForCopy } from "./utils"
import type { Model } from "./types"

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id: "nous/test-model",
    name: "Test Model",
    created: 1700000000,
    description: "",
    context_length: 200000,
    architecture: { modality: "text->text", input_modalities: ["text"], output_modalities: ["text"], tokenizer: "t" },
    pricing: { prompt: "0.000002", completion: "0.000008" },
    top_provider: { context_length: 262144, max_completion_tokens: 65536, is_moderated: false },
    supported_parameters: ["temperature"],
    benchmarks: { artificial_analysis: { intelligence_index: 52 } },
    ...overrides
  } as Model
}

test("moves dragged id before target id", () => {
  expect(reorderFavorites(["a", "b", "c", "d"], "d", "b", "before")).toEqual([
    "a",
    "d",
    "b",
    "c"
  ])
})

test("moves dragged id after target id", () => {
  expect(reorderFavorites(["a", "b", "c", "d"], "a", "c", "after")).toEqual([
    "b",
    "c",
    "a",
    "d"
  ])
})

test("dragging forward onto the next item places it after the target", () => {
  // index math pitfall: removing "b" shifts "c" down before insertion
  expect(reorderFavorites(["a", "b", "c"], "b", "c", "after")).toEqual(["a", "c", "b"])
})

test("dragging backward onto the previous item places it before the target", () => {
  expect(reorderFavorites(["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"])
})

test("returns order unchanged when ids are unknown", () => {
  expect(reorderFavorites(["a", "b"], "x", "b", "before")).toEqual(["a", "b"])
  expect(reorderFavorites(["a", "b"], "a", "y", "after")).toEqual(["a", "b"])
})

test("does not mutate the input array", () => {
  const input = ["a", "b", "c"]
  reorderFavorites(input, "c", "a", "before")
  expect(input).toEqual(["a", "b", "c"])
})

test("orders items by favorites drag order with non-favorites last", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }]
  // drag order: c first, then a
  const favorites = new Set(["c", "a"])
  expect(sortByFavorites(items, favorites).map((m) => m.id)).toEqual(["c", "a", "b"])
})

test("keeps non-favorites in their original relative order", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]
  const favorites = new Set(["c"])
  expect(sortByFavorites(items, favorites).map((m) => m.id)).toEqual(["c", "a", "b", "d"])
})

test("returns original order when favorites is empty", () => {
  const items = [{ id: "a" }, { id: "b" }]
  expect(sortByFavorites(items, new Set())).toEqual(items)
})

test("lists favorite ids that are absent from the model list, in favorites order", () => {
  const items = [{ id: "a" }, { id: "b" }]
  const favorites = new Set(["gone", "b", "also-gone", "a"])
  expect(missingFavorites(favorites, items)).toEqual(["gone", "also-gone"])
})

test("returns no missing favorites when every favorite is still listed", () => {
  const items = [{ id: "a" }, { id: "b" }]
  expect(missingFavorites(new Set(["b", "a"]), items)).toEqual([])
})

test("returns no missing favorites when the favorites set is empty", () => {
  expect(missingFavorites(new Set(), [{ id: "a" }])).toEqual([])
})

test("builds zh param lines with provider context override and intelligence", () => {
  const lines = modelParamsLines(makeModel(), "zh")
  expect(lines).toEqual([
    { label: "上下文", value: "200K (262.1K)" },
    { label: "最大输出", value: "65.5K" },
    { label: "输入", value: "$2/1M" },
    { label: "输出", value: "$8/1M" },
    { label: "智能指数", value: "52" }
  ])
})

test("builds en param lines without optional fields", () => {
  const lines = modelParamsLines(
    makeModel({ top_provider: undefined as never, benchmarks: undefined }),
    "en"
  )
  expect(lines).toEqual([
    { label: "Context", value: "200K" },
    { label: "Prompt", value: "$2/1M" },
    { label: "Complete", value: "$8/1M" }
  ])
})

test("free prices show the localized free label", () => {
  const free = makeModel({ pricing: { prompt: "0", completion: "0" } })
  expect(modelParamsLines(free, "zh")[2]!.value).toBe("免费")
  expect(modelParamsLines(free, "en")[2]!.value).toBe("Free")
})

test("formats copy payload as id plus label: value lines", () => {
  const lines = modelParamsLines(makeModel(), "zh")
  const out = formatParamsForCopy(lines, "nous/test-model")
  expect(out.split("\n")[0]).toBe("nous/test-model")
  expect(out).toContain("上下文: 200K (262.1K)")
  expect(out).toContain("输入: $2/1M")
})
