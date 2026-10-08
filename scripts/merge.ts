#!/usr/bin/env bun
/**
 * One-command merge for files exported from the NousResearch dashboard.
 *
 *   bun run merge [file or directory ...] [options]
 *
 * Detects which exporter produced each file (by content, falling back to the
 * file name), resolves the tool's target config, parses both sides with Bun's
 * built-in parsers (Bun.JSONC / Bun.YAML / Bun.TOML) and splices only the
 * affected fragment into the target — comments and formatting everywhere else
 * stay byte-identical. Every result is re-parsed and deep-compared against the
 * expected merge before anything is written, and an existing target is backed
 * up to `<target>.bak` first.
 *
 * Pure text-splicing primitives live in ./merge-splice.ts; tests in
 * ./merge.test.ts.
 */
import { basename, dirname, isAbsolute, join, resolve as resolvePath } from "node:path"
import { homedir } from "node:os"
import { parseArgs } from "node:util"
import { translations } from "../src/i18n"
import type { Lang } from "../src/types"
import {
  type Action,
  type Format,
  type TomlOp,
  SpliceError,
  deepEqual,
  detectIndent,
  getAtPath,
  hasHashComments,
  hasJsonComments,
  isObj,
  parseByFormat,
  serializeByFormat,
  spliceJsonPath,
  spliceToml,
  spliceYamlKey,
  spliceYamlRootArray,
} from "./merge-splice"

// ---------------------------------------------------------------------------
// types & messages
// ---------------------------------------------------------------------------

type MergeCli = (typeof translations)["zh"]["mergeCli"]
/** All CLI messages except the multi-line usage block. */
export type MergeMsgKey = Exclude<keyof MergeCli, "usage">

export interface Notice {
  key: MergeMsgKey
  args?: string[]
}

export class MergeError extends Error {
  constructor(public notice: Notice) {
    super(notice.key)
  }
}

const errShape = (detail?: string): MergeError =>
  new MergeError({ key: "errShape", args: detail ? [detail] : [] })

export interface TargetBase {
  home: string
  cwd: string
  /** where a Codex models.json catalog is stored (path, whether or not it exists) */
  modelsDest: string
}

export interface MergeContext extends TargetBase {
  targetPath: string
  /** null when the target file does not exist (or is empty) */
  targetText: string | null
  targetParsed: unknown
  exportText: string
  exportParsed: unknown
  /** catalog path usable this run (models input present or file already there) */
  modelsPath?: string
}

export interface MergeResult {
  text: string
  merged: unknown
  changes: string[]
  notices: Notice[]
}

export interface Rule {
  id: string
  displayName: string
  fileNames: string[]
  format: Format
  /** the export is imported by pasting it into the app — no file to merge */
  pasteOnly?: boolean
  /** generated catalog: overwrite in place without a .bak */
  noBackup?: boolean
  sniff(parsed: unknown, format: Format): boolean
  /** candidate target paths, in preference order (first existing one wins) */
  targets(base: TargetBase): string[]
  /** where to create the file when no candidate exists; null → require --target */
  createPath?(base: TargetBase): string | null
  merge(ctx: MergeContext): MergeResult
}

export interface FileOutcome {
  input: string
  ruleId?: string
  status: "merged" | "created" | "unchanged" | "skipped" | "failed"
  target?: string
  backupPath?: string
  changes?: string[]
  notices?: Notice[]
  /** primary message for skipped/failed outcomes */
  message?: Notice
  /** merged file content when --print was given */
  output?: string
  written?: boolean
}

export interface RunOptions {
  target?: string
  dryRun?: boolean
  print?: boolean
  /** write `<target>.bak` before overwriting (default true) */
  backup?: boolean
  apiKey?: string
  modelsOut?: string
  cwd?: string
  home?: string
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

const asObj = (v: unknown): Record<string, unknown> => (isObj(v) ? v : {})
const child = (o: Record<string, unknown>, k: string): Record<string, unknown> => asObj(o[k])
const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export const expandTilde = (p: string, home: string): string => {
  if (p === "~") return home
  if (p.startsWith("~/")) return join(home, p.slice(2))
  return p
}

const fileExists = (p: string): Promise<boolean> => Bun.file(p).exists()

async function statOrNull(p: string) {
  try {
    return await Bun.file(p).stat()
  } catch {
    return null
  }
}

const isDir = async (p: string): Promise<boolean> => (await statOrNull(p))?.isDirectory() === true

/** Replace each `%s` in `template` with the next argument. */
export function fmt(template: string, ...args: string[]): string {
  let i = 0
  return template.replace(/%s/g, () => args[i++] ?? "")
}

function dedupeNotices(notices: Notice[]): Notice[] {
  const seen = new Set<string>()
  return notices.filter((n) => {
    const k = n.key + JSON.stringify(n.args ?? [])
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Keep the target's literal secrets: whenever the export carries a placeholder
 * or an environment reference (`YOUR_…`, `{env:…}`, `$VAR`, `${input:…}`) for a
 * secret-looking key and the target already holds a real value, the target's
 * value wins — re-running a merge never downgrades a working API key.
 */
export function preserveSecrets(exported: unknown, target: unknown): void {
  const SECRET_KEY = /api[-_]?key|authorization|token|secret|password/i
  const REFERENCE = /YOUR_[A-Z0-9_]+|\$\{input:|\{env:[^}]+\}|^\$[A-Z_][A-Z0-9_]*$|^os\.envir/i
  const isReference = (v: unknown): boolean =>
    typeof v === "string" && (v.trim() === "" || REFERENCE.test(v))

  if (Array.isArray(exported) && Array.isArray(target)) {
    exported.forEach((item, i) => {
      if (i < target.length) preserveSecrets(item, target[i])
    })
    return
  }
  if (!isObj(exported) || !isObj(target)) return
  for (const [k, v] of Object.entries(exported)) {
    const tv = target[k]
    if (
      typeof v === "string" &&
      SECRET_KEY.test(k) &&
      isReference(v) &&
      typeof tv === "string" &&
      tv.trim() !== "" &&
      !isReference(tv)
    ) {
      exported[k] = tv
      continue
    }
    if (isObj(v) || Array.isArray(v)) preserveSecrets(v, tv)
  }
}

/** Replace export placeholders with a real key (only when --api-key was given). */
export function fillApiKey(value: unknown, apiKey: string): void {
  const SECRET_KEY = /api[-_]?key|authorization|token|secret|password/i
  if (Array.isArray(value)) {
    value.forEach((item) => fillApiKey(item, apiKey))
    return
  }
  if (!isObj(value)) return
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") {
      let next = v.replace(/YOUR_[A-Z0-9_]+/g, apiKey)
      if (next === "${input:nousApiKey}") next = apiKey
      if (next !== v) value[k] = next
      else if (v === "" && SECRET_KEY.test(k)) value[k] = apiKey
    } else if (isObj(v) || Array.isArray(v)) {
      fillApiKey(v, apiKey)
    }
  }
}

// ---------------------------------------------------------------------------
// shared merge drivers
// ---------------------------------------------------------------------------

function applyJson(
  ctx: MergeContext,
  merged: unknown,
  paths: readonly (readonly string[])[],
  notices: Notice[],
  format: Format = "json",
): MergeResult {
  if (ctx.targetText === null) {
    return {
      text: serializeByFormat(merged, format, detectIndent(ctx.exportText)),
      merged,
      changes: [],
      notices,
    }
  }
  if (deepEqual(ctx.targetParsed, merged))
    return { text: ctx.targetText, merged, changes: [], notices }

  const indent = detectIndent(ctx.targetText)
  let text = ctx.targetText
  const changes: string[] = []
  for (const path of paths) {
    const out = spliceJsonPath(text, path, merged, indent)
    text = out.text
    if (out.action === "skip") continue
    changes.push(path.join("."))
    if (out.action === "rewrite") notices.push({ key: "fallbackRewrite" })
    if (out.commentLoss) notices.push({ key: "commentsLost" })
  }
  return { text, merged, changes, notices }
}

/** Full rewrite for root-array JSON targets (gcmp / chatLanguageModels). */
function applyJsonRootArray(ctx: MergeContext, merged: unknown, notices: Notice[]): MergeResult {
  if (ctx.targetText === null)
    return { text: serializeByFormat(merged, "json", detectIndent(ctx.exportText)), merged, changes: [], notices }
  if (deepEqual(ctx.targetParsed, merged))
    return { text: ctx.targetText, merged, changes: [], notices }
  if (hasJsonComments(ctx.targetText)) notices.push({ key: "commentsLost" })
  return {
    text: JSON.stringify(merged, null, detectIndent(ctx.targetText)) + "\n",
    merged,
    changes: ["[]"],
    notices,
  }
}

function finishYaml(
  ctx: MergeContext,
  merged: unknown,
  run: (text: string, targetParsed: unknown, merged: unknown) => ReturnType<typeof spliceYamlKey>,
  notices: Notice[],
  changeLabel: string,
): MergeResult {
  if (ctx.targetText === null)
    return { text: serializeByFormat(merged, "yaml"), merged, changes: [], notices }
  const out = run(ctx.targetText, ctx.targetParsed, merged)
  if (out.action === "skip") return { text: ctx.targetText, merged, changes: [], notices }
  if (out.action === "rewrite") notices.push({ key: "fallbackRewrite" })
  if (out.commentLoss) notices.push({ key: "commentsLost" })
  return { text: out.text, merged, changes: [changeLabel], notices }
}

function applyTomlOps(targetParsed: unknown, ops: readonly TomlOp[]): unknown {
  const out: Record<string, unknown> = isObj(targetParsed) ? { ...targetParsed } : {}
  for (const op of ops) {
    if (op.kind === "scalar") {
      if (op.value === undefined) delete out[op.key]
      else out[op.key] = op.value
      continue
    }
    const parts = op.key.split(".")
    let cur = out
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i]!
      // clone every level we descend into: the root copy above is shallow, so
      // mutating a shared nested table would corrupt targetParsed (which the
      // splicer compares against to decide whether an op is a no-op)
      const next = isObj(cur[k]) ? { ...(cur[k] as Record<string, unknown>) } : {}
      cur[k] = next
      cur = next
    }
    cur[parts[parts.length - 1]!] = op.value
  }
  return out
}

// ---------------------------------------------------------------------------
// rules
// ---------------------------------------------------------------------------

const REF_EXPORT_SCHEMA = "https://opencode.ai/config.json"
const CRUSH_EXPORT_SCHEMA = "https://charm.land/crush.json"
const MIMOCODE_EXPORT_SCHEMA = "https://mimo.xiaomi.com/mimocode/config.json"
const CATALOG_PLACEHOLDER = "<PATH_TO_MODELS_JSON>"

const xdgConfig = (home: string): string => process.env.XDG_CONFIG_HOME || join(home, ".config")
const dshProfile = (): string => process.env.DSH_PROFILE || "desktop"

function hasModelFieldWith(p: Record<string, unknown>, field: string): boolean {
  const models = asObj(p.provider).nous
  if (!isObj(models)) return false
  const first = Object.values(asObj(asObj(models).models))[0]
  return isObj(first) && field in first
}

function exportNousEntry(exp: unknown, ...path: string[]): Record<string, unknown> {
  const entry = getAtPath(exp, path)
  if (!isObj(entry)) throw errShape(path.join("."))
  return { ...entry }
}

function rules(): Rule[] {
  const list: Rule[] = []

  // ---- Codex model catalog (copied, not merged) ----
  list.push({
    id: "codex-models",
    displayName: "codex / codex-osaurus models.json",
    fileNames: ["models.json"],
    format: "json",
    noBackup: true,
    sniff: (p, f) =>
      f === "json" &&
      isObj(p) &&
      Array.isArray(p.models) &&
      isObj(p.models[0]) &&
      ("truncation_policy" in p.models[0] || "shell_type" in p.models[0]),
    targets: (b) => [b.modelsDest],
    createPath: (b) => b.modelsDest,
    merge: (ctx) => ({
      text: ctx.exportText,
      merged: ctx.exportParsed,
      changes: [],
      notices: [{ key: "modelsCopied", args: [ctx.targetPath] }],
    }),
  })

  // ---- Codex config.toml (both the direct and the Osaurus variant) ----
  list.push({
    id: "codex",
    displayName: "codex / codex-osaurus",
    fileNames: ["config.toml"],
    format: "toml",
    sniff: (p, f) =>
      f === "toml" && isObj(p) && typeof p.model_provider === "string" &&
      ("model_catalog_json" in p || isObj(p.model_providers)),
    targets: (b) => [join(b.home, ".codex", "config.toml")],
    createPath: (b) => join(b.home, ".codex", "config.toml"),
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      if (!isObj(exp)) throw errShape("config.toml")
      const ops: TomlOp[] = []
      for (const key of ["model_provider", "model", "model_reasoning_effort"]) {
        if (key in exp) ops.push({ kind: "scalar", key, value: exp[key] })
      }
      if (typeof exp.model_catalog_json === "string") {
        if (ctx.modelsPath) {
          ops.push({ kind: "scalar", key: "model_catalog_json", value: ctx.modelsPath })
        } else {
          const existing = isObj(ctx.targetParsed) ? ctx.targetParsed.model_catalog_json : undefined
          const keepExisting = typeof existing === "string" && existing !== CATALOG_PLACEHOLDER
          if (!keepExisting)
            ops.push({ kind: "scalar", key: "model_catalog_json", value: undefined })
          notices.push({ key: "catalogWarning" })
        }
      }
      if (isObj(exp.features)) {
        const targetFeatures = isObj(ctx.targetParsed) && isObj(ctx.targetParsed.features)
          ? ctx.targetParsed.features
          : {}
        ops.push({ kind: "table", key: "features", value: { ...targetFeatures, ...exp.features } })
      }
      if (isObj(exp.model_providers)) {
        for (const [pid, body] of Object.entries(exp.model_providers)) {
          if (isObj(body)) ops.push({ kind: "table", key: `model_providers.${pid}`, value: body })
        }
      }
      const base = ctx.targetText ?? ctx.exportText
      const merged = applyTomlOps(ctx.targetParsed, ops)
      const out = spliceToml(base, ctx.targetParsed, ops, merged)
      if (out.action === "rewrite") notices.push({ key: "fallbackRewrite" })
      if (out.commentLoss) notices.push({ key: "commentsLost" })
      return { text: out.text, merged, changes: out.changes, notices }
    },
  })

  // ---- ZCode ----
  list.push({
    id: "zcode",
    displayName: "ZCode",
    fileNames: ["zcode-provider-config.json"],
    format: "json",
    sniff: (p) => isObj(p) && p.schemaVersion === 1 && isObj(p.config) && isObj(asObj(p.config).providerConfigRules),
    targets: (b) => [join(b.home, ".zcode", "v2", "provider_config.json")],
    createPath: (b) => join(b.home, ".zcode", "v2", "provider_config.json"),
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      if (!isObj(exp) || !isObj(exp.config)) throw errShape("config")
      if (ctx.targetText === null) return applyJson(ctx, exp, [], notices)
      if (ctx.targetParsed !== null && !isObj(ctx.targetParsed)) throw errShape("target")

      const ec = asObj(exp.config)
      const tc = asObj(asObj(ctx.targetParsed).config)
      const tpc = asObj(tc.providerConfigRules)
      const tmc = asObj(tc.modelConfigRules)
      const epc = asObj(ec.providerConfigRules)
      const emc = asObj(ec.modelConfigRules)

      const tOrder = listOf(tc.providerOrder)
      const eOrder = listOf(ec.providerOrder)
      const providerOrder = [...tOrder, ...eOrder.filter((x) => !tOrder.includes(x))]

      const tRules = listOf(tpc.providerRules)
      const eRules = listOf(epc.providerRules)
      for (const r of eRules) {
        if (!isObj(r)) continue
        const old = tRules.find((x) => isObj(x) && x.providerId === r.providerId)
        if (old) preserveSecrets(r, old)
      }
      const providerRules = [
        ...tRules.filter((x) => !(isObj(x) && x.providerId === "nous")),
        ...eRules,
      ]

      const tModelRules = listOf(tmc.providerModelRules)
      const modelRules = [
        ...tModelRules.filter((x) => !(isObj(x) && x.providerId === "nous")),
        ...listOf(emc.providerModelRules),
      ]
      const manualRules = listOf(tmc.manualProviderModelRules)

      const base = asObj(ctx.targetParsed)
      const merged = {
        ...base,
        schemaVersion: base.schemaVersion ?? exp.schemaVersion,
        config: {
          ...tc,
          ...ec,
          providerOrder,
          providerConfigRules: { ...tpc, ...epc, providerRules },
          modelConfigRules: {
            ...tmc,
            ...emc,
            providerModelRules: modelRules,
            manualProviderModelRules: manualRules,
          },
        },
      }
      const paths: string[][] = [
        ["config", "providerOrder"],
        ["config", "providerConfigRules", "providerRules"],
        ["config", "modelConfigRules", "providerModelRules"],
      ]
      if (base.schemaVersion === undefined && exp.schemaVersion !== undefined)
        paths.push(["schemaVersion"])
      return applyJson(ctx, merged, paths, notices)
    },
  })

  // ---- DeepSeek Harness settings.yaml ----
  list.push({
    id: "dsh-settings",
    displayName: "DeepSeek Harness settings.yaml",
    fileNames: ["dsh-llm-pi-ai.yaml"],
    format: "yaml",
    sniff: (p) => isObj(p) && isObj(p["llm-pi-ai"]) && isObj(asObj(p["llm-pi-ai"]).providers),
    targets: (b) => [
      join(b.home, ".dsh", "profiles", dshProfile(), "settings.yaml"),
      join(b.home, ".dsh", "settings.yaml"),
    ],
    createPath: (b) => join(b.home, ".dsh", "profiles", dshProfile(), "settings.yaml"),
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      if (!isObj(exp) || !isObj(exp["llm-pi-ai"])) throw errShape("llm-pi-ai")
      const expEntry = asObj(exp["llm-pi-ai"])
      const expProviders = asObj(expEntry.providers)
      if (ctx.targetText === null) {
        return {
          text: serializeByFormat(exp, "yaml"),
          merged: exp,
          changes: [],
          notices,
        }
      }
      const t = ctx.targetParsed
      if (!isObj(t)) throw errShape("target")
      const tEntry = asObj(t["llm-pi-ai"])
      const tProviders = asObj(tEntry.providers)
      const providers = { ...tProviders }
      for (const [name, body] of Object.entries(expProviders)) {
        if (!isObj(body)) {
          providers[name] = body
          continue
        }
        const copy = { ...body }
        const old = tProviders[name]
        if (isObj(old)) preserveSecrets(copy, old)
        providers[name] = copy
      }
      const merged = { ...t, "llm-pi-ai": { ...tEntry, ...expEntry, providers } }
      return finishYaml(
        ctx,
        merged,
        (text, tp, m) => spliceYamlKey(text, "llm-pi-ai", tp, m),
        notices,
        "llm-pi-ai",
      )
    },
  })

  // ---- DeepSeek Harness desktop cordis patch ----
  list.push({
    id: "dsh-patch",
    displayName: "DeepSeek Harness cordis.patch.yml",
    fileNames: ["dsh-desktop-cordis-patch.yml"],
    format: "yaml",
    sniff: (p) =>
      Array.isArray(p) &&
      p.some((e) => isObj(e) && typeof e.id === "string" && typeof e.name === "string" && e.name.startsWith("@deepseek-ai/")),
    targets: (b) => [
      join(b.home, ".dsh", "cordis.patch.yml"),
      join(b.home, ".dsh", "profiles", dshProfile(), "cordis.patch.yml"),
    ],
    createPath: (b) => join(b.home, ".dsh", "profiles", dshProfile(), "cordis.patch.yml"),
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      if (!Array.isArray(exp)) throw errShape("patch entries")
      if (ctx.targetText === null)
        return { text: serializeByFormat(exp, "yaml"), merged: exp, changes: [], notices }
      const t = ctx.targetParsed
      if (!Array.isArray(t)) throw errShape("target")
      const merged = t.map((entry) => {
        if (!isObj(entry)) return entry
        const replacement = exp.find((e) => isObj(e) && e.id === entry.id)
        if (!replacement) return entry
        const copy = { ...replacement }
        preserveSecrets(copy, entry)
        return copy
      })
      for (const e of exp) {
        if (!isObj(e)) continue
        if (!t.some((x) => isObj(x) && x.id === e.id)) merged.push(e)
      }
      return finishYaml(
        ctx,
        merged,
        (text, tp, m) => spliceYamlRootArray(text, tp, m),
        notices,
        "[]",
      )
    },
  })

  // ---- LiteLLM ----
  list.push({
    id: "litellm",
    displayName: "LiteLLM",
    fileNames: ["litellm-config.yaml"],
    format: "yaml",
    sniff: (p) =>
      (Array.isArray(p) && isObj(p[0]) && "model_name" in p[0] && "litellm_params" in p[0]) ||
      (isObj(p) && Array.isArray(p.model_list) && isObj(p.model_list[0]) && "litellm_params" in p.model_list[0]),
    targets: (b) => [join(b.home, ".litellm", "config.yaml")],
    createPath: (b) => join(b.home, ".litellm", "config.yaml"),
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      const entries = Array.isArray(exp)
        ? exp
        : isObj(exp) && Array.isArray(exp.model_list)
          ? exp.model_list
          : (() => {
              throw errShape("model_list")
            })()
      const upsertEntries = (list: unknown[]): unknown[] => {
        const kept = list.filter((x) => !isObj(x) || !String(x.model_name ?? "").startsWith("nous/"))
        const items = entries.map((e) => {
          if (!isObj(e)) return e
          const old = list.find((y) => isObj(y) && y.model_name === e.model_name)
          const copy = { ...e }
          if (old) preserveSecrets(copy, old)
          return copy
        })
        return [...kept, ...items]
      }

      if (ctx.targetText === null) {
        const merged = { model_list: upsertEntries([]) }
        return { text: serializeByFormat(merged, "yaml"), merged, changes: [], notices }
      }
      const t = ctx.targetParsed
      if (Array.isArray(t)) {
        const merged = upsertEntries(t)
        if (deepEqual(t, merged)) return { text: ctx.targetText, merged, changes: [], notices }
        return finishYaml(ctx, merged, (text, tp, m) => spliceYamlRootArray(text, tp, m), notices, "[]")
      }
      if (!isObj(t)) throw errShape("target")
      const current = t.model_list
      if (current !== undefined && !Array.isArray(current)) throw errShape("model_list")
      const merged = { ...t, model_list: upsertEntries(listOf(current)) }
      return finishYaml(
        ctx,
        merged,
        (text, tp, m) => spliceYamlKey(text, "model_list", tp, m),
        notices,
        "model_list",
      )
    },
  })

  // ---- CLIProxyAPI ----
  list.push({
    id: "cliproxyapi",
    displayName: "CLIProxyAPI",
    fileNames: ["cliproxyapi-config.yaml"],
    format: "yaml",
    sniff: (p) => isObj(p) && Array.isArray(p["openai-compatibility"]),
    targets: (b) => [
      join(b.home, ".config", "cli-proxy-api", "config.yaml"),
      "/opt/homebrew/etc/cliproxyapi.conf",
      "/usr/local/etc/cliproxyapi.conf",
    ],
    // no createPath: without an existing config we cannot know where the proxy reads from
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      const entries = isObj(exp) && Array.isArray(exp["openai-compatibility"])
        ? exp["openai-compatibility"]
        : (() => {
            throw errShape("openai-compatibility")
          })()
      const upsertEntries = (list: unknown[]): unknown[] => {
        const kept = list.filter((x) => !isObj(x) || x.name !== "nous")
        const items = entries.map((e) => {
          if (!isObj(e)) return e
          const old = list.find((y) => isObj(y) && y.name === e.name)
          const copy = { ...e }
          if (old) preserveSecrets(copy, old)
          return copy
        })
        return [...kept, ...items]
      }
      if (ctx.targetText === null) {
        const merged = { "openai-compatibility": upsertEntries([]) }
        return { text: serializeByFormat(merged, "yaml"), merged, changes: [], notices }
      }
      const t = ctx.targetParsed
      if (!isObj(t)) throw errShape("target")
      const current = t["openai-compatibility"]
      if (current !== undefined && !Array.isArray(current)) throw errShape("openai-compatibility")
      const merged = { ...t, "openai-compatibility": upsertEntries(listOf(current)) }
      return finishYaml(
        ctx,
        merged,
        (text, tp, m) => spliceYamlKey(text, "openai-compatibility", tp, m),
        notices,
        "openai-compatibility",
      )
    },
  })

  // ---- OpenCode / Crush / MiMo Desktop (provider-map style, JSON) ----
  const providerMapRule = (opts: {
    id: string
    displayName: string
    fileName: string
    mapKey: string
    schema?: string
    sniff: (p: unknown) => boolean
    candidates: (b: TargetBase) => string[]
  }): Rule => ({
    id: opts.id,
    displayName: opts.displayName,
    fileNames: [opts.fileName],
    format: "json",
    sniff: opts.sniff,
    targets: opts.candidates,
    createPath: (b) => opts.candidates(b)[0] ?? null,
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      if (!isObj(exp)) throw errShape(opts.mapKey)
      const entry = exportNousEntry(exp, opts.mapKey, "nous")
      const base = asObj(ctx.targetParsed)
      const tMap = child(base, opts.mapKey)
      const oldEntry = tMap.nous
      if (isObj(oldEntry)) preserveSecrets(entry, oldEntry)
      const merged: Record<string, unknown> = {
        ...base,
        [opts.mapKey]: { ...tMap, nous: entry },
      }
      const addSchema =
        opts.schema !== undefined && base.$schema === undefined && exp.$schema !== undefined
      if (addSchema) merged.$schema = exp.$schema
      const paths: string[][] = [[opts.mapKey, "nous"]]
      if (addSchema) paths.push(["$schema"])
      return applyJson(ctx, merged, paths, notices)
    },
  })

  // mimocode must be detected before opencode: both ship an
  // `@ai-sdk/openai-compatible` provider.nous entry
  list.push(
    providerMapRule({
      id: "mimocode",
      displayName: "MiMo Desktop",
      fileName: "mimocode.jsonc",
      mapKey: "provider",
      schema: MIMOCODE_EXPORT_SCHEMA,
      sniff: (p) =>
        isObj(p) &&
        (p.$schema === MIMOCODE_EXPORT_SCHEMA || hasModelFieldWith(p, "modalities")),
      candidates: (b) => [join(xdgConfig(b.home), "mimocode", "mimocode.jsonc")],
    }),
    providerMapRule({
      id: "opencode",
      displayName: "OpenCode",
      fileName: "opencode.json",
      mapKey: "provider",
      schema: REF_EXPORT_SCHEMA,
      sniff: (p) =>
        isObj(p) &&
        (p.$schema === REF_EXPORT_SCHEMA ||
          (asObj(asObj(p.provider).nous).npm === "@ai-sdk/openai-compatible" &&
            !hasModelFieldWith(p, "modalities"))),
      candidates: (b) => [join(xdgConfig(b.home), "opencode", "opencode.json"), join(b.cwd, "opencode.json")],
    }),
    providerMapRule({
      id: "crush",
      displayName: "Crush",
      fileName: "crush.json",
      mapKey: "providers",
      schema: CRUSH_EXPORT_SCHEMA,
      sniff: (p) =>
        isObj(p) &&
        (p.$schema === CRUSH_EXPORT_SCHEMA || asObj(asObj(p.providers).nous).type === "openai"),
      candidates: (b) => [join(xdgConfig(b.home), "crush", "crush.json"), join(b.cwd, "crush.json")],
    }),
  )

  // ---- Zed ----
  list.push({
    id: "zed",
    displayName: "Zed",
    fileNames: ["zed-language-models.json"],
    format: "json",
    sniff: (p) => isObj(p) && isObj(p.language_models) && isObj(asObj(p.language_models).openai_compatible),
    targets: (b) =>
      process.platform === "darwin"
        ? [
            join(b.home, "Library", "Application Support", "Zed", "settings.json"),
            join(b.home, ".config", "zed", "settings.json"),
          ]
        : [join(b.home, ".config", "zed", "settings.json")],
    createPath: (b) =>
      process.platform === "darwin"
        ? join(b.home, "Library", "Application Support", "Zed", "settings.json")
        : join(b.home, ".config", "zed", "settings.json"),
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      const entry = exportNousEntry(exp, "language_models", "openai_compatible", "nous")
      const base = asObj(ctx.targetParsed)
      const lm = child(base, "language_models")
      const oa = child(lm, "openai_compatible")
      const oldEntry = oa.nous
      if (isObj(oldEntry)) preserveSecrets(entry, oldEntry)
      const merged = {
        ...base,
        language_models: { ...lm, openai_compatible: { ...oa, nous: entry } },
      }
      return applyJson(ctx, merged, [["language_models", "openai_compatible", "nous"]], notices)
    },
  })

  // ---- Cherry Studio (bare provider entry → data.providers.nous) ----
  list.push({
    id: "cherry-studio",
    displayName: "Cherry Studio",
    fileNames: ["cherry-studio-nous.json"],
    format: "json",
    sniff: (p) =>
      isObj(p) &&
      p.type === "openai" &&
      typeof p.apiHost === "string" &&
      Array.isArray(p.models) &&
      !("settings" in p),
    targets: (b) => [
      join(b.home, "Library", "Application Support", "CherryStudio", "User", "settings.json"),
      join(b.home, "Library", "Application Support", "CherryStudio", "settings.json"),
      join(xdgConfig(b.home), "CherryStudio", "settings.json"),
    ],
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      if (!isObj(exp)) throw errShape("provider entry")
      const entry = { ...exp }
      const base = asObj(ctx.targetParsed)
      const data = child(base, "data")
      const providers = data.providers
      if (Array.isArray(providers)) {
        const old = providers.find((x) => isObj(x) && x.id === entry.id)
        if (old) preserveSecrets(entry, old)
        const list = [
          ...providers.filter((x) => !(isObj(x) && x.id === entry.id)),
          entry,
        ]
        const merged = { ...base, data: { ...data, providers: list } }
        return applyJson(ctx, merged, [["data", "providers"]], notices)
      }
      const tProviders = asObj(providers)
      const old = tProviders.nous
      if (isObj(old)) preserveSecrets(entry, old)
      const merged = {
        ...base,
        data: { ...data, providers: { ...tProviders, nous: entry } },
      }
      return applyJson(ctx, merged, [["data", "providers", "nous"]], notices)
    },
  })

  // ---- GitHub Copilot style array targets (require --target) ----
  const arrayRule = (opts: {
    id: string
    displayName: string
    fileName: string
    filterKey: string
    filterValue: string
    matchKey: string
    sniff: (p: unknown) => boolean
  }): Rule => ({
    id: opts.id,
    displayName: opts.displayName,
    fileNames: [opts.fileName],
    format: "json",
    sniff: opts.sniff,
    targets: () => [],
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      if (!Array.isArray(exp)) throw errShape("export array")
      if (ctx.targetText === null) return applyJsonRootArray(ctx, exp, notices)
      const t = ctx.targetParsed
      if (!Array.isArray(t)) throw errShape("target must be a JSON array")
      const items = exp.map((e) => {
        if (!isObj(e)) return e
        const old = t.find((y) => isObj(y) && y[opts.matchKey] === e[opts.matchKey])
        const copy = { ...e }
        if (old) preserveSecrets(copy, old)
        return copy
      })
      const merged = [
        ...t.filter((x) => !isObj(x) || x[opts.filterKey] !== opts.filterValue),
        ...items,
      ]
      return applyJsonRootArray(ctx, merged, notices)
    },
  })

  list.push(
    arrayRule({
      id: "gcmp",
      displayName: "GitHub Copilot gcmp",
      fileName: "gcmp-compatible-models.json",
      filterKey: "provider",
      filterValue: "nous",
      matchKey: "id",
      sniff: (p) =>
        Array.isArray(p) && isObj(p[0]) && "sdkMode" in p[0] && "limit" in p[0] && "baseUrl" in p[0],
    }),
    arrayRule({
      id: "copilot-lm",
      displayName: "GitHub Copilot chatLanguageModels",
      fileName: "chatLanguageModels.json",
      filterKey: "name",
      filterValue: "nous",
      matchKey: "name",
      sniff: (p) => Array.isArray(p) && isObj(p[0]) && p[0].vendor === "customendpoint",
    }),
  )

  // ---- Chatbox: pasted into the app, nothing to merge ----
  list.push({
    id: "chatbox",
    displayName: "Chatbox",
    fileNames: ["chatbox-nous-provider.json"],
    format: "json",
    pasteOnly: true,
    sniff: (p) =>
      isObj(p) && p.type === "openai" && isObj(p.settings) && typeof asObj(p.settings).apiHost === "string" && "iconUrl" in p,
    targets: () => [],
    merge: () => {
      throw new MergeError({ key: "pasteOnly" })
    },
  })

  return list
}

/** Detection order matters: content sniffers run top to bottom. */
export const RULES: Rule[] = rules()

export const KNOWN_NAMES: string[] = [...new Set(RULES.flatMap((r) => r.fileNames))]

/** Names too generic to trust without a content sniff. */
const GENERIC_NAMES = new Set(["config.toml", "models.json"])

// ---------------------------------------------------------------------------
// detection
// ---------------------------------------------------------------------------

export interface Detection {
  ruleId: string
  format: Format
  parsed: unknown
}

const FORMAT_BY_EXT: Record<string, Format> = {
  ".json": "json",
  ".jsonc": "json",
  ".json5": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
}

/** Strip a browser's duplicate-download suffix: `config (1).toml` → `config.toml`. */
export function normalizeName(fileName: string): string {
  return basename(fileName).replace(/ \(\d+\)(\.[^.]+)$/, "$1")
}

function formatOf(fileName: string): Format | null {
  const dot = basename(fileName).lastIndexOf(".")
  if (dot === -1) return null
  return FORMAT_BY_EXT[basename(fileName).slice(dot).toLowerCase()] ?? null
}

/**
 * `strict` (directory scans) demands that the content sniffs as an export;
 * `loose` (explicit file arguments) falls back to the known file names — except
 * for generic names like `config.toml` / `models.json`, where an unrelated file
 * must never be mistaken for an export just because it shares the name.
 */
export function detectExport(
  fileName: string,
  text: string,
  mode: "loose" | "strict" = "loose",
): Detection | null {
  const declared = formatOf(fileName)
  const attempts: Format[] = declared
    ? [declared, ...(["json", "yaml", "toml"] as Format[]).filter((f) => f !== declared)]
    : ["json", "yaml", "toml"]
  let parsed: unknown
  let used: Format | null = null
  for (const f of attempts) {
    try {
      parsed = parseByFormat(text, f)
      used = f
      break
    } catch {
      /* try the next format */
    }
  }
  if (used === null) return null

  for (const rule of RULES) {
    if (rule.sniff(parsed, used)) return { ruleId: rule.id, format: used, parsed }
  }
  if (mode === "loose") {
    const name = normalizeName(fileName)
    if (!GENERIC_NAMES.has(name)) {
      const rule = RULES.find((r) => r.fileNames.includes(name))
      if (rule) return { ruleId: rule.id, format: used, parsed }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// merge pipeline
// ---------------------------------------------------------------------------

async function resolveTargetPath(
  rule: Rule,
  base: TargetBase,
  override: string | undefined,
  inputPath: string,
): Promise<{ path: string } | { error: Notice }> {
  const isInput = (p: string): boolean => resolvePath(p) === resolvePath(inputPath)
  if (override) return { path: override }
  const candidates = rule.targets(base)
  for (const c of candidates) {
    // never resolve a target onto the exported file itself (e.g. running the
    // merge from the directory that holds the download)
    if (isInput(c)) continue
    if (await fileExists(c)) return { path: c }
  }
  const created = rule.createPath?.(base) ?? null
  // returning a path equal to the input is fine: the caller reports sameFile
  if (created) return { path: created }
  return { error: { key: "needTarget", args: [candidates.join(", ")] } }
}

export async function runMerge(files: string[], opts: RunOptions = {}): Promise<FileOutcome[]> {
  const home = opts.home ?? process.env.HOME ?? homedir()
  const cwd = opts.cwd ?? process.cwd()
  const modelsDest = opts.modelsOut
    ? expandTilde(opts.modelsOut, home)
    : join(home, ".codex", "nous-models.json")
  const base: TargetBase = { home, cwd, modelsDest }

  const outcomes = new Map<string, FileOutcome>()
  const loaded: { file: string; text: string; det: Detection }[] = []
  const order: string[] = []

  // phase 1: read + detect
  for (const file of files) {
    order.push(file)
    if (!(await fileExists(file))) {
      outcomes.set(file, { input: file, status: "failed", message: { key: "fileMissing", args: [file] } })
      continue
    }
    const text = await Bun.file(file).text()
    const det = detectExport(file, text, "loose")
    if (!det) {
      outcomes.set(file, { input: file, status: "failed", message: { key: "unrecognized" } })
      continue
    }
    loaded.push({ file, text, det })
  }

  // phase 1.5: a Codex config.toml brings its sibling models.json along
  for (const item of [...loaded]) {
    if (item.det.ruleId !== "codex") continue
    const sibling = join(dirname(item.file), "models.json")
    if (order.includes(sibling)) continue
    if (!(await fileExists(sibling))) continue
    const text = await Bun.file(sibling).text()
    const det = detectExport(sibling, text, "strict")
    if (det?.ruleId !== "codex-models") continue
    order.push(sibling)
    loaded.push({ file: sibling, text, det })
  }

  // catalog availability decides whether Codex's model_catalog_json can be set
  const hasCatalogInput = loaded.some((l) => l.det.ruleId === "codex-models")
  const modelsPath = hasCatalogInput || (await fileExists(modelsDest)) ? modelsDest : undefined

  // phase 2: merge
  for (const { file, text, det } of loaded) {
    if (outcomes.has(file)) continue
    outcomes.set(file, await mergeLoaded(file, text, det, opts, base, modelsPath))
  }

  return order.map((f) => outcomes.get(f)!).filter(Boolean)
}

async function mergeLoaded(
  file: string,
  text: string,
  det: Detection,
  opts: RunOptions,
  base: TargetBase,
  modelsPath: string | undefined,
): Promise<FileOutcome> {
  const rule = RULES.find((r) => r.id === det.ruleId)!
  const span = { input: file, ruleId: rule.id }

  if (rule.pasteOnly) return { ...span, status: "skipped", message: { key: "pasteOnly" } }

  let exportParsed = det.parsed
  if (opts.apiKey) fillApiKey(exportParsed, opts.apiKey)

  const resolved = await resolveTargetPath(rule, base, opts.target, file)
  if ("error" in resolved) return { ...span, status: "failed", message: resolved.error }
  const targetPath = resolved.path

  if (resolvePath(file) === resolvePath(targetPath))
    return { ...span, status: "skipped", target: targetPath, message: { key: "sameFile" } }

  let targetText: string | null = null
  let targetParsed: unknown = null
  if (await fileExists(targetPath)) {
    const raw = await Bun.file(targetPath).text()
    if (raw.trim() !== "") {
      targetText = raw
      try {
        targetParsed = parseByFormat(raw, rule.format)
      } catch {
        return { ...span, status: "failed", target: targetPath, message: { key: "parseTargetFail" } }
      }
    }
  }

  let result: MergeResult
  try {
    result = rule.merge({
      ...base,
      targetPath,
      targetText,
      targetParsed,
      exportText: text,
      exportParsed,
      modelsPath,
    })
  } catch (e) {
    if (e instanceof MergeError) return { ...span, status: "failed", target: targetPath, message: e.notice }
    if (e instanceof SpliceError)
      return { ...span, status: "failed", target: targetPath, message: { key: "errShape", args: [e.message] } }
    return {
      ...span,
      status: "failed",
      target: targetPath,
      message: { key: "errShape", args: [e instanceof Error ? e.message : String(e)] },
    }
  }

  // safety net: the spliced text must parse back to exactly the merged value
  let reparsed: unknown
  try {
    reparsed = parseByFormat(result.text, rule.format)
  } catch {
    return { ...span, status: "failed", target: targetPath, message: { key: "validateFail" } }
  }
  if (!deepEqual(reparsed, result.merged))
    return { ...span, status: "failed", target: targetPath, message: { key: "validateFail" } }

  const notices = dedupeNotices(result.notices)
  const status: FileOutcome["status"] =
    targetText === null ? "created" : result.text === targetText ? "unchanged" : "merged"
  const dryRun = opts.dryRun === true || opts.print === true
  const written = !dryRun && status !== "unchanged"

  if (written) {
    let backupPath: string | undefined
    if (opts.backup !== false && targetText !== null && !rule.noBackup) {
      backupPath = `${targetPath}.bak`
      await Bun.write(backupPath, targetText)
    }
    await Bun.write(targetPath, result.text)
    return {
      ...span,
      status,
      target: targetPath,
      backupPath,
      changes: result.changes,
      notices,
      written: true,
      output: opts.print ? result.text : undefined,
    }
  }

  return {
    ...span,
    status,
    target: targetPath,
    changes: result.changes,
    notices,
    written: false,
    output: opts.print ? result.text : undefined,
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export const RULE_LIST_ORDER = RULES

function pickLang(arg: string | undefined): Lang {
  if (arg === "zh" || arg === "en") return arg
  const env = process.env.LC_ALL || process.env.LANG || ""
  if (env === "") return "zh"
  return /^zh/i.test(env) ? "zh" : "en"
}

const displayPath = (p: string | undefined, home: string): string => {
  if (!p) return "-"
  const h = home.endsWith("/") ? home.slice(0, -1) : home
  return p === h ? "~" : p.startsWith(h + "/") ? "~" + p.slice(h.length) : p
}

const NOTICE_SYMBOL: Record<string, string> = {
  commentsLost: "⚠",
  catalogWarning: "⚠",
  modelsCopied: "·",
  fallbackRewrite: "·",
}

function reportOutcome(o: FileOutcome, t: MergeCli, home: string): void {
  const file = basename(o.input)
  if (o.status === "failed") {
    const msg = o.message ? fmt(t[o.message.key], ...(o.message.args ?? [])) : t.unrecognized
    console.log(`✗ ${file} → ${msg}`)
    return
  }
  if (o.status === "skipped") {
    const msg = o.message ? fmt(t[o.message.key], ...(o.message.args ?? [])) : t.pasteOnly
    console.log(`- ${file} → ${msg}`)
    return
  }
  const target = displayPath(o.target, home)
  const changes = o.changes?.length ? `  (${t.changesLabel}: ${o.changes.join(", ")})` : ""
  if (o.status === "unchanged") {
    console.log(`= ${file} → ${target}  ${t.unchanged}`)
  } else {
    const label = o.status === "merged" ? t.mergedLabel : t.createdLabel
    const sym = o.status === "merged" ? "✓" : "+"
    console.log(`${sym} ${file} → ${label} ${target}${changes}`)
  }
  if (o.backupPath) console.log(`    ${t.backupLabel}: ${displayPath(o.backupPath, home)}`)
  for (const n of o.notices ?? []) {
    const symbol = NOTICE_SYMBOL[n.key] ?? "·"
    console.log(`    ${symbol} ${fmt(t[n.key], ...(n.args ?? []))}`)
  }
}

function printUsage(t: MergeCli): void {
  for (const line of t.usage) console.log(line)
}

function printRuleList(t: MergeCli, home: string, cwd: string): void {
  const base: TargetBase = { home, cwd, modelsDest: join(home, ".codex", "nous-models.json") }
  console.log(t.listHeader)
  for (const rule of RULES) {
    let note = ""
    if (rule.pasteOnly) note = ` (${t.listPasteOnly})`
    const cands = rule.targets(base)
    const created = rule.createPath?.(base) ?? null
    if (!rule.pasteOnly && cands.length === 0 && !created) note = ` (${t.listNeedTarget})`
    const primary = created ?? cands[0] ?? "-"
    console.log(`  ${rule.displayName}  [${rule.fileNames.join(", ")}]  → ${displayPath(primary, home)}${note}`)
  }
}

async function collectInputs(paths: string[], home: string): Promise<string[]> {
  const files: string[] = []
  for (const p of paths) {
    const full = expandTilde(p, home)
    const st = await statOrNull(full)
    if (st?.isDirectory()) {
      const glob = new Bun.Glob("*")
      for await (const name of glob.scan({ cwd: full, onlyFiles: true })) {
        if (KNOWN_NAMES.includes(normalizeName(name))) files.push(join(full, name))
      }
    } else {
      files.push(full)
    }
  }
  return [...new Set(files)]
}

export async function main(argv: string[]): Promise<number> {
  interface CliValues {
    target?: string
    "dry-run"?: boolean
    print?: boolean
    "no-backup"?: boolean
    "api-key"?: string
    "models-out"?: string
    list?: boolean
    lang?: string
    help?: boolean
  }
  let values: CliValues
  let positionals: string[]
  try {
    const parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        target: { type: "string", short: "t" },
        "dry-run": { type: "boolean", short: "n" },
        print: { type: "boolean" },
        "no-backup": { type: "boolean" },
        "api-key": { type: "string" },
        "models-out": { type: "string" },
        list: { type: "boolean", short: "l" },
        lang: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    })
    values = parsed.values
    positionals = parsed.positionals
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 1
  }

  const lang = pickLang(values.lang)
  const t = translations[lang].mergeCli
  const home = process.env.HOME ?? homedir()

  if (values.help) {
    printUsage(t)
    return 0
  }
  if (values.list) {
    printRuleList(t, home, process.cwd())
    return 0
  }

  let paths = positionals
  let scanned: string | null = null
  if (paths.length === 0) {
    const downloads = join(home, "Downloads")
    if (await isDir(downloads)) {
      paths = [downloads]
      scanned = downloads
    } else {
      printUsage(t)
      console.log(`✗ ${t.noExportFiles}`)
      return 1
    }
  }

  const files = await collectInputs(paths, home)
  if (files.length === 0) {
    if (scanned) console.log(`${t.scanning}: ${displayPath(scanned, home)}`)
    console.log(`✗ ${t.noExportFiles}`)
    return 1
  }
  if (values.target && files.length > 1) {
    console.log(`✗ ${t.multiTarget}`)
    return 1
  }

  if (scanned) console.log(`${t.scanning}: ${displayPath(scanned, home)}`)
  if (values["dry-run"] || values.print) console.log(`${t.dryRun}`)

  const opts: RunOptions = {
    target: values.target ? expandTilde(values.target, home) : undefined,
    dryRun: values["dry-run"] === true,
    print: values.print === true,
    backup: values["no-backup"] !== true,
    apiKey: values["api-key"],
    modelsOut: values["models-out"],
  }

  const outcomes = await runMerge(files, opts)
  for (const o of outcomes) reportOutcome(o, t, home)

  if (values.print) {
    for (const o of outcomes) {
      if (!o.output) continue
      console.log(`\n===== ${displayPath(o.target, home)} =====`)
      console.log(o.output.replace(/\n$/, ""))
    }
  }

  const count = (s: FileOutcome["status"]) => outcomes.filter((o) => o.status === s).length
  console.log(
    `${t.summary}: ${count("merged")} ${t.countMerged} · ${count("created")} ${t.countCreated} · ` +
      `${count("unchanged")} ${t.countUnchanged} · ${count("skipped")} ${t.countSkipped} · ` +
      `${count("failed")} ${t.countFailed}`,
  )

  return outcomes.length === 0 || outcomes.some((o) => o.status === "failed") ? 1 : 0
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2))
}
