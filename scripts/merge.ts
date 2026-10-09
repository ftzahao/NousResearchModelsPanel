#!/usr/bin/env bun
/**
 * One-command merge for files exported from the NousResearch dashboard.
 *
 *   bun run merge [file or directory ...] [options]
 *   deno run <remote-or-local>/merge.ts [file or directory ...] [options]
 *
 * Detects which exporter produced each file (by content, falling back to the
 * file name), resolves the tool's target config, parses both sides and splices
 * only the affected fragment into the target — comments and formatting
 * everywhere else stay byte-identical. Every result is re-parsed and
 * deep-compared against the expected merge before anything is written, and an
 * existing target is backed up to `<target>.bak` first.
 *
 * This file is self-contained so Deno can execute it directly from a remote
 * URL. Tests live in ./merge.test.ts.
 */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { basename, dirname, isAbsolute, join, resolve as resolvePath } from "node:path"
import { homedir } from "node:os"
import process from "node:process"
import { parseArgs } from "node:util"

type Lang = "zh" | "en"

const importModule = (specifier: string): Promise<any> => import(specifier)
const isDeno = Object.prototype.hasOwnProperty.call(globalThis, "Deno")

interface TextFormatModule {
  parse(text: string): unknown
  stringify(value: unknown): string
}

const formatModule = (loaded: any): TextFormatModule => {
  const source = typeof loaded?.parse === "function" ? loaded : loaded?.default
  if (typeof source?.parse !== "function" || typeof source?.stringify !== "function")
    throw new TypeError("Unsupported format module")
  return source
}

const yaml = formatModule(
  await importModule(isDeno ? "https://esm.sh/yaml@2.9.1" : "yaml"),
)
const toml = formatModule(
  await importModule(isDeno ? "https://esm.sh/smol-toml@1.9.1" : "smol-toml"),
)

export const MERGE_CLI_MESSAGES = {
  zh: {
    usage: [
      "用法: bun run merge | deno run <merge.ts> [文件或目录 ...] [选项]",
      "把面板导出的配置文件自动合并进对应工具的目标配置（写入前生成 .bak 备份）",
      "",
      "选项:",
      "  -t, --target <路径>      指定目标配置文件（仅支持单个输入文件）",
      "  -n, --dry-run           只预览合并结果，不写入文件",
      "      --print             输出合并后的完整文件内容（隐含 --dry-run）",
      "      --no-backup         不生成 .bak 备份",
      "      --api-key <key>     用真实 Key 替换导出文件中的占位符（如 YOUR_NOUS_API_KEY）",
      "      --models-out <路径> Codex models.json 的保存位置（默认 ~/.codex/nous-models.json）",
      "  -l, --list              列出支持的导出格式与默认目标路径",
      "      --lang <zh|en>      输出语言（默认跟随 LANG 环境变量）",
      "  -h, --help              显示帮助"
    ],
    scanning: "扫描目录",
    noExportFiles: "目录中没有找到可识别的导出文件",
    unrecognized: "无法识别为面板导出的文件",
    fileMissing: "文件不存在",
    targetLabel: "目标",
    mergedLabel: "已合并",
    createdLabel: "已创建",
    unchanged: "无变化（已是最新）",
    backupLabel: "备份",
    dryRun: "预演模式：未写入任何文件",
    pasteOnly: "该格式请在应用界面中粘贴导入，无需合并文件",
    needTarget: "未找到默认目标文件，请用 --target 指定（已尝试: %s）",
    parseExportFail: "导出文件解析失败",
    parseTargetFail: "目标文件解析失败",
    validateFail: "合并结果校验失败，未写入目标文件",
    sameFile: "源文件与目标文件相同，跳过",
    multiTarget: "--target 只能与单个输入文件一起使用",
    modelsCopied: "模型目录已保存",
    keptSecrets: "已保留目标文件中已有的 API Key",
    commentsLost: "被替换的片段含有注释，这些注释会丢失",
    fallbackRewrite: "文本定位失败，改为整文件重写",
    catalogWarning:
      "未找到 models.json，model_catalog_json 保留原占位符；请把 config.toml 和 models.json 一起传入",
    errShape: "结构不符合预期：%s",
    summary: "完成",
    countMerged: "合并",
    countCreated: "新建",
    countUnchanged: "无变化",
    countSkipped: "跳过",
    countFailed: "失败",
    changesLabel: "变更",
    listHeader: "支持的导出格式与默认目标路径",
    listNeedTarget: "需 --target 指定",
    listPasteOnly: "应用内导入，无文件合并"
  },
  en: {
    usage: [
      "Usage: bun run merge | deno run <merge.ts> [file or directory ...] [options]",
      "Automatically merges files exported from the dashboard into each tool's target config (writes a .bak backup first)",
      "",
      "Options:",
      "  -t, --target <path>      target config file (single input file only)",
      "  -n, --dry-run           preview the merge without writing",
      "      --print             print the merged file content (implies --dry-run)",
      "      --no-backup         do not create a .bak backup",
      "      --api-key <key>     replace placeholders in the export (e.g. YOUR_NOUS_API_KEY) with a real key",
      "      --models-out <path> where to save Codex models.json (default ~/.codex/nous-models.json)",
      "  -l, --list              list supported export formats and their default target paths",
      "      --lang <zh|en>      output language (defaults to LANG)",
      "  -h, --help              show help"
    ],
    scanning: "Scanning directory",
    noExportFiles: "No recognizable export files found in the directory",
    unrecognized: "Not recognized as a dashboard export file",
    fileMissing: "File not found",
    targetLabel: "Target",
    mergedLabel: "Merged",
    createdLabel: "Created",
    unchanged: "No changes (already up to date)",
    backupLabel: "Backup",
    dryRun: "Dry run: nothing was written",
    pasteOnly: "This format is imported by pasting in the app UI; no file merge needed",
    needTarget: "No default target file found; pass --target (tried: %s)",
    parseExportFail: "Failed to parse the export file",
    parseTargetFail: "Failed to parse the target file",
    validateFail: "Merged result failed validation; target file was not written",
    sameFile: "Source and target are the same file, skipped",
    multiTarget: "--target only works with a single input file",
    modelsCopied: "Model catalog saved",
    keptSecrets: "Kept the existing API key from the target file",
    commentsLost: "The replaced fragment contains comments; those comments will be lost",
    fallbackRewrite: "Could not locate text span; fell back to rewriting the whole file",
    catalogWarning:
      "models.json not found; model_catalog_json keeps its placeholder — pass config.toml and models.json together",
    errShape: "Unexpected structure: %s",
    summary: "Done",
    countMerged: "merged",
    countCreated: "created",
    countUnchanged: "unchanged",
    countSkipped: "skipped",
    countFailed: "failed",
    changesLabel: "Changes",
    listHeader: "Supported export formats and default target paths",
    listNeedTarget: "requires --target",
    listPasteOnly: "paste in app, no file merge"
  }
}

// ---------------------------------------------------------------------------
// types & messages
// ---------------------------------------------------------------------------

type MergeCli = {
  usage: readonly string[]
} & Record<Exclude<keyof (typeof MERGE_CLI_MESSAGES)["zh"], "usage">, string>
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

const fileExists = async (p: string): Promise<boolean> => {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function statOrNull(p: string) {
  try {
    return await stat(p)
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
  format: Format = "json"
): MergeResult {
  if (ctx.targetText === null) {
    return {
      text: serializeByFormat(merged, format, detectIndent(ctx.exportText)),
      merged,
      changes: [],
      notices
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
    return {
      text: serializeByFormat(merged, "json", detectIndent(ctx.exportText)),
      merged,
      changes: [],
      notices
    }
  if (deepEqual(ctx.targetParsed, merged))
    return { text: ctx.targetText, merged, changes: [], notices }
  if (hasJsonComments(ctx.targetText)) notices.push({ key: "commentsLost" })
  return {
    text: JSON.stringify(merged, null, detectIndent(ctx.targetText)) + "\n",
    merged,
    changes: ["[]"],
    notices
  }
}

function finishYaml(
  ctx: MergeContext,
  merged: unknown,
  run: (text: string, targetParsed: unknown, merged: unknown) => ReturnType<typeof spliceYamlKey>,
  notices: Notice[],
  changeLabel: string
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
// text splicing
// ---------------------------------------------------------------------------

export type Format = "json" | "yaml" | "toml"

/** What a splice did: replaced/inserted text, no-op, or fell back to a full rewrite. */
export type Action = "replace" | "insert" | "append" | "skip" | "rewrite"

export interface SpliceOutcome {
  text: string
  action: Action
  /** true when the replaced region contained comments that are now gone */
  commentLoss: boolean
}

export interface TomlSpliceOutcome extends SpliceOutcome {
  changes: string[]
}

/** A single targeted TOML edit: a top-level scalar or a whole `[table]` block. */
export type TomlOp =
  | { kind: "scalar"; key: string; value: unknown }
  | { kind: "table"; key: string; value: Record<string, unknown> }

/** Thrown when the target text cannot be spliced at the requested location. */
export class SpliceError extends Error {}

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((value, i) => deepEqual(value, b[i]))
  if (!isObj(a) || !isObj(b)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
  )
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function getAtPath(root: unknown, path: readonly string[]): unknown {
  let cur: unknown = root
  for (const key of path) {
    if (!isObj(cur)) return undefined
    cur = cur[key]
  }
  return cur
}

/** Column (0-based) of `idx`, counting from the preceding newline. */
export function colOf(text: string, idx: number): number {
  const nl = text.lastIndexOf("\n", idx - 1)
  return idx - nl - 1
}

export function detectIndent(text: string): string {
  const m = /\n([\t ]+)"/.exec(text)
  return m?.[1] ?? "  "
}

/** Does the text contain `//` or `/*` comments outside of string literals? */
export function hasJsonComments(text: string): boolean {
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      i++
      while (i < text.length) {
        if (text[i] === "\\") i += 2
        else if (text[i] === '"') {
          i++
          break
        } else i++
      }
      continue
    }
    if (c === "/" && text[i + 1] === "/") return true
    if (c === "/" && text[i + 1] === "*") return true
    i++
  }
  return false
}

/** YAML/TOML comment heuristic: `#` at line start or after whitespace. */
export const hasHashComments = (text: string): boolean => /(^|\s)#/m.test(text)

function stripJsonComments(text: string): string {
  let out = ""
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      const start = i
      i++
      while (i < text.length) {
        if (text[i] === "\\") i += 2
        else if (text[i] === '"') {
          i++
          break
        } else i++
      }
      out += text.slice(start, i)
      continue
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        out += " "
        i++
      }
      continue
    }
    if (c === "/" && text[i + 1] === "*") {
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        out += text[i] === "\n" ? "\n" : " "
        i++
      }
      if (i < text.length) {
        out += "  "
        i += 2
      }
      continue
    }
    out += c
    i++
  }
  return out
}

function stripTrailingJsonCommas(text: string): string {
  const chars = [...text]
  let inString = false
  let escaped = false
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === "\\") escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c !== ",") continue
    let j = i + 1
    while (j < chars.length && /\s/.test(chars[j]!)) j++
    if (chars[j] === "}" || chars[j] === "]") chars[i] = " "
  }
  return chars.join("")
}

export function parseJsonc(text: string): unknown {
  return JSON.parse(stripTrailingJsonCommas(stripJsonComments(text)))
}

export function tryParseJsonc(text: string): unknown {
  try {
    return parseJsonc(text)
  } catch {
    return undefined
  }
}

export function parseByFormat(text: string, format: Format): unknown {
  if (format === "yaml") return yaml.parse(text)
  if (format === "toml") return toml.parse(text)
  return parseJsonc(text)
}

const ensureNewline = (s: string): string => (s.endsWith("\n") ? s : s + "\n")

export function serializeByFormat(value: unknown, format: Format, indent = "  "): string {
  if (format === "yaml")
    return ensureNewline(yaml.stringify(value) ?? "")
  if (format === "toml") return ensureNewline(toml.stringify(value) ?? "")
  return JSON.stringify(value, null, indent) + "\n"
}

/**
 * Render `value` as JSON whose first line sits at the current cursor position
 * and whose remaining lines are indented to column `keyCol + indent`.
 */
function renderValue(value: unknown, keyCol: number, indent: string): string {
  const json = JSON.stringify(value, null, indent)
  if (!json.includes("\n")) return json
  const pad = " ".repeat(keyCol)
  return json
    .split("\n")
    .map((line, i) => (i === 0 || line === "" ? line : pad + line))
    .join("\n")
}

/** Skip whitespace plus `//` and `/*` comments starting at `i`. */
function skipWsComments(s: string, i: number): number {
  for (;;) {
    while (i < s.length && (s[i] === " " || s[i] === "\t" || s[i] === "\n" || s[i] === "\r")) i++
    if (s[i] === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++
      continue
    }
    if (s[i] === "/" && s[i + 1] === "*") {
      const end = s.indexOf("*/", i + 2)
      i = end === -1 ? s.length : end + 2
      continue
    }
    return i
  }
}

/** `i` points at the opening quote; returns the index after the closing quote. */
function scanJsonString(s: string, i: number): number {
  i++
  while (i < s.length) {
    const c = s[i]
    if (c === "\\") {
      i += 2
      continue
    }
    if (c === '"') return i + 1
    i++
  }
  return i
}

/** `i` points at the start of a value; returns the index right after it. */
function scanJsonValue(s: string, i: number): number {
  const c = s[i]
  if (c === '"') return scanJsonString(s, i)
  if (c === "{" || c === "[") {
    let depth = 0
    let j = i
    while (j < s.length) {
      const ch = s[j]
      if (ch === '"') {
        j = scanJsonString(s, j)
        continue
      }
      if (ch === "/" && (s[j + 1] === "/" || s[j + 1] === "*")) {
        j = skipWsComments(s, j)
        continue
      }
      if (ch === "{" || ch === "[") depth++
      else if (ch === "}" || ch === "]") {
        depth--
        if (depth === 0) return j + 1
      }
      j++
    }
    return j
  }
  let j = i
  while (j < s.length && !",}]\n/".includes(s[j] ?? "")) j++
  while (j > i && (s[j - 1] === " " || s[j - 1] === "\t" || s[j - 1] === "\r" || s[j - 1] === "\n"))
    j--
  return j
}

interface KeySpan {
  keyStart: number
  valueStart: number
  valueEnd: number
}

function findKeySpan(s: string, objStart: number, key: string): KeySpan | null {
  let i = skipWsComments(s, objStart + 1)
  while (i < s.length && s[i] !== "}") {
    if (s[i] === ",") {
      i = skipWsComments(s, i + 1)
      continue
    }
    if (s[i] !== '"') return null
    const keyStart = i
    const keyEnd = scanJsonString(s, i)
    let parsedKey: string
    try {
      parsedKey = JSON.parse(s.slice(keyStart, keyEnd))
    } catch {
      return null
    }
    const colon = skipWsComments(s, keyEnd)
    if (s[colon] !== ":") return null
    const valueStart = skipWsComments(s, colon + 1)
    const valueEnd = scanJsonValue(s, valueStart)
    if (parsedKey === key) return { keyStart, valueStart, valueEnd }
    i = skipWsComments(s, valueEnd)
  }
  return null
}

function detectRootKeyCol(s: string, rootStart: number, indent: string): number {
  const i = skipWsComments(s, rootStart + 1)
  return s[i] === '"' ? colOf(s, i) : indent.length
}

interface InsertStats {
  count: number
  lastValueEnd: number
  commaEnd: number
}

function scanObjectStats(s: string, objStart: number, close: number): InsertStats {
  const stats: InsertStats = { count: 0, lastValueEnd: -1, commaEnd: -1 }
  let i = skipWsComments(s, objStart + 1)
  while (i < close) {
    if (s[i] === ",") {
      i = skipWsComments(s, i + 1)
      continue
    }
    if (s[i] !== '"') break
    const keyEnd = scanJsonString(s, i)
    const colon = skipWsComments(s, keyEnd)
    if (s[colon] !== ":") break
    const valueStart = skipWsComments(s, colon + 1)
    const valueEnd = scanJsonValue(s, valueStart)
    stats.count++
    stats.lastValueEnd = valueEnd
    i = skipWsComments(s, valueEnd)
    if (s[i] === ",") {
      stats.commaEnd = i + 1
      i = skipWsComments(s, stats.commaEnd)
    } else {
      stats.commaEnd = -1
    }
  }
  return stats
}

function insertIntoObject(
  s: string,
  objStart: number,
  key: string,
  value: unknown,
  childrenCol: number,
  indent: string,
): string {
  const close = scanJsonValue(s, objStart) - 1
  if (s[close] !== "}") throw new SpliceError(`unbalanced object at ${objStart}`)
  const stats = scanObjectStats(s, objStart, close)
  const pad = " ".repeat(childrenCol)
  const entry = `${pad}${JSON.stringify(key)}: ${renderValue(value, childrenCol, indent)}`
  const closePad = " ".repeat(colOf(s, close))

  if (stats.count === 0) {
    const interior = s.slice(objStart + 1, close)
    const body = interior.replace(/[ \t]+$/, "")
    const lead = body === "" ? "\n" : body.endsWith("\n") ? "" : "\n"
    return s.slice(0, objStart + 1) + body + lead + entry + "\n" + closePad + s.slice(close)
  }

  const insertPos = stats.commaEnd !== -1 ? stats.commaEnd : stats.lastValueEnd
  const needsComma = stats.commaEnd === -1
  let mid = s.slice(insertPos, close)
  if (mid.trim() === "") mid = "\n"
  else if (!mid.endsWith("\n")) mid += "\n"
  return (
    s.slice(0, insertPos) + (needsComma ? "," : "") + mid + entry + "\n" + closePad + s.slice(close)
  )
}

function rewriteJson(merged: unknown, indent: string, original: string): SpliceOutcome {
  return {
    text: JSON.stringify(merged, null, indent) + "\n",
    action: "rewrite",
    commentLoss: hasJsonComments(original),
  }
}

export function spliceJsonPath(
  text: string,
  path: readonly string[],
  merged: unknown,
  indent: string,
): SpliceOutcome {
  const value = getAtPath(merged, path)
  if (value === undefined) throw new SpliceError(`missing merged value at ${path.join(".")}`)

  const rootStart = skipWsComments(text, 0)
  if (text[rootStart] !== "{") return rewriteJson(merged, indent, text)

  let container = rootStart
  let containerKeyCol: number | null = null
  const rootKeyCol = detectRootKeyCol(text, rootStart, indent)

  for (let d = 0; d < path.length; d++) {
    const seg = path[d]!
    const span = findKeySpan(text, container, seg)
    if (span) {
      const isLast = d === path.length - 1
      const subtree = isLast ? value : getAtPath(merged, path.slice(0, d + 1))
      if (subtree === undefined) throw new SpliceError(`missing merged value at ${path.join(".")}`)

      if (!isLast && text[span.valueStart] === "{") {
        container = span.valueStart
        containerKeyCol = colOf(text, span.keyStart)
        continue
      }
      const old = text.slice(span.valueStart, span.valueEnd)
      const current = tryParseJsonc(old)
      if (deepEqual(current, subtree)) return { text, action: "skip", commentLoss: false }
      const rendered = old.includes("\n")
        ? renderValue(subtree, colOf(text, span.keyStart), indent)
        : JSON.stringify(subtree)
      return {
        text: text.slice(0, span.valueStart) + rendered + text.slice(span.valueEnd),
        action: "replace",
        commentLoss: hasJsonComments(old),
      }
    }

    const subtree = getAtPath(merged, path.slice(0, d + 1))
    if (subtree === undefined) throw new SpliceError(`missing merged value at ${path.join(".")}`)
    const childrenCol = containerKeyCol === null ? rootKeyCol : containerKeyCol + indent.length
    return {
      text: insertIntoObject(text, container, seg, subtree, childrenCol, indent),
      action: "insert",
      commentLoss: false,
    }
  }
  throw new SpliceError(`unreachable path ${path.join(".")}`)
}

// ---------------------------------------------------------------------------
// YAML
// ---------------------------------------------------------------------------

function yamlBlockLines(key: string, value: unknown): string[] {
  const s = yaml.stringify({ [key]: value })
  return s
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "")
    .split("\n")
}

export function spliceYamlKey(
  text: string,
  key: string,
  targetParsed: unknown,
  merged: unknown,
): SpliceOutcome {
  const value = getAtPath(merged, [key])
  const current = isObj(targetParsed) ? targetParsed[key] : undefined
  if (deepEqual(current, value) && current !== undefined)
    return { text, action: "skip", commentLoss: false }

  const lines = text.split("\n")
  const plain = new RegExp(`^${escapeRegExp(key)}\\s*:`)
  const quoted = new RegExp(`^["']${escapeRegExp(key)}["']\\s*:`)
  const start = lines.findIndex((l) => plain.test(l) || quoted.test(l))

  if (start === -1) {
    if (current !== undefined)
      return {
        text: serializeByFormat(merged, "yaml"),
        action: "rewrite",
        commentLoss: hasHashComments(text),
      }
    const block = yamlBlockLines(key, value)
    const base = text.replace(/\s*$/, "")
    const head = base === "" ? "" : base.endsWith("\n") ? base : base + "\n"
    const sep = base === "" ? "" : "\n"
    return { text: head + sep + block.join("\n") + "\n", action: "append", commentLoss: false }
  }

  let boundary = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i] ?? ""
    if (l.trim() === "") continue
    if (/^\s/.test(l)) continue
    if (l.startsWith("#")) continue
    if (/^-(\s|$)/.test(l)) continue
    boundary = i
    break
  }
  let end = boundary
  while (end - 1 > start) {
    const prev = lines[end - 1] ?? ""
    if (prev.trim() === "" || prev.startsWith("#")) end--
    else break
  }

  const region = lines.slice(start, end).join("\n")
  const next = [...lines.slice(0, start), ...yamlBlockLines(key, value), ...lines.slice(end)]
  return {
    text: next.join("\n"),
    action: "replace",
    commentLoss: hasHashComments(region),
  }
}

export function spliceYamlRootArray(
  text: string,
  targetParsed: unknown,
  merged: unknown,
): SpliceOutcome {
  if (!Array.isArray(targetParsed)) throw new SpliceError("target is not a YAML sequence")
  if (deepEqual(targetParsed, merged)) return { text, action: "skip", commentLoss: false }

  const lines = text.split("\n")
  const block = yaml
    .stringify(merged)
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "")
    .split("\n")
  const start = lines.findIndex((l) => /^-(\s|$)/.test(l))

  if (start === -1) {
    let i = 0
    while (i < lines.length && (lines[i]!.trim() === "" || lines[i]!.startsWith("#"))) i++
    const kept = lines.slice(0, i)
    const mergedLines = [...kept, ...block]
    return {
      text: mergedLines.join("\n") + "\n",
      action: "replace",
      commentLoss: hasHashComments(lines.slice(i).join("\n")),
    }
  }

  let end = lines.length
  while (end - 1 > start) {
    const prev = lines[end - 1] ?? ""
    if (prev.trim() === "" || prev.startsWith("#")) end--
    else break
  }
  const region = lines.slice(start, end).join("\n")
  const next = [...lines.slice(0, start), ...block, ...lines.slice(end)]
  return {
    text: next.join("\n"),
    action: "replace",
    commentLoss: hasHashComments(region),
  }
}

// ---------------------------------------------------------------------------
// TOML
// ---------------------------------------------------------------------------

function tomlScalarLine(key: string, value: unknown): string {
  return toml.stringify({ [key]: value }).trim()
}

function tomlTableBlock(op: Extract<TomlOp, { kind: "table" }>): string[] | null {
  const wrapped = toml.stringify({ v: op.value })
  const lines = wrapped.split("\n")
  const body = lines.slice(1)
  while (body.length > 0 && body[body.length - 1] === "") body.pop()
  if (body.some((line) => /^\s*\[/.test(line))) return null
  return [`[${op.key}]`, ...body]
}

export function spliceToml(
  text: string,
  targetParsed: unknown,
  ops: readonly TomlOp[],
  merged: unknown,
): TomlSpliceOutcome {
  let lines = text.split("\n")
  const changes: string[] = []
  let commentLoss = false

  const topEnd = (): number => {
    const idx = lines.findIndex((line) => /^\s*\[/.test(line))
    return idx === -1 ? lines.length : idx
  }
  const findScalar = (key: string, from: number, to: number): number => {
    const re = new RegExp(`^(\\s*)${escapeRegExp(key)}\\s*=`)
    for (let i = from; i < to; i++) if (re.test(lines[i] ?? "")) return i
    return -1
  }

  for (const op of ops) {
    const parts = op.key.split(".")
    const current = getAtPath(targetParsed, parts)

    if (op.kind === "scalar") {
      if (op.value !== undefined && deepEqual(current, op.value)) continue
      const end = topEnd()
      const idx = findScalar(op.key, 0, end)
      if (op.value === undefined) {
        if (idx === -1) continue
        if (hasHashComments(lines[idx]!)) commentLoss = true
        lines.splice(idx, 1)
        changes.push(op.key)
        continue
      }
      const line = tomlScalarLine(op.key, op.value)
      if (idx !== -1) {
        if (hasHashComments(lines[idx]!)) commentLoss = true
        const indent = /^\s*/.exec(lines[idx]!)?.[0] ?? ""
        lines[idx] = indent + line
        changes.push(op.key)
      } else {
        let pos = 0
        for (let i = 0; i < end; i++) if (/^\s*\S+\s*=/.test(lines[i] ?? "")) pos = i + 1
        lines.splice(pos, 0, line)
        changes.push(op.key)
      }
      continue
    }

    if (deepEqual(current, op.value)) continue
    changes.push(`[${op.key}]`)
    const headerRe = new RegExp(`^\\s*\\[\\s*${escapeRegExp(op.key)}\\s*\\]\\s*(#.*)?$`)
    const idx = lines.findIndex((line) => headerRe.test(line))
    const block = tomlTableBlock(op)
    if (block === null) return rewriteTomlOutcome(text, merged, changes)

    if (idx === -1) {
      if (current !== undefined) return rewriteTomlOutcome(text, merged, changes)
      while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
      lines.push("", ...block)
      continue
    }
    let boundary = lines.length
    for (let i = idx + 1; i < lines.length; i++)
      if (/^\s*\[/.test(lines[i] ?? "")) {
        boundary = i
        break
      }
    let end = boundary
    while (end - 1 > idx) {
      const prev = lines[end - 1] ?? ""
      if (prev.trim() === "" || prev.trimStart().startsWith("#")) end--
      else break
    }
    const region = lines.slice(idx, end).join("\n")
    if (hasHashComments(region)) commentLoss = true
    lines = [...lines.slice(0, idx), ...block, ...lines.slice(end)]
  }

  return {
    text: lines.join("\n"),
    action: changes.length ? "replace" : "skip",
    commentLoss,
    changes,
  }
}

function rewriteTomlOutcome(
  text: string,
  merged: unknown,
  changes: string[],
): TomlSpliceOutcome {
  return {
    text: serializeByFormat(merged, "toml"),
    action: "rewrite",
    commentLoss: hasHashComments(text),
    changes,
  }
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
      notices: [{ key: "modelsCopied", args: [ctx.targetPath] }]
    })
  })

  // ---- Codex config.toml (both the direct and the Osaurus variant) ----
  list.push({
    id: "codex",
    displayName: "codex / codex-osaurus",
    fileNames: ["config.toml"],
    format: "toml",
    sniff: (p, f) =>
      f === "toml" &&
      isObj(p) &&
      typeof p.model_provider === "string" &&
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
        const targetFeatures =
          isObj(ctx.targetParsed) && isObj(ctx.targetParsed.features)
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
    }
  })

  // ---- ZCode ----
  list.push({
    id: "zcode",
    displayName: "ZCode",
    fileNames: ["zcode-provider-config.json"],
    format: "json",
    sniff: (p) =>
      isObj(p) &&
      p.schemaVersion === 1 &&
      isObj(p.config) &&
      isObj(asObj(p.config).providerConfigRules),
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
        ...eRules
      ]

      const tModelRules = listOf(tmc.providerModelRules)
      const modelRules = [
        ...tModelRules.filter((x) => !(isObj(x) && x.providerId === "nous")),
        ...listOf(emc.providerModelRules)
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
            manualProviderModelRules: manualRules
          }
        }
      }
      const paths: string[][] = [
        ["config", "providerOrder"],
        ["config", "providerConfigRules", "providerRules"],
        ["config", "modelConfigRules", "providerModelRules"]
      ]
      if (base.schemaVersion === undefined && exp.schemaVersion !== undefined)
        paths.push(["schemaVersion"])
      return applyJson(ctx, merged, paths, notices)
    }
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
      join(b.home, ".dsh", "settings.yaml")
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
          notices
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
        "llm-pi-ai"
      )
    }
  })

  // ---- DeepSeek Harness desktop cordis patch ----
  list.push({
    id: "dsh-patch",
    displayName: "DeepSeek Harness cordis.patch.yml",
    fileNames: ["dsh-desktop-cordis-patch.yml"],
    format: "yaml",
    sniff: (p) =>
      Array.isArray(p) &&
      p.some(
        (e) =>
          isObj(e) &&
          typeof e.id === "string" &&
          typeof e.name === "string" &&
          e.name.startsWith("@deepseek-ai/")
      ),
    targets: (b) => [
      join(b.home, ".dsh", "cordis.patch.yml"),
      join(b.home, ".dsh", "profiles", dshProfile(), "cordis.patch.yml")
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
        "[]"
      )
    }
  })

  // ---- LiteLLM ----
  list.push({
    id: "litellm",
    displayName: "LiteLLM",
    fileNames: ["litellm-config.yaml"],
    format: "yaml",
    sniff: (p) =>
      (Array.isArray(p) && isObj(p[0]) && "model_name" in p[0] && "litellm_params" in p[0]) ||
      (isObj(p) &&
        Array.isArray(p.model_list) &&
        isObj(p.model_list[0]) &&
        "litellm_params" in p.model_list[0]),
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
        const kept = list.filter(
          (x) => !isObj(x) || !String(x.model_name ?? "").startsWith("nous/")
        )
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
        return finishYaml(
          ctx,
          merged,
          (text, tp, m) => spliceYamlRootArray(text, tp, m),
          notices,
          "[]"
        )
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
        "model_list"
      )
    }
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
      "/usr/local/etc/cliproxyapi.conf"
    ],
    // no createPath: without an existing config we cannot know where the proxy reads from
    merge: (ctx) => {
      const notices: Notice[] = []
      const exp = ctx.exportParsed
      const entries =
        isObj(exp) && Array.isArray(exp["openai-compatibility"])
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
        "openai-compatibility"
      )
    }
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
        [opts.mapKey]: { ...tMap, nous: entry }
      }
      const addSchema =
        opts.schema !== undefined && base.$schema === undefined && exp.$schema !== undefined
      if (addSchema) merged.$schema = exp.$schema
      const paths: string[][] = [[opts.mapKey, "nous"]]
      if (addSchema) paths.push(["$schema"])
      return applyJson(ctx, merged, paths, notices)
    }
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
        isObj(p) && (p.$schema === MIMOCODE_EXPORT_SCHEMA || hasModelFieldWith(p, "modalities")),
      candidates: (b) => [join(xdgConfig(b.home), "mimocode", "mimocode.jsonc")]
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
      candidates: (b) => [
        join(xdgConfig(b.home), "opencode", "opencode.json"),
        join(b.cwd, "opencode.json")
      ]
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
      candidates: (b) => [join(xdgConfig(b.home), "crush", "crush.json"), join(b.cwd, "crush.json")]
    })
  )

  // ---- Zed ----
  list.push({
    id: "zed",
    displayName: "Zed",
    fileNames: ["zed-language-models.json"],
    format: "json",
    sniff: (p) =>
      isObj(p) && isObj(p.language_models) && isObj(asObj(p.language_models).openai_compatible),
    targets: (b) =>
      process.platform === "darwin"
        ? [
            join(b.home, "Library", "Application Support", "Zed", "settings.json"),
            join(b.home, ".config", "zed", "settings.json")
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
        language_models: { ...lm, openai_compatible: { ...oa, nous: entry } }
      }
      return applyJson(ctx, merged, [["language_models", "openai_compatible", "nous"]], notices)
    }
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
      join(xdgConfig(b.home), "CherryStudio", "settings.json")
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
        const list = [...providers.filter((x) => !(isObj(x) && x.id === entry.id)), entry]
        const merged = { ...base, data: { ...data, providers: list } }
        return applyJson(ctx, merged, [["data", "providers"]], notices)
      }
      const tProviders = asObj(providers)
      const old = tProviders.nous
      if (isObj(old)) preserveSecrets(entry, old)
      const merged = {
        ...base,
        data: { ...data, providers: { ...tProviders, nous: entry } }
      }
      return applyJson(ctx, merged, [["data", "providers", "nous"]], notices)
    }
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
        ...items
      ]
      return applyJsonRootArray(ctx, merged, notices)
    }
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
        Array.isArray(p) && isObj(p[0]) && "sdkMode" in p[0] && "limit" in p[0] && "baseUrl" in p[0]
    }),
    arrayRule({
      id: "copilot-lm",
      displayName: "GitHub Copilot chatLanguageModels",
      fileName: "chatLanguageModels.json",
      filterKey: "name",
      filterValue: "nous",
      matchKey: "name",
      sniff: (p) => Array.isArray(p) && isObj(p[0]) && p[0].vendor === "customendpoint"
    })
  )

  // ---- Chatbox: pasted into the app, nothing to merge ----
  list.push({
    id: "chatbox",
    displayName: "Chatbox",
    fileNames: ["chatbox-nous-provider.json"],
    format: "json",
    pasteOnly: true,
    sniff: (p) =>
      isObj(p) &&
      p.type === "openai" &&
      isObj(p.settings) &&
      typeof asObj(p.settings).apiHost === "string" &&
      "iconUrl" in p,
    targets: () => [],
    merge: () => {
      throw new MergeError({ key: "pasteOnly" })
    }
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
  ".toml": "toml"
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
  mode: "loose" | "strict" = "loose"
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
  inputPath: string
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
      outcomes.set(file, {
        input: file,
        status: "failed",
        message: { key: "fileMissing", args: [file] }
      })
      continue
    }
    const text = await readFile(file, "utf8")
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
    const text = await readFile(sibling, "utf8")
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
  modelsPath: string | undefined
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
    const raw = await readFile(targetPath, "utf8")
    if (raw.trim() !== "") {
      targetText = raw
      try {
        targetParsed = parseByFormat(raw, rule.format)
      } catch {
        return {
          ...span,
          status: "failed",
          target: targetPath,
          message: { key: "parseTargetFail" }
        }
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
      modelsPath
    })
  } catch (e) {
    if (e instanceof MergeError)
      return { ...span, status: "failed", target: targetPath, message: e.notice }
    if (e instanceof SpliceError)
      return {
        ...span,
        status: "failed",
        target: targetPath,
        message: { key: "errShape", args: [e.message] }
      }
    return {
      ...span,
      status: "failed",
      target: targetPath,
      message: { key: "errShape", args: [e instanceof Error ? e.message : String(e)] }
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
    await mkdir(dirname(targetPath), { recursive: true })
    if (opts.backup !== false && targetText !== null && !rule.noBackup) {
      backupPath = `${targetPath}.bak`
      await writeFile(backupPath, targetText, "utf8")
    }
    await writeFile(targetPath, result.text, "utf8")
    return {
      ...span,
      status,
      target: targetPath,
      backupPath,
      changes: result.changes,
      notices,
      written: true,
      output: opts.print ? result.text : undefined
    }
  }

  return {
    ...span,
    status,
    target: targetPath,
    changes: result.changes,
    notices,
    written: false,
    output: opts.print ? result.text : undefined
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
  fallbackRewrite: "·"
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
    console.log(
      `  ${rule.displayName}  [${rule.fileNames.join(", ")}]  → ${displayPath(primary, home)}${note}`
    )
  }
}

async function collectInputs(paths: string[], home: string): Promise<string[]> {
  const files: string[] = []
  for (const p of paths) {
    const full = expandTilde(p, home)
    const st = await statOrNull(full)
    if (st?.isDirectory()) {
      const entries = await readdir(full, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (KNOWN_NAMES.includes(normalizeName(entry.name))) files.push(join(full, entry.name))
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
        help: { type: "boolean", short: "h" }
      }
    })
    values = parsed.values
    positionals = parsed.positionals
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 1
  }

  const lang = pickLang(values.lang)
  const t = MERGE_CLI_MESSAGES[lang]
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
    modelsOut: values["models-out"]
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
      `${count("failed")} ${t.countFailed}`
  )

  return outcomes.length === 0 || outcomes.some((o) => o.status === "failed") ? 1 : 0
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2))
}
