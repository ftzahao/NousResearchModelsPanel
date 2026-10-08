import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { exporterRegistry } from "../src/model-export"
import {
  hasJsonComments,
  spliceJsonPath,
  spliceToml,
  spliceYamlKey,
  spliceYamlRootArray,
} from "./merge-splice"
import {
  type FileOutcome,
  type RunOptions,
  KNOWN_NAMES,
  detectExport,
  fillApiKey,
  fmt,
  normalizeName,
  preserveSecrets,
  runMerge,
} from "./merge"

// keep default-target resolution deterministic regardless of the host env
delete process.env.XDG_CONFIG_HOME
delete process.env.DSH_PROFILE

const tmp = (): string => mkdtempSync(join(tmpdir(), "merge-test-"))
const put = async (path: string, content: string): Promise<string> => {
  await Bun.write(path, content)
  return path
}
const read = (path: string): Promise<string> => Bun.file(path).text()
const exists = (path: string): Promise<boolean> => Bun.file(path).exists()

/** Every test merges exactly one input; assert that and return its outcome. */
const merge1 = async (file: string, opts: RunOptions): Promise<FileOutcome> => {
  const out = await runMerge([file], opts)
  expect(out).toHaveLength(1)
  return out[0]!
}

// ---------------------------------------------------------------------------
// text splicing: JSON / JSONC
// ---------------------------------------------------------------------------

describe("spliceJsonPath", () => {
  test("replaces a nested value while keeping comments and siblings", async () => {
    const text = `{\n  // header comment\n  "provider": {\n    "nous": {"name": "old"}\n  },\n  "other": 1\n}`
    const merged = { provider: { nous: { name: "new" } }, other: 1 }
    const out = spliceJsonPath(text, ["provider", "nous"], merged, "  ")
    expect(out.action).toBe("replace")
    expect(out.text).toContain("// header comment")
    expect(out.text).toContain('"other": 1')
    const parsed = Bun.JSONC.parse(out.text) as Record<string, unknown>
    expect((parsed.provider as Record<string, unknown>).nous).toEqual({ name: "new" })
  })

  test("inserts a missing nested key with correct commas", async () => {
    const text = `{\n  "a": {\n    "b": 1\n  }\n}`
    const merged = { a: { b: 1, c: { d: 2 } } }
    const out = spliceJsonPath(text, ["a", "c"], merged, "  ")
    expect(out.action).toBe("insert")
    expect(Bun.JSONC.parse(out.text)).toEqual({ a: { b: 1, c: { d: 2 } } })
  })

  test("inserts into an empty root object", async () => {
    const merged = { provider: { nous: { name: "x" } } }
    const out = spliceJsonPath("{}", ["provider"], merged, "  ")
    expect(out.action).toBe("insert")
    expect(Bun.JSONC.parse(out.text)).toEqual(merged)
  })

  test("skips when the value already matches (idempotent)", () => {
    const text = `{\n  "provider": {\n    "nous": {"name": "same"}\n  }\n}`
    const merged = { provider: { nous: { name: "same" } } }
    const out = spliceJsonPath(text, ["provider", "nous"], merged, "  ")
    expect(out.action).toBe("skip")
    expect(out.text).toBe(text)
  })

  test("detects comments outside strings only", () => {
    expect(hasJsonComments('{"u": "https://example.com/x"}')).toBe(false)
    expect(hasJsonComments('{\n  // note\n  "a": 1\n}')).toBe(true)
    expect(hasJsonComments('{\n  "a": 1 /* note */\n}')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// text splicing: YAML
// ---------------------------------------------------------------------------

describe("spliceYamlKey", () => {
  test("replaces one top-level block, keeping surrounding comments", () => {
    const text = "# head\nkey: old\n# between\nother: 1\n"
    const target = { key: "old", other: 1 }
    const merged = { key: "new", other: 1 }
    const out = spliceYamlKey(text, "key", target, merged)
    expect(out.action).toBe("replace")
    expect(out.text).toBe("# head\nkey: new\n# between\nother: 1\n")
  })

  test("appends the key when it is missing", () => {
    const out = spliceYamlKey("other: 1\n", "key", { other: 1 }, { other: 1, key: "x" })
    expect(out.action).toBe("append")
    expect(out.text).toContain("other: 1")
    expect(Bun.YAML.parse(out.text)).toEqual({ other: 1, key: "x" })
  })

  test("skips when the value already matches", () => {
    const text = "key: same\n"
    const out = spliceYamlKey(text, "key", { key: "same" }, { key: "same" })
    expect(out.action).toBe("skip")
    expect(out.text).toBe(text)
  })

  test("rewrites when the key exists but cannot be located line-wise", () => {
    const text = "{key: old, other: 1}\n"
    const out = spliceYamlKey(text, "key", { key: "old", other: 1 }, { key: "new", other: 1 })
    expect(out.action).toBe("rewrite")
    expect(Bun.YAML.parse(out.text)).toEqual({ key: "new", other: 1 })
  })
})

describe("spliceYamlRootArray", () => {
  test("keeps header comments above the sequence", () => {
    const text = "# header one\n# header two\n- id: a\n  v: 1\n- id: b\n"
    const target = [
      { id: "a", v: 1 },
      { id: "b" },
    ]
    const merged = [
      { id: "a", v: 9 },
      { id: "c" },
    ]
    const out = spliceYamlRootArray(text, target, merged)
    expect(out.action).toBe("replace")
    expect(out.text.startsWith("# header one\n# header two\n- id: a")).toBe(true)
    expect(Bun.YAML.parse(out.text)).toEqual(merged)
  })

  test("skips when unchanged", () => {
    const text = "- id: a\n"
    const arr = [{ id: "a" }]
    const out = spliceYamlRootArray(text, arr, arr)
    expect(out.action).toBe("skip")
    expect(out.text).toBe(text)
  })
})

// ---------------------------------------------------------------------------
// text splicing: TOML
// ---------------------------------------------------------------------------

describe("spliceToml", () => {
  const text = '# head\nmodel = "old"\nother = 1\n\n[features]\nx = true\n\n[models]\nid = 1\n'
  const targetParsed = Bun.TOML.parse(text) as Record<string, unknown>

  test("replaces, inserts and merges tables in one pass", () => {
    const ops = [
      { kind: "scalar", key: "model", value: "new" },
      { kind: "scalar", key: "added", value: "z" },
      { kind: "table", key: "features", value: { x: true, y: true } },
    ] as const
    const merged = {
      ...targetParsed,
      model: "new",
      added: "z",
      features: { x: true, y: true },
    }
    const out = spliceToml(text, targetParsed, ops, merged)
    expect(out.action).toBe("replace")
    const parsed = Bun.TOML.parse(out.text) as Record<string, unknown>
    expect(parsed).toEqual(merged)
    // everything outside the touched regions survives byte-for-byte
    expect(out.text).toContain("# head")
    expect(out.text).toContain("[models]\nid = 1")
    expect(out.changes).toContain("model")
    expect(out.changes).toContain("added")
    expect(out.changes).toContain("[features]")
  })

  test("deletes a scalar when the value is undefined", () => {
    const withKey = 'model = "x"\nkeep = 1\n'
    const parsedTarget = Bun.TOML.parse(withKey) as Record<string, unknown>
    const merged = { keep: 1 }
    const out = spliceToml(withKey, parsedTarget, [{ kind: "scalar", key: "model", value: undefined }], merged)
    expect(Bun.TOML.parse(out.text)).toEqual(merged)
    expect(out.changes).toEqual(["model"])
  })

  test("skips ops whose value already matches", () => {
    const ops = [{ kind: "scalar", key: "model", value: "old" }] as const
    const out = spliceToml(text, targetParsed, ops, targetParsed)
    expect(out.action).toBe("skip")
    expect(out.text).toBe(text)
  })

  test("appends a missing table at the end of the file", () => {
    const ops = [
      { kind: "table", key: "model_providers.nous", value: { name: "Nous", wire_api: "responses" } },
    ] as const
    const merged = {
      ...targetParsed,
      model_providers: { nous: { name: "Nous", wire_api: "responses" } },
    }
    const out = spliceToml(text, targetParsed, ops, merged)
    const parsed = Bun.TOML.parse(out.text) as Record<string, unknown>
    expect(parsed).toEqual(merged)
    expect(out.text).toContain("# head")
  })
})

// ---------------------------------------------------------------------------
// detection
// ---------------------------------------------------------------------------

describe("detectExport", () => {
  const cases: Array<[string, string, string]> = [
    [
      "config.toml",
      'model_provider = "nous"\nmodel_catalog_json = "/tmp/nous-models.json"\n',
      "codex",
    ],
    ["models.json", '{"models":[{"slug":"m","truncation_policy":{"mode":"tokens"}}]}', "codex-models"],
    [
      "zcode-provider-config.json",
      '{"schemaVersion":1,"config":{"providerConfigRules":{}}}',
      "zcode",
    ],
    ["dsh-llm-pi-ai.yaml", 'llm-pi-ai:\n  providers:\n    nous: {}\n', "dsh-settings"],
    [
      "dsh-desktop-cordis-patch.yml",
      '- id: llm-pi-ai\n  name: "@deepseek-ai/dsh-llm-pi-ai"\n  config: {}\n',
      "dsh-patch",
    ],
    [
      "litellm-config.yaml",
      "- model_name: nous/a\n  litellm_params:\n    model: openai/a\n",
      "litellm",
    ],
    ["cliproxyapi-config.yaml", "openai-compatibility:\n  - name: nous\n", "cliproxyapi"],
    [
      "opencode.json",
      '{"$schema":"https://opencode.ai/config.json","provider":{"nous":{"npm":"@ai-sdk/openai-compatible"}}}',
      "opencode",
    ],
    ["crush.json", '{"$schema":"https://charm.land/crush.json","providers":{"nous":{"type":"openai"}}}', "crush"],
    [
      "mimocode.jsonc",
      '{"$schema":"https://mimo.xiaomi.com/mimocode/config.json","provider":{"nous":{}}}',
      "mimocode",
    ],
    ["zed-language-models.json", '{"language_models":{"openai_compatible":{"nous":{}}}}', "zed"],
    ["cherry-studio-nous.json", '{"type":"openai","apiHost":"https://h","models":[],"isSystem":false}', "cherry-studio"],
    [
      "chatbox-nous-provider.json",
      '{"type":"openai","iconUrl":"x","settings":{"apiHost":"https://h"}}',
      "chatbox",
    ],
    ["gcmp-compatible-models.json", '[{"id":"m","provider":"nous","baseUrl":"https://x","sdkMode":"openai","limit":{"rpm":1}}]', "gcmp"],
    ["chatLanguageModels.json", '[{"name":"nous","vendor":"customendpoint","models":[]}]', "copilot-lm"],
  ]

  for (const [fileName, text, ruleId] of cases) {
    test(`detects ${ruleId} from ${fileName}`, () => {
      const det = detectExport(fileName, text, "loose")
      expect(det?.ruleId).toBe(ruleId)
    })
  }

  test("mimocode wins over opencode even when misnamed", () => {
    const text = '{"$schema":"https://mimo.xiaomi.com/mimocode/config.json","provider":{"nous":{"npm":"@ai-sdk/openai-compatible","models":{"a":{"modalities":{}}}}}}'
    expect(detectExport("opencode.json", text, "strict")?.ruleId).toBe("mimocode")
  })

  test("content wins over the file name for renamed files", () => {
    const text = '{"language_models":{"openai_compatible":{"nous":{}}}}'
    expect(detectExport("my-export.json", text, "strict")?.ruleId).toBe("zed")
  })

  test("generic file names are never matched by name alone", () => {
    expect(detectExport("config.toml", "some_key = 1\n", "loose")).toBeNull()
    expect(detectExport("models.json", '{"hello": 1}', "loose")).toBeNull()
  })

  test("strict mode rejects an unmatched file name", () => {
    expect(detectExport("zed-language-models.json", "{}", "strict")).toBeNull()
    // …while loose mode falls back to the distinctive name
    expect(detectExport("zed-language-models.json", "{}", "loose")?.ruleId).toBe("zed")
  })

  test("strips browser duplicate-download suffixes", () => {
    expect(normalizeName("config (1).toml")).toBe("config.toml")
    expect(normalizeName("zed-language-models (2).json")).toBe("zed-language-models.json")
    expect(normalizeName("opencode.json")).toBe("opencode.json")
  })
})

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

test("preserveSecrets keeps literal keys from the target", () => {
  const exported = {
    apiKey: "${input:nousApiKey}",
    headers: { Authorization: "Bearer YOUR_NOUS_API_KEY" },
    baseURL: "https://new.example",
  }
  const target = { apiKey: "sk-real", headers: { Authorization: "Bearer sk-real-2" }, baseURL: "https://old.example" }
  preserveSecrets(exported, target)
  expect(exported.apiKey).toBe("sk-real")
  expect(exported.headers.Authorization).toBe("Bearer sk-real-2")
  expect(exported.baseURL).toBe("https://new.example") // non-secrets always come from the export
})

test("fillApiKey replaces placeholders but leaves env references alone", () => {
  const value = {
    "api-key": "YOUR_NOUS_API_KEY",
    access: { apiKey: "${input:nousApiKey}" },
    options: { apiKey: "" },
    env: { apiKey: "{env:NOUS_API_KEY}" },
  }
  fillApiKey(value, "sk-cli-1")
  expect(value["api-key"]).toBe("sk-cli-1")
  expect(value.access.apiKey).toBe("sk-cli-1")
  expect(value.options.apiKey).toBe("sk-cli-1")
  expect(value.env.apiKey).toBe("{env:NOUS_API_KEY}")
})

test("fmt substitutes %s placeholders", () => {
  expect(fmt("a %s b %s", "1", "2")).toBe("a 1 b 2")
  expect(fmt("nothing")).toBe("nothing")
})

test("every dashboard export file name is handled by a merge rule", () => {
  const registryNames = exporterRegistry.flatMap((e) => [
    e.fileName,
    ...(e.extraFiles ?? []).map((x) => x.fileName),
  ])
  for (const name of registryNames) expect(KNOWN_NAMES).toContain(name)
})

// ---------------------------------------------------------------------------
// end to end: runMerge against temporary homes
// ---------------------------------------------------------------------------

const OPENCODE_EXPORT = {
  $schema: "https://opencode.ai/config.json",
  provider: {
    nous: {
      npm: "@ai-sdk/openai-compatible",
      name: "nous",
      options: { baseURL: "https://inference-api.nousresearch.com/v1", apiKey: "{env:NOUS_API_KEY}" },
      models: { "xiaomi/mimo-v2.6-flash": { name: "MiMo", limit: { context: 1024, output: 128 } } },
    },
  },
}

describe("runMerge end to end", () => {
  test("opencode: merges into an existing config, keeps comments, backs up, is idempotent", async () => {
    const home = tmp()
    const cwd = tmp()
    const exportFile = await put(join(home, "opencode.json"), JSON.stringify(OPENCODE_EXPORT, null, 2))
    const target = join(home, ".config", "opencode", "opencode.json")
    await put(
      target,
      `{
  // my own comment
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": { "npm": "@ai-sdk/anthropic", "name": "anthropic" },
    "nous": { "npm": "@ai-sdk/openai-compatible", "name": "stale-entry" }
  }
}`,
    )

    const first = await merge1(exportFile, { home, cwd })
    expect(first.status).toBe("merged")
    expect(first.target).toBe(target)
    expect(first.backupPath).toBe(`${target}.bak`)
    expect(await read(`${target}.bak`)).toContain("stale-entry")

    const text = await read(target)
    expect(text).toContain("// my own comment")
    const parsed = Bun.JSONC.parse(text) as Record<string, any>
    expect(parsed.provider.anthropic.name).toBe("anthropic")
    expect(parsed.provider.nous.name).toBe("nous")
    expect(parsed.provider.nous.models["xiaomi/mimo-v2.6-flash"].limit.context).toBe(1024)

    const second = await merge1(exportFile, { home, cwd })
    expect(second.status).toBe("unchanged")
    expect(second.written).toBe(false)
  })

  test("opencode: creates the config when the target is missing", async () => {
    const home = tmp()
    const exportFile = await put(join(home, "opencode.json"), JSON.stringify(OPENCODE_EXPORT))
    const outcome = await merge1(exportFile, { home, cwd: home })
    expect(outcome.status).toBe("created")
    expect(outcome.target).toBe(join(home, ".config", "opencode", "opencode.json"))
    expect(await exists(outcome.target!)).toBe(true)
    expect(Bun.JSONC.parse(await read(outcome.target!))).toEqual(OPENCODE_EXPORT)
  })

  test("zed: keeps the // header of an existing settings.json", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "zed-language-models.json"),
      JSON.stringify({
        language_models: {
          openai_compatible: {
            nous: { api_url: "https://inference-api.nousresearch.com/v1", available_models: [] },
          },
        },
      }),
    )
    const target = join(home, ".config", "zed", "settings.json")
    await put(
      target,
      `// Zed settings header\n{\n  "language_models": {\n    "openai_compatible": {\n      "nous": { "api_url": "https://old.example" }\n    }\n  },\n  "ui_font_size": 16\n}`,
    )
    const outcome = await merge1(exportFile, { home, cwd: home })
    expect(outcome.status).toBe("merged")
    const text = await read(target)
    expect(text).toContain("// Zed settings header")
    expect(text).toContain('"ui_font_size": 16')
    const parsed = Bun.JSONC.parse(text) as Record<string, any>
    expect(parsed.language_models.openai_compatible.nous.api_url).toBe(
      "https://inference-api.nousresearch.com/v1",
    )
  })

  test("cliproxyapi: splices one YAML block, keeps comments and the real API key", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "cliproxyapi-config.yaml"),
      `openai-compatibility:
  - name: nous
    base-url: https://inference-api.nousresearch.com/v1
    api-key-entries:
      - api-key: YOUR_NOUS_API_KEY
    headers:
      Authorization: Bearer YOUR_NOUS_API_KEY
    models:
      - name: xiaomi/mimo-v2.6-flash
        alias: ""
`,
    )
    const target = join(home, ".config", "cli-proxy-api", "config.yaml")
    await put(
      target,
      `# top comment
config-version: 8
# OpenAI 兼容提供商
openai-compatibility:
  - name: other
    base-url: https://other.example/v1
  - name: nous
    base-url: https://old.example/v1
    api-key-entries:
      - api-key: sk-real-123
vertex-api-key: []
`,
    )
    const outcome = await merge1(exportFile, { home, cwd: home })
    expect(outcome.status).toBe("merged")

    const text = await read(target)
    expect(text).toContain("# top comment")
    expect(text).toContain("# OpenAI 兼容提供商")
    expect(text).toContain("vertex-api-key: []")
    expect(text).toContain("other.example")
    expect(text).toContain("sk-real-123") // target's literal key survived
    expect(text).toContain("inference-api.nousresearch.com")
    const parsed = Bun.YAML.parse(text) as Record<string, any>
    const list = parsed["openai-compatibility"]
    expect(list).toHaveLength(2)
    expect(list.find((x: any) => x.name === "nous")["api-key-entries"][0]["api-key"]).toBe("sk-real-123")
    expect(outcome.notices?.some((n) => n.key === "commentsLost")).toBe(false)
  })

  test("cliproxyapi: requires --target when no candidate config exists", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "cliproxyapi-config.yaml"),
      "openai-compatibility:\n  - name: nous\n",
    )
    const outcome = await merge1(exportFile, { home, cwd: home })
    expect(outcome.status).toBe("failed")
    expect(outcome.message?.key).toBe("needTarget")
  })

  test("dsh patch: keeps header comments and other entries, replaces by id", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "dsh-desktop-cordis-patch.yml"),
      `- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      nous:
        displayName: nous
        apiKeyEnv: NOUS_API_KEY
        api: openai-completions
        baseURL: https://inference-api.nousresearch.com/v1
        models:
          - id: xiaomi/mimo-v2.6-flash
            name: MiMo
            contextWindow: 1048576
            maxTokens: 131072
`,
    )
    const target = join(home, ".dsh", "profiles", "desktop", "cordis.patch.yml")
    await put(
      target,
      `# Your patch layer for this dsh profile
# applied after every bundle layer
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: someone-else
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      oldprovider:
        displayName: keepme
`,
    )
    const outcome = await merge1(exportFile, { home, cwd: home })
    expect(outcome.status).toBe("merged")
    const text = await read(target)
    expect(text).toContain("# Your patch layer for this dsh profile")
    expect(text).toContain("dsh-agent-default-model")
    expect(text).not.toContain("keepme") // our entry is replaced wholesale
    const parsed = Bun.YAML.parse(text) as any[]
    expect(parsed).toHaveLength(2)
    expect(parsed[1].id).toBe("llm-pi-ai")
    expect(parsed[1].config.providers.nous.models[0].id).toBe("xiaomi/mimo-v2.6-flash")
  })

  test("codex: merges config.toml, adopts the sibling models.json, keeps other tables", async () => {
    const home = tmp()
    const exports = join(home, "exports")
    const exportFile = await put(
      join(exports, "config.toml"),
      `# Codex CLI config snippet for the Nous Research Inference API.
model_provider = "nous"
model = "xiaomi/mimo-v2.6-flash"
model_reasoning_effort = "medium"
model_catalog_json = "<PATH_TO_MODELS_JSON>"

[features]
respect_system_proxy = true

[model_providers.nous]
name = "Nous Research"
base_url = "https://inference-api.nousresearch.com/v1"
env_key = "NOUS_API_KEY"
wire_api = "responses"
`,
    )
    await put(
      join(exports, "models.json"),
      JSON.stringify({ models: [{ slug: "xiaomi/mimo-v2.6-flash", truncation_policy: { mode: "tokens" }, shell_type: "unified_exec" }] }),
    )
    const target = join(home, ".codex", "config.toml")
    await put(
      target,
      `# my codex header
model_provider = "openai"
model = "gpt-5"

# features comment
[features]
experimental = true

[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
`,
    )

    const outcomes = await runMerge([exportFile], { home, cwd: home })
    // config.toml plus the auto-discovered sibling models.json
    expect(outcomes).toHaveLength(2)
    const outcome = outcomes.find((o) => o.input.endsWith("config.toml"))!
    const catalogOutcome = outcomes.find((o) => o.input.endsWith("models.json"))!
    expect(outcome.status).toBe("merged")
    expect(outcome.target).toBe(target)

    const text = await read(target)
    expect(text).toContain("# my codex header")
    expect(text).toContain("# features comment")
    expect(text).toContain("[model_providers.openai]")
    const parsed = Bun.TOML.parse(text) as Record<string, any>
    expect(parsed.model_provider).toBe("nous")
    expect(parsed.model).toBe("xiaomi/mimo-v2.6-flash")
    expect(parsed.model_reasoning_effort).toBe("medium")
    expect(parsed.model_catalog_json).toBe(join(home, ".codex", "nous-models.json"))
    expect(parsed.features).toEqual({ experimental: true, respect_system_proxy: true })
    expect(parsed.model_providers.openai.name).toBe("OpenAI")
    expect(parsed.model_providers.nous.wire_api).toBe("responses")

    const catalog = join(home, ".codex", "nous-models.json")
    expect(await exists(catalog)).toBe(true)
    expect(catalogOutcome.status).toBe("created")
    expect(catalogOutcome.notices?.some((n) => n.key === "modelsCopied")).toBe(true)

    const second = await runMerge([exportFile], { home, cwd: home })
    expect(second.find((o) => o.input.endsWith("config.toml"))?.status).toBe("unchanged")
    expect(second.find((o) => o.input.endsWith("models.json"))?.status).toBe("unchanged")
  })

  test("codex: keeps an existing catalog path when models.json is absent", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "config.toml"),
      'model_provider = "nous"\nmodel_catalog_json = "<PATH_TO_MODELS_JSON>"\n',
    )
    const target = join(home, ".codex", "config.toml")
    const existing = 'model_catalog_json = "/custom/catalog.json"\nmodel = "x"\n'
    await put(target, existing)

    const outcome = await merge1(exportFile, { home, cwd: home })
    expect(outcome.status).toBe("merged")
    const parsed = Bun.TOML.parse(await read(target)) as Record<string, unknown>
    expect(parsed.model_catalog_json).toBe("/custom/catalog.json")
    expect(outcome.notices?.some((n) => n.key === "catalogWarning")).toBe(true)
  })

  test("litellm: upserts model_list, drops stale nous entries, keeps the rest", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "litellm-config.yaml"),
      `- model_name: nous/same
  litellm_params:
    model: openai/same
    api_key: os.environ/NOUS_API_KEY
- model_name: nous/new
  litellm_params:
    model: openai/new
    api_key: os.environ/NOUS_API_KEY
`,
    )
    const target = join(home, ".litellm", "config.yaml")
    await put(
      target,
      `general_settings:
  master_key: sk-master
model_list:
  - model_name: nous/same
    litellm_params:
      model: openai/same
      api_key: sk-literal
  - model_name: nous/stale
    litellm_params:
      model: openai/stale
  - model_name: other/model
    litellm_params:
      model: openai/other
`,
    )
    const outcome = await merge1(exportFile, { home, cwd: home })
    expect(outcome.status).toBe("merged")
    const parsed = Bun.YAML.parse(await read(target)) as Record<string, any>
    expect(parsed.general_settings.master_key).toBe("sk-master")
    const names = parsed.model_list.map((x: any) => x.model_name)
    expect(names).toContain("other/model")
    expect(names).toContain("nous/new")
    expect(names).not.toContain("nous/stale")
    const same = parsed.model_list.find((x: any) => x.model_name === "nous/same")
    expect(same.litellm_params.api_key).toBe("sk-literal") // literal key not downgraded
  })

  test("zcode: upserts rules, keeps manual rules and other providers", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "zcode-provider-config.json"),
      JSON.stringify({
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
                  api: { type: "openai-chat-completions", baseUrl: "https://inference-api.nousresearch.com/v1" },
                  personalModelIds: ["xiaomi/mimo-v2.6-flash"],
                  modelOrder: ["xiaomi/mimo-v2.6-flash"],
                },
              },
            ],
          },
          modelConfigRules: {
            providerModelRules: [
              { modelId: "xiaomi/mimo-v2.6-flash", providerId: "nous", config: { enabled: true } },
            ],
            manualProviderModelRules: [],
          },
        },
      }),
    )
    const target = join(home, ".zcode", "v2", "provider_config.json")
    await put(
      target,
      JSON.stringify(
        {
          schemaVersion: 1,
          config: {
            providerOrder: ["builtin:github", "nous"],
            providerConfigRules: {
              providerRules: [
                { providerId: "builtin:github", providerName: "github" },
                {
                  providerId: "nous",
                  providerName: "nous",
                  config: { access: { type: "api-key", apiKey: "sk-real-zcode" } },
                },
              ],
            },
            modelConfigRules: {
              providerModelRules: [
                { modelId: "stale/model", providerId: "nous", config: {} },
                { modelId: "kept/model", providerId: "builtin:github", config: {} },
              ],
              manualProviderModelRules: [{ modelId: "custom", providerId: "mine", config: {} }],
            },
          },
        },
        null,
        2,
      ),
    )

    const outcome = await merge1(exportFile, { home, cwd: home })
    expect(outcome.status).toBe("merged")
    const parsed = Bun.JSONC.parse(await read(target)) as Record<string, any>
    expect(parsed.config.providerOrder).toEqual(["builtin:github", "nous"])
    const rules = parsed.config.providerConfigRules.providerRules
    expect(rules).toHaveLength(2)
    expect(rules.find((r: any) => r.providerId === "builtin:github")).toBeDefined()
    const nousRule = rules.find((r: any) => r.providerId === "nous")
    expect(nousRule.config.access.apiKey).toBe("sk-real-zcode") // literal key kept
    expect(nousRule.config.api.baseUrl).toContain("inference-api")
    const modelRules = parsed.config.modelConfigRules.providerModelRules
    expect(modelRules.map((r: any) => r.modelId).sort()).toEqual(["kept/model", "xiaomi/mimo-v2.6-flash"])
    expect(parsed.config.modelConfigRules.manualProviderModelRules).toHaveLength(1)
  })

  test("chatbox: reported as paste-only, nothing written", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "chatbox-nous-provider.json"),
      JSON.stringify({
        id: "nous",
        name: "nous",
        type: "openai",
        iconUrl: "https://nousresearch.com/favicon.ico",
        urls: { website: "https://nousresearch.com" },
        settings: { apiHost: "https://inference-api.nousresearch.com", models: [] },
      }),
    )
    const outcome = await merge1(exportFile, { home, cwd: home })
    expect(outcome.status).toBe("skipped")
    expect(outcome.message?.key).toBe("pasteOnly")
  })

  test("gcmp: needs --target, then merges into an array file", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "gcmp-compatible-models.json"),
      JSON.stringify([
        { id: "m1", provider: "nous", name: "Fresh", baseUrl: "https://x", sdkMode: "openai", limit: { rpm: 1 } },
      ]),
    )
    const withoutTarget = await merge1(exportFile, { home, cwd: home })
    expect(withoutTarget.status).toBe("failed")
    expect(withoutTarget.message?.key).toBe("needTarget")

    const target = await put(
      join(home, "list.json"),
      JSON.stringify([
        { id: "m0", provider: "other", name: "Keep" },
        { id: "m1", provider: "nous", name: "Stale" },
      ]),
    )
    const withTarget = await merge1(exportFile, { home, cwd: home, target })
    expect(withTarget.status).toBe("merged")
    const parsed = Bun.JSONC.parse(await read(target)) as any[]
    expect(parsed).toHaveLength(2)
    expect(parsed[0].name).toBe("Keep")
    expect(parsed[1].name).toBe("Fresh")
  })

  test("dry-run computes the merge but writes nothing", async () => {
    const home = tmp()
    const exportFile = await put(join(home, "opencode.json"), JSON.stringify(OPENCODE_EXPORT))
    const target = join(home, ".config", "opencode", "opencode.json")
    const outcome = await merge1(exportFile, { home, cwd: home, dryRun: true })
    expect(outcome.status).toBe("created")
    expect(outcome.written).toBe(false)
    expect(await exists(target)).toBe(false)
  })

  test("--api-key fills placeholders in a freshly created config", async () => {
    const home = tmp()
    const exportFile = await put(
      join(home, "zcode-provider-config.json"),
      JSON.stringify({
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
                  api: { type: "openai-chat-completions", baseUrl: "https://x" },
                  personalModelIds: [],
                  modelOrder: [],
                },
              },
            ],
          },
          modelConfigRules: { providerModelRules: [], manualProviderModelRules: [] },
        },
      }),
    )
    const outcome = await merge1(exportFile, { home, cwd: home, apiKey: "sk-cli-123" })
    expect(outcome.status).toBe("created")
    expect(await read(outcome.target!)).toContain("sk-cli-123")
  })

  test("missing and unrecognized inputs fail without touching anything", async () => {
    const home = tmp()
    const missing = await merge1(join(home, "nope.json"), { home, cwd: home })
    expect(missing.status).toBe("failed")
    expect(missing.message?.key).toBe("fileMissing")

    const random = await put(join(home, "random.json"), '{"hello": 1}')
    const unknown = await merge1(random, { home, cwd: home })
    expect(unknown.status).toBe("failed")
    expect(unknown.message?.key).toBe("unrecognized")
  })

  test("passing the target itself as input is skipped", async () => {
    const home = tmp()
    const target = await put(
      join(home, ".config", "opencode", "opencode.json"),
      JSON.stringify(OPENCODE_EXPORT),
    )
    const outcome = await merge1(target, { home, cwd: home })
    expect(outcome.status).toBe("skipped")
    expect(outcome.message?.key).toBe("sameFile")
  })
})
