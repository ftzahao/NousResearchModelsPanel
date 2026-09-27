import { expect, test } from "bun:test"
import {
  buildCodexOsaurusConfigToml,
  buildCodexOsaurusModelCatalogJson,
  osaurusModelId,
  OSAURUS_BASE_URL
} from "./codex-osaurus"
import { buildModelCatalogJson } from "./codex"
import { model } from "./test-fixtures"
import type { ExportableModel } from "./shared"

test("builds a Codex config.toml snippet routed through the local Osaurus proxy", () => {
  const toml = buildCodexOsaurusConfigToml([model])
  expect(toml).toContain('model_provider = "osaurus"')
  expect(toml).toContain(`base_url = "${OSAURUS_BASE_URL}"`)
  expect(toml).toContain('base_url = "http://127.0.0.1:1337/v1"')
  expect(toml).toContain('wire_api = "responses"')
  expect(toml).toContain("stream_idle_timeout_ms = 600000")
  // the upstream key lives in Osaurus's Keychain, so no active env_key is emitted
  expect(toml).not.toContain('env_key = "NOUS_API_KEY"')
  expect(toml).toContain("# env_key = \"OSAURUS_API_KEY\"")
  // top-level keys must precede table headers in TOML
  expect(toml.indexOf("model_catalog_json")).toBeLessThan(
    toml.indexOf("[model_providers.osaurus]")
  )
  // system-proxy feature flag: singular key, placed before the provider table
  expect(toml).toContain("[features]")
  expect(toml).toContain("respect_system_proxy = true")
  expect(toml).not.toContain("respect_system_proxies =")
  expect(toml.indexOf("[features]")).toBeLessThan(toml.indexOf("[model_providers.osaurus]"))
})

test("addresses models as nous/<model-id> through the nous-named provider", () => {
  expect(osaurusModelId("xiaomi/mimo-v2.6-flash")).toBe("nous/xiaomi/mimo-v2.6-flash")
  // already-prefixed ids stay untouched
  expect(osaurusModelId("nous/xiaomi/mimo-v2.6-flash")).toBe("nous/xiaomi/mimo-v2.6-flash")

  expect(buildCodexOsaurusConfigToml([model])).toContain('model = "nous/qwen/qwen3-coder"')
  expect(buildCodexOsaurusConfigToml([model])).not.toContain('model = "qwen/qwen3-coder"')
})

test("prefixes catalog slugs the same way so /model switches match", () => {
  const catalog = buildCodexOsaurusModelCatalogJson([model])
  expect(catalog.models[0]!.slug).toBe("nous/qwen/qwen3-coder")
  expect(catalog.models[0]!.display_name).toBe("Qwen3 Coder")
  // every other field is identical to the direct Codex catalog
  const direct = buildModelCatalogJson([model])
  expect(catalog.models[0]).toEqual({ ...direct.models[0]!, slug: "nous/qwen/qwen3-coder" })
})

test("sets model_reasoning_effort from the first model's effective default", () => {
  expect(buildCodexOsaurusConfigToml([model])).toContain('model_reasoning_effort = "low"')
  const high = {
    ...model,
    reasoning: { mandatory: false, supported_efforts: ["max", "high"], default_effort: "max" }
  } as unknown as ExportableModel
  // "max" is outside the official enum, so the effective default degrades to "high"
  expect(buildCodexOsaurusConfigToml([high])).toContain('model_reasoning_effort = "high"')
})
