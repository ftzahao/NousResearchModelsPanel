import { expect, test } from "bun:test"
import { exporterRegistry, serializeExport } from "./index"

test("exporter registry preserves the current exporter IDs and order", () => {
  expect(exporterRegistry.map((exporter) => exporter.id)).toEqual([
    "codex",
    "codex-osaurus",
    "github-copilot-gcmp",
    "github-copilot-language-models",
    "zcode",
    "deepseek-harness",
    "deepseek-harness-desktop",
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
  expect(codex?.fileName).toBe("config.toml")
  expect(codex?.format).toBe("toml")
  expect(codex?.extraFiles).toHaveLength(1)
  expect(codex?.extraFiles?.[0]?.fileName).toBe("models.json")
  expect(codex?.extraFiles?.[0]?.format).toBeUndefined()
})

test("Codex Osaurus variant ships a proxy config plus a nous-prefixed catalog", () => {
  const proxy = exporterRegistry.find((exporter) => exporter.id === "codex-osaurus")

  expect(proxy).toBeDefined()
  expect(proxy?.fileName).toBe("config.toml")
  expect(proxy?.format).toBe("toml")
  expect(proxy?.extraFiles).toHaveLength(1)
  expect(proxy?.extraFiles?.[0]?.fileName).toBe("models.json")
  expect(proxy?.extraFiles?.[0]?.format).toBeUndefined()
})

test("Chatbox remains a single-file exporter", () => {
  const chatbox = exporterRegistry.find((exporter) => exporter.id === "chatbox")

  expect(chatbox?.fileName).toBe("chatbox-nous-provider.json")
  expect(chatbox?.extraFiles).toBeUndefined()
})

test("DeepSeek Harness desktop ships a YAML cordis patch next to the settings.yaml export", () => {
  const desktop = exporterRegistry.find((exporter) => exporter.id === "deepseek-harness-desktop")

  expect(desktop?.fileName).toBe("dsh-desktop-cordis-patch.yml")
  expect(desktop?.format).toBe("yaml")
  expect(desktop?.extraFiles).toBeUndefined()
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
