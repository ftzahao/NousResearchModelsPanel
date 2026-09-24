import { expect, test } from "bun:test"
import { exporterRegistry, serializeExport } from "./index"

test("exporter registry preserves the current exporter IDs and order", () => {
  expect(exporterRegistry.map((exporter) => exporter.id)).toEqual([
    "codex",
    "github-copilot-gcmp",
    "github-copilot-language-models",
    "zcode",
    "deepseek-harness",
    "litellm",
    "cliproxyapi",
    "opencode",
    "crush",
    "chatbox",
    "cherry-studio",
    "zed",
    "mimocode"
  ])
})

test("Codex retains its TOML config and extra models catalog output", () => {
  const codex = exporterRegistry.find((exporter) => exporter.id === "codex")

  expect(codex).toBeDefined()
  expect(codex?.fileName).toBe("codex-config.toml")
  expect(codex?.format).toBe("toml")
  expect(codex?.extraFiles).toHaveLength(1)
  expect(codex?.extraFiles?.[0]?.fileName).toBe("models.json")
  expect(codex?.extraFiles?.[0]?.format).toBeUndefined()
})

test("Chatbox remains a single-file exporter", () => {
  const chatbox = exporterRegistry.find((exporter) => exporter.id === "chatbox")

  expect(chatbox?.fileName).toBe("chatbox-nous-provider.json")
  expect(chatbox?.extraFiles).toBeUndefined()
})

test("serializeExport preserves JSON, YAML, and TOML output behavior", () => {
  const payload = { name: "Nous", enabled: true, models: ["a", "b"] }

  expect(serializeExport(payload)).toBe(
    '{\n  "name": "Nous",\n  "enabled": true,\n  "models": [\n    "a",\n    "b"\n  ]\n}'
  )
  expect(serializeExport(payload, "yaml")).toBe(
    "name: Nous\nenabled: true\nmodels:\n  - a\n  - b\n"
  )
  expect(serializeExport(payload, "toml")).toBe("[object Object]")
})
