#!/usr/bin/env bun
/**
 * One-command merge for files exported from the NousResearch dashboard.
 *
 *   bun run merge [file or directory ...] [options]
 *   bun run merge -p <program>=<model-id>[,<model-id>...] [options]
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
const BigNumber: any = (
  await importModule(isDeno ? "https://esm.sh/bignumber.js@11.1.5" : "bignumber.js")
).default

export const MERGE_CLI_MESSAGES = {
  zh: {
    usage: [
      "用法: bun run merge | deno run <merge.ts> [文件或目录 ...] [选项]",
      "把面板导出的配置文件自动合并进对应工具的目标配置（写入前生成 .bak 备份）",
      "一条命令（无需下载文件）：deno run --no-lock --reload=<merge.ts URL> --allow-read --allow-write --allow-env --allow-net <merge.ts> --one <程序=模型ID,...>",
      "",
      "选项:",
      "  -p, --program <程序=模型ID,...>  直接根据模型 ID 生成并合并（可重复，无需下载文件）",
      "      --one <程序=模型ID,...>  等价于 -p，用于一条命令完成生成与合并（无需下载文件）",
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
    listPasteOnly: "应用内导入，无文件合并",
    programSyntax: "参数格式应为 程序=模型ID[,模型ID...]：%s",
    unknownProgram: "未知程序：%s（用 --list 查看可用程序）",
    fetchModelsFail: "拉取上游模型列表失败：%s",
    unknownModel: "上游模型列表中没有这些模型 ID：%s",
    programsHeader: "可用程序（-p）",
    oneHeader: "一条命令（无需下载文件）",
    oneCopy: "复制命令",
    oneCopied: "已复制",
    needSelection: "请先选择模型，再复制命令",
    remoteNote: "运行时需要网络权限（--allow-net）拉取模型列表；--reload 确保每次都取最新的 merge.ts"
  },
  en: {
    usage: [
      "Usage: bun run merge | deno run <merge.ts> [file or directory ...] [options]",
      "Automatically merges files exported from the dashboard into each tool's target config (writes a .bak backup first)",
      "One command (no download): deno run --no-lock --reload=<merge.ts URL> --allow-read --allow-write --allow-env --allow-net <merge.ts> --one <prog=id,...>",
      "",
      "Options:",
      "  -p, --program <prog=id,...>  generate and merge straight from model IDs (repeatable; no download)",
      "      --one <prog=id,...>  same as -p, designed for the dashboard's one-command export: no file download",
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
    listPasteOnly: "paste in app, no file merge",
    programSyntax: "expected program=model-id[,model-id...]: %s",
    unknownProgram: "unknown program: %s (see --list)",
    fetchModelsFail: "failed to fetch the upstream model list: %s",
    unknownModel: "model IDs not found in the upstream list: %s",
    programsHeader: "Programs (-p)",
    oneHeader: "One command (no download)",
    oneCopy: "Copy command",
    oneCopied: "Copied",
    needSelection: "Select models first, then copy the command",
    remoteNote: "Requires network permission (--allow-net) to fetch the model list; --reload always re-fetches the latest merge.ts"
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
  /** exports generated in memory from `--program`, merged alongside file inputs */
  generated?: GeneratedExport[]
  cwd?: string
  home?: string
}

export interface GeneratedExport {
  /** virtual path (not read from disk) that names the export for detection and sibling lookup */
  file: string
  text: string
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
    /** single key, or [exportKey, targetKey] when the formats disagree */
    mapKey: string | [exportKey: string, targetKey: string]
    schema?: string
    sniff: (p: unknown) => boolean
    candidates: (b: TargetBase) => string[]
  }): Rule => {
    const [exportKey, targetKey] = Array.isArray(opts.mapKey) ? opts.mapKey : [opts.mapKey, opts.mapKey]
    return {
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
        if (!isObj(exp)) throw errShape(exportKey)
        const entry = exportNousEntry(exp, exportKey, "nous")
        const base = asObj(ctx.targetParsed)
        const tMap = child(base, targetKey)
        const oldEntry = tMap.nous
        if (isObj(oldEntry)) preserveSecrets(entry, oldEntry)
        const merged: Record<string, unknown> = {
          ...base,
          [targetKey]: { ...tMap, nous: entry }
        }
        const addSchema =
          opts.schema !== undefined && base.$schema === undefined && exp.$schema !== undefined
        if (addSchema) merged.$schema = exp.$schema
        const paths: string[][] = [[targetKey, "nous"]]
        if (addSchema) paths.push(["$schema"])
        return applyJson(ctx, merged, paths, notices)
      }
    }
  }

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
      // native v2 exports live under `providers`; v1 targets still use `provider`
      mapKey: ["providers", "providers"],
      schema: REF_EXPORT_SCHEMA,
      sniff: (p) =>
        isObj(p) &&
        (p.$schema === REF_EXPORT_SCHEMA ||
          (asObj(asObj(p.providers).nous).package === "aisdk:@ai-sdk/openai-compatible" &&
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
// exporters (copied from src/model-export; keep in sync — see merge.test.ts)
// ---------------------------------------------------------------------------

/** the string-valued keys of Model["pricing"], i.e. everything except overrides/original */
export type PriceField =
  | "prompt"
  | "completion"
  | "image"
  | "audio"
  | "input_cache_read"
  | "input_cache_write"
  | "input_cache_write_1h"
  | "web_search"
  | "internal_reasoning"

export interface Model {
  id: string
  name: string
  created: number
  description: string
  context_length: number
  architecture: {
    modality: string
    input_modalities: string[]
    output_modalities: string[]
    tokenizer: string
  }
  pricing: {
    prompt: string
    completion: string
    image?: string
    audio?: string
    input_cache_read?: string
    input_cache_write?: string
    input_cache_write_1h?: string
    web_search?: string
    internal_reasoning?: string
    overrides?: Array<{
      min_prompt_tokens?: number
      max_prompt_tokens?: number
      utc_days?: string[]
      utc_start?: number
      utc_end?: number
      prompt?: string
      completion?: string
      input_cache_read?: string
      input_cache_write?: string
    }>
    original?: {
      prompt?: string
      completion?: string
      image?: string
      audio?: string
      input_cache_read?: string
      input_cache_write?: string
      web_search?: string
      internal_reasoning?: string
    }
  }
  top_provider: {
    context_length: number
    max_completion_tokens: number
    is_moderated: boolean
  }
  supported_parameters: string[]
  benchmarks?: {
    artificial_analysis?: {
      intelligence_index?: number
      coding_index?: number
      agentic_index?: number
    }
    design_arena?: Array<{
      arena: string
      category: string
      elo: number
      win_rate: number
      rank: number
    }>
  }
  reasoning?: {
    mandatory: boolean
    default_enabled?: boolean
    supported_efforts: string[]
    default_effort: string
  }
  synthesizedFreeVariant?: boolean
  alias_target?: { name: string; slug: string }
  aliases?: string[]
}

// The exporters consume the same API models the dashboard renders, so this is an
// alias rather than a second hand-maintained copy of the response shape.
type ExportableModel = Model

export const GCMP_BASE_URL = "https://inference-api.nousresearch.com/v1"
export const GCMP_LIMIT = { rpm: 180, tpm: 720000 }
export const NOUS_API_HOST = "https://inference-api.nousresearch.com"
export const NOUS_API_KEY_ENV = "NOUS_API_KEY"

export const getContextWindow = (model: ExportableModel): number =>
  model.top_provider?.context_length ?? model.context_length ?? 0

// API prices are per-token; the tool configs below expect USD per 1M tokens
export const toPerMillion = (perToken: string) =>
  new BigNumber(perToken).times(1e6).decimalPlaces(6).toNumber()

export function deriveContextTokens(model: ExportableModel): {
  maxInputTokens: number
  maxOutputTokens: number
} {
  const contextWindow = getContextWindow(model)
  // reserve 1/8 of the context window for output, capped at the provider's max output
  const context = new BigNumber(contextWindow)
  const declaredMaxOutput = model.top_provider?.max_completion_tokens ?? 0
  const maxOutputTokens =
    contextWindow > 0
      ? BigNumber.min(context.dividedToIntegerBy(8), declaredMaxOutput || Infinity).toNumber()
      : 0
  const maxInputTokens = BigNumber.max(context.minus(maxOutputTokens), 0).toNumber()
  return { maxInputTokens, maxOutputTokens }
}

export const hasImageInput = (model: ExportableModel) =>
  model.architecture?.input_modalities?.includes("image") ?? false
export const isReasoningModel = (model: ExportableModel) =>
  (model.reasoning?.supported_efforts?.length ?? 0) > 0
export const supportsToolCalling = (model: ExportableModel) =>
  model.supported_parameters?.includes("tools") ?? false

export const pricingOf = (model: ExportableModel): Partial<Record<PriceField, string>> =>
  model.pricing ?? {}

// codex
export interface CodexReasoningLevel {
  effort: string
  description: string
}

export interface ModelCatalogEntry {
  slug: string
  display_name: string
  description: string
  context_window: number
  max_context_window: number
  input_modalities: string[]
  supported_in_api: boolean
  visibility: "list"
  shell_type: "unified_exec"
  priority: number
  truncation_policy: { mode: "tokens" | "bytes"; limit: number }
  default_reasoning_level: string
  supported_reasoning_levels: CodexReasoningLevel[]
  support_verbosity: false
  experimental_supported_tools: string[]
  model_messages: { instructions_template: string }
}

export interface ModelCatalog {
  models: ModelCatalogEntry[]
}

// Efforts accepted in the catalog JSON. Extends the official config enum ("max"/"ultra"
// are not valid model_reasoning_effort values) because some models do support them.
const CODEX_KNOWN_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]

// Efforts valid for the official model_reasoning_effort config key
const CODEX_CONFIG_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"]

// Codex's InputModality enum is closed (no unknown-value fallback), so anything outside
// this set fails the whole catalog parse
const CODEX_KNOWN_MODALITIES = ["text", "image", "audio"]

function buildCodexInputModalities(model: ExportableModel): string[] {
  const known = [...new Set(model.architecture?.input_modalities ?? [])].filter((modality) =>
    CODEX_KNOWN_MODALITIES.includes(modality)
  )
  // a dropped field defaults Codex to [text, image], so text-only models must say so explicitly
  return known.length ? known : ["text"]
}

const CODEX_EFFORT_DESCRIPTIONS: Record<string, string> = {
  minimal: "Minimal reasoning depth",
  low: "Fast responses with lighter reasoning",
  medium: "Balances speed and reasoning depth for everyday tasks",
  high: "Greater reasoning depth for complex problems",
  xhigh: "Extra high reasoning depth for complex problems",
  max: "Maximum reasoning depth for the hardest problems",
  ultra: "Maximum reasoning with automatic task delegation"
}

export const CODEX_MODEL_INSTRUCTIONS =
  "You are Codex, a coding agent powered by this model. You share a workspace with the user and collaborate until their goal is handled. Follow the repository's existing conventions, keep changes minimal and focused, and verify your work when possible."

export function buildModelCatalogJson(models: ExportableModel[]): ModelCatalog {
  return {
    models: models.map((model, index) => {
      const contextWindow = getContextWindow(model)
      const efforts = effectiveCodexEfforts(model)
      return {
        slug: model.id,
        display_name: model.name,
        description: model.description || model.name,
        context_window: contextWindow,
        max_context_window: contextWindow,
        input_modalities: buildCodexInputModalities(model),
        supported_in_api: true,
        visibility: "list" as const,
        shell_type: "unified_exec" as const,
        priority: index + 10,
        truncation_policy: { mode: "tokens" as const, limit: 10000 },
        default_reasoning_level: effectiveCodexDefaultEffort(model, efforts),
        supported_reasoning_levels: efforts.map((effort) => ({
          effort,
          description: CODEX_EFFORT_DESCRIPTIONS[effort] ?? `Reasoning level ${effort}`
        })),
        support_verbosity: false as const,
        experimental_supported_tools: [],
        model_messages: { instructions_template: CODEX_MODEL_INSTRUCTIONS }
      }
    })
  }
}

export const tomlString = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

// Effective reasoning effort: filtered to Codex's official enum, with the default inside it
export function effectiveCodexEfforts(model: ExportableModel): string[] {
  const knownEfforts = (model.reasoning?.supported_efforts ?? []).filter((effort) =>
    CODEX_KNOWN_EFFORTS.includes(effort)
  )
  return knownEfforts.length ? knownEfforts : ["medium"]
}

export function effectiveCodexDefaultEffort(model: ExportableModel, efforts: string[]): string {
  const requestedDefault = model.reasoning?.default_effort
  return requestedDefault && efforts.includes(requestedDefault)
    ? requestedDefault
    : (efforts[0] ?? "medium")
}

// The official model_reasoning_effort key only accepts up to xhigh. If the default is an
// extended effort (max/ultra), fall back to the highest official effort the model supports
// so the config stays parseable while the catalog still advertises max/ultra
export function configReasoningEffort(defaultEffort: string, efforts: string[]): string {
  if (CODEX_CONFIG_EFFORTS.includes(defaultEffort)) return defaultEffort
  const official = efforts.filter((effort) => CODEX_CONFIG_EFFORTS.includes(effort))
  return official.at(-1) ?? "xhigh"
}

export function buildCodexConfigToml(models: ExportableModel[]): string {
  const firstModel = models[0]
  const efforts = firstModel ? effectiveCodexEfforts(firstModel) : []
  const defaultEffort = firstModel ? effectiveCodexDefaultEffort(firstModel, efforts) : ""
  return `# Codex CLI config snippet for the Nous Research Inference API.
# Merge these settings into ~/.codex/config.toml, then point
# model_catalog_json below at the absolute path of the exported models.json.

model_provider = "nous"
model = "${tomlString(firstModel?.id ?? "")}"
model_reasoning_effort = "${tomlString(configReasoningEffort(defaultEffort, efforts))}"
model_catalog_json = "<PATH_TO_MODELS_JSON>"

# Follow the system proxy (Clash/Verge, corporate PAC, ...) for Codex's own
# outbound requests. Key is singular — the plural "respect_system_proxies"
# parses as an unknown feature and is silently ignored. Merge this key into an
# existing [features] table if you already have one.
[features]
respect_system_proxy = true

[model_providers.nous]
name = "Nous Research"
base_url = "${GCMP_BASE_URL}"
env_key = "NOUS_API_KEY"
env_key_instructions = "Set this to your Nous Research API key (portal.nousresearch.com)."
wire_api = "responses"
request_max_retries = 4
stream_max_retries = 5
stream_idle_timeout_ms = 600000
`
}

// codex-osaurus
// Osaurus serves every chat API from one local port (override with OSU_PORT) and
// forwards requests to the remote providers configured in its Management window.
export const OSAURUS_DEFAULT_PORT = 1337
export const OSAURUS_BASE_URL = `http://127.0.0.1:${OSAURUS_DEFAULT_PORT}/v1`

// Convention for the Nous Research remote provider in Osaurus: name it "nous",
// then its models are addressed as nous/<model-id> (e.g. nous/xiaomi/mimo-v2.6-flash).
export const OSAURUS_NOUS_PROVIDER = "nous"

export const osaurusModelId = (modelId: string) =>
  modelId.startsWith(`${OSAURUS_NOUS_PROVIDER}/`)
    ? modelId
    : `${OSAURUS_NOUS_PROVIDER}/${modelId}`

// Same catalog as the direct Codex export, but slugged the way Osaurus addresses
// remote models so /model switches keep matching the provider's model names.
export function buildCodexOsaurusModelCatalogJson(models: ExportableModel[]): ModelCatalog {
  const catalog = buildModelCatalogJson(models)
  return { models: catalog.models.map((entry) => ({ ...entry, slug: osaurusModelId(entry.slug) })) }
}

export function buildCodexOsaurusConfigToml(models: ExportableModel[]): string {
  const firstModel = models[0]
  const efforts = firstModel ? effectiveCodexEfforts(firstModel) : []
  const defaultEffort = firstModel ? effectiveCodexDefaultEffort(firstModel, efforts) : ""
  const modelId = firstModel ? osaurusModelId(firstModel.id) : ""
  return `# Codex CLI config snippet routed through the local Osaurus proxy.
# Prerequisite: Osaurus is running with a Remote Provider for the Nous Research
# Inference API (Management window -> Cloud Models -> Add Provider -> Custom,
# host inference-api.nousresearch.com, base path /v1, provider name "nous",
# key stored in Keychain) — its models are then addressed as nous/<model-id>.
# Merge these settings into ~/.codex/config.toml, then point
# model_catalog_json below at the absolute path of the exported models.json.

model_provider = "osaurus"
model = "${tomlString(modelId)}"
model_reasoning_effort = "${tomlString(configReasoningEffort(defaultEffort, efforts))}"
model_catalog_json = "<PATH_TO_MODELS_JSON>"

# Follow the system proxy (Clash/Verge, corporate PAC, ...) for Codex's own
# outbound requests. Key is singular — the plural "respect_system_proxies"
# parses as an unknown feature and is silently ignored. Merge this key into an
# existing [features] table if you already have one.
[features]
respect_system_proxy = true

[model_providers.osaurus]
name = "Osaurus"
base_url = "${OSAURUS_BASE_URL}"
wire_api = "responses"
request_max_retries = 4
stream_max_retries = 5
stream_idle_timeout_ms = 600000
# Loopback calls need no credential: Codex talks to Osaurus without a key and
# Osaurus authenticates upstream with the key from its Keychain. If your Osaurus
# server requires an access key, uncomment the next line and export it:
# env_key = "OSAURUS_API_KEY"
`
}

// gcmp
export interface GcmpCompatibleModelEntry {
  baseUrl: string
  capabilities: { imageInput: boolean; toolCalling: boolean }
  contextWindow: number
  endpoint: string
  id: string
  limit: { rpm: number; tpm: number }
  maxInputTokens: number
  maxOutputTokens: number
  model: string
  modelsEndpoint: string
  name: string
  provider: string
  reasoningEffort?: string[]
  sdkMode: string
  tokenPricing?: { USD: number[] }
  tooltip?: string
}

export function buildGcmpCompatibleModels(models: ExportableModel[]): GcmpCompatibleModelEntry[] {
  return models.map((model) => {
    const contextWindow = getContextWindow(model)
    const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
    const pricing: Partial<Record<PriceField, string>> = model.pricing ?? {}
    const promptPrice = pricing.prompt != null ? toPerMillion(pricing.prompt) : 0
    const completionPrice = pricing.completion != null ? toPerMillion(pricing.completion) : 0
    const usd: number[] = [promptPrice, completionPrice]
    if (pricing.input_cache_read != null) usd.push(toPerMillion(pricing.input_cache_read))
    if (pricing.input_cache_write != null) usd.push(toPerMillion(pricing.input_cache_write))
    return {
      baseUrl: GCMP_BASE_URL,
      capabilities: {
        imageInput: model.architecture?.input_modalities?.includes("image") ?? false,
        toolCalling: model.supported_parameters?.includes("tools") ?? false
      },
      contextWindow,
      endpoint: "/chat/completions",
      id: model.id,
      limit: GCMP_LIMIT,
      maxInputTokens,
      maxOutputTokens,
      model: model.id,
      modelsEndpoint: "/models",
      name: model.name,
      provider: "nous",
      ...(model.reasoning?.supported_efforts?.length
        ? { reasoningEffort: model.reasoning.supported_efforts }
        : {}),
      sdkMode: "openai",
      ...(promptPrice || completionPrice ? { tokenPricing: { USD: usd } } : {}),
      ...(model.description ? { tooltip: model.description } : {})
    }
  })
}

// github-copilot
export interface GithubCopilotLanguageModelEntry {
  id: string
  name: string
  url: string
  toolCalling: boolean
  vision: boolean
  maxInputTokens: number
  maxOutputTokens: number
  thinking?: boolean
  supportsReasoningEffort?: string[]
}

export interface GithubCopilotLanguageModelsProvider {
  name: string
  vendor: "customendpoint"
  apiType: "chat-completions"
  apiKey: string
  models: GithubCopilotLanguageModelEntry[]
}

export function buildGithubCopilotLanguageModels(
  models: ExportableModel[]
): GithubCopilotLanguageModelsProvider[] {
  return [
    {
      name: "nous",
      vendor: "customendpoint",
      apiType: "chat-completions",
      apiKey: "${input:nousApiKey}",
      models: models.map((model) => {
        const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
        const efforts = model.reasoning?.supported_efforts
        return {
          id: model.id,
          name: model.name,
          url: `${GCMP_BASE_URL}/chat/completions`,
          toolCalling: model.supported_parameters?.includes("tools") ?? false,
          vision: model.architecture?.input_modalities?.includes("image") ?? false,
          maxInputTokens,
          maxOutputTokens,
          ...(efforts?.length ? { thinking: true, supportsReasoningEffort: efforts } : {})
        }
      })
    }
  ]
}

// zcode
export interface ZcodeInputFormat {
  supportsText: boolean
  supportsImage: boolean
  supportsVideo: boolean
  supportsAudio: boolean
  supportsPdf: boolean
}

export interface ZcodeModelProperties {
  contextWindow?: number
  inputFormat: ZcodeInputFormat
  outputFormat: { supportsText: boolean }
  supportsToolCall: boolean
  supportsJsonSchemaOutput: boolean
  supportsNativeWebSearch: boolean
}

export interface ZcodeModelOptionSpecs {
  maxOutputTokens?: { max: number; map: string }
  reasoningLevel?: { values: string[]; map: string }
}

export interface ZcodeModelConfig {
  enabled: true
  properties: ZcodeModelProperties
  optionSpecs?: ZcodeModelOptionSpecs
}

export interface ZcodeModelRule {
  modelId: string
  providerId: string
  config: ZcodeModelConfig
}

export interface ZcodeProviderRule {
  providerId: string
  providerName: string
  config: {
    group: "standard-personal"
    access: { type: "api-key"; apiKey: string; apiKeyManagementUrl?: string }
    api: { type: "openai-chat-completions"; baseUrl: string }
    personalModelIds: string[]
    modelOrder: string[]
  }
}

export interface ZcodeConfig {
  schemaVersion: 1
  config: {
    providerOrder: string[]
    providerConfigRules: { providerRules: ZcodeProviderRule[] }
    modelConfigRules: {
      providerModelRules: ZcodeModelRule[]
      manualProviderModelRules: []
    }
  }
}

// fixed id so every export replaces the same provider entry in ~/.zcode/v2/provider_config.json;
// "builtin:" / "account:" prefixes are reserved for ZCode's own providers
// schema is the open-source client's zod contracts: packages/provider/src/config/rule-data-schema.ts
// and packages/shared/src/model-config.ts in https://github.com/zai-org/ZCode
const ZCODE_PROVIDER_ID = "nous"
// ZCode's reasoningLevel option vocabulary (from the bundled provider catalog);
// values must be sorted by ascending semantic strength
const ZCODE_KNOWN_LEVELS = ["disabled", "none", "minimal", "low", "medium", "high", "xhigh", "max"]
// ZCode's default openai-chat-completions map sends max_completion_tokens; the Nous gateway wants max_tokens
const ZCODE_MAX_TOKENS_MAP = "{'max_tokens': maxOutputTokens}"
const ZCODE_REASONING_MAP = '{"reasoning_effort": reasoningLevel}'
// Nous Portal is where inference API keys are managed; ZCode's settings UI links to it
const NOUS_API_KEY_MANAGEMENT_URL = "https://portal.nousresearch.com"

function buildZcodeReasoningValues(efforts: string[] | undefined): string[] {
  const values = new Set<string>()
  for (const effort of efforts ?? []) {
    const level = effort.toLowerCase()
    if (ZCODE_KNOWN_LEVELS.includes(level)) values.add(level)
  }
  // ZCode's schema expects values ordered from weakest to strongest
  return ZCODE_KNOWN_LEVELS.filter((level) => values.has(level))
}

export function buildZcodeConfig(models: ExportableModel[]): ZcodeConfig {
  const modelIds = models.map((model) => model.id)
  return {
    schemaVersion: 1,
    config: {
      providerOrder: [ZCODE_PROVIDER_ID],
      providerConfigRules: {
        providerRules: [
          {
            providerId: ZCODE_PROVIDER_ID,
            providerName: ZCODE_PROVIDER_ID,
            config: {
              group: "standard-personal",
              access: {
                type: "api-key",
                apiKey: "${input:nousApiKey}",
                apiKeyManagementUrl: NOUS_API_KEY_MANAGEMENT_URL
              },
              api: { type: "openai-chat-completions", baseUrl: GCMP_BASE_URL },
              personalModelIds: modelIds,
              modelOrder: modelIds
            }
          }
        ]
      },
      modelConfigRules: {
        providerModelRules: models.map((model) => {
          const contextWindow = getContextWindow(model)
          const { maxOutputTokens } = deriveContextTokens(model)
          const inputModalities = model.architecture?.input_modalities?.length
            ? model.architecture.input_modalities
            : ["text"]
          const outputModalities = model.architecture?.output_modalities?.length
            ? model.architecture.output_modalities
            : ["text"]
          const parameters = model.supported_parameters ?? []
          const reasoningValues = buildZcodeReasoningValues(model.reasoning?.supported_efforts)
          const optionSpecs: ZcodeModelOptionSpecs = {
            ...(reasoningValues.length
              ? { reasoningLevel: { values: reasoningValues, map: ZCODE_REASONING_MAP } }
              : {}),
            ...(maxOutputTokens > 0
              ? { maxOutputTokens: { max: maxOutputTokens, map: ZCODE_MAX_TOKENS_MAP } }
              : {})
          }
          return {
            modelId: model.id,
            config: {
              enabled: true as const,
              properties: {
                ...(contextWindow > 0 ? { contextWindow } : {}),
                inputFormat: {
                  supportsText: inputModalities.includes("text"),
                  supportsImage: inputModalities.includes("image"),
                  supportsVideo: inputModalities.includes("video"),
                  supportsAudio: inputModalities.includes("audio"),
                  // the API's "file" modality covers document uploads such as PDFs
                  supportsPdf: inputModalities.includes("file")
                },
                outputFormat: { supportsText: outputModalities.includes("text") },
                supportsToolCall: supportsToolCalling(model),
                supportsJsonSchemaOutput: parameters.includes("structured_outputs"),
                supportsNativeWebSearch: parameters.includes("web_search_options")
              },
              ...(Object.keys(optionSpecs).length ? { optionSpecs } : {})
            },
            providerId: ZCODE_PROVIDER_ID
          }
        }),
        manualProviderModelRules: []
      }
    }
  }
}

// dsh
export type DshModality = "text" | "image"

export interface DshModelProfile {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
  input?: DshModality[]
  reasoningEfforts?: false | Record<string, string | null>
}

export interface DshProviderProfile {
  displayName: string
  apiKeyEnv: string
  api: "openai-completions"
  baseURL: string
  compat: { supportsDeveloperRole: false; maxTokensField: "max_tokens" }
  models: DshModelProfile[]
}

export interface DshSettings {
  "llm-pi-ai": { providers: Record<string, DshProviderProfile> }
}

// fixed route id so every export replaces the same provider instead of duplicating it
export const DSH_PROVIDER_ID = "nous"
export const DSH_API_KEY_ENV = "NOUS_API_KEY"
// the pi-ai loader entry both DSH surfaces (settings.yaml and the desktop profile patch) target
export const DSH_LLM_PI_AI_ID = "llm-pi-ai"

// pi-ai only accepts its own level names as reasoningEfforts keys and rejects the whole section otherwise
const DSH_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"]
// the API calls the level that turns thinking off "none"; pi-ai calls it "off"
const DSH_EFFORT_ALIASES: Record<string, string> = { none: "off" }

function buildDshReasoningEfforts(efforts: string[] | undefined) {
  const declared = new Map<string, string>()
  for (const effort of efforts ?? []) {
    const level = DSH_EFFORT_ALIASES[effort] ?? effort
    if (!DSH_THINKING_LEVELS.includes(level)) continue
    // the value is the wire spelling dispatch sends when that level is picked
    declared.set(level, effort)
  }
  if (declared.size === 0) return undefined
  // reasoningEfforts must offer a level beyond "off"; "off" alone is not a reasoning model
  if ([...declared.keys()].every((level) => level === "off")) return false
  return Object.fromEntries(declared) as Record<string, string | null>
}

export function buildDshProviderProfile(models: ExportableModel[]): DshProviderProfile {
  return {
    displayName: "nous",
    apiKeyEnv: DSH_API_KEY_ENV,
    api: "openai-completions",
    baseURL: GCMP_BASE_URL,
    // pi-ai treats an unrecognized gateway URL as plain OpenAI; these are the docs' first corrections
    compat: { supportsDeveloperRole: false, maxTokensField: "max_tokens" },
    models: models.map((model) => {
      const contextWindow = getContextWindow(model)
      const { maxOutputTokens } = deriveContextTokens(model)
      const input = (model.architecture?.input_modalities ?? []).filter(
        (modality): modality is DshModality => modality === "text" || modality === "image"
      )
      const reasoningEfforts = buildDshReasoningEfforts(model.reasoning?.supported_efforts)
      const entry: DshModelProfile = {
        id: model.id,
        name: model.name,
        contextWindow,
        maxTokens: maxOutputTokens,
        // only images need declaring: text is the route's default input
        ...(input.includes("image") ? { input } : {}),
        ...(reasoningEfforts === undefined ? {} : { reasoningEfforts })
      }
      return entry
    })
  }
}

export function buildDshProviderConfig(models: ExportableModel[]): DshSettings {
  return {
    [DSH_LLM_PI_AI_ID]: {
      providers: {
        [DSH_PROVIDER_ID]: buildDshProviderProfile(models)
      }
    }
  }
}

// dsh-desktop
// the desktop app composes its config from a profile, and a profile's user layer is a
// cordis.patch.yml: a top-level YAML array of id-targeted patch entries applied after the
// bundle layers, so one entry of exactly this shape is what the desktop app mounts.
export interface DshDesktopPatchEntry {
  id: typeof DSH_LLM_PI_AI_ID
  name: string
  config: { providers: Record<string, DshProviderProfile> }
}

// `name` must be the bundling package, otherwise the patch targets no entry and only
// prints a stderr warning at boot
const DSH_DESKTOP_PATCH_PACKAGE = "@deepseek-ai/dsh-llm-pi-ai"

export function buildDshDesktopPatch(models: ExportableModel[]): DshDesktopPatchEntry[] {
  return [
    {
      id: DSH_LLM_PI_AI_ID,
      name: DSH_DESKTOP_PATCH_PACKAGE,
      config: {
        providers: {
          [DSH_PROVIDER_ID]: buildDshProviderProfile(models)
        }
      }
    }
  ]
}

// litellm
// ---- LiteLLM (proxy config.yaml) ----

export interface LitellmModelEntry {
  model_name: string
  litellm_params: {
    model: string
    api_base: string
    api_key: string
  }
}

export function buildLitellmConfig(models: ExportableModel[]): LitellmModelEntry[] {
  return models.map((model) => ({
    model_name: `nous/${model.id}`,
    litellm_params: {
      model: `openai/${model.id}`,
      api_base: GCMP_BASE_URL,
      api_key: `os.environ/${NOUS_API_KEY_ENV}`
    }
  }))
}

// cliproxyapi
// ---- CLIProxyAPI (config.yaml openai-compatibility fragment) ----

export type CliproxyapiModality = "text" | "image"

export interface CliproxyapiApiKeyEntry {
  "api-key": string
}

export interface CliproxyapiModelEntry {
  name: string
  alias: string
  "display-name"?: string
  "max-context-length"?: number
  "input-modalities"?: CliproxyapiModality[]
  "output-modalities"?: CliproxyapiModality[]
  thinking?: { levels: string[] }
}

export interface CliproxyapiProviderEntry {
  name: string
  "base-url": string
  "api-key-entries": CliproxyapiApiKeyEntry[]
  models: CliproxyapiModelEntry[]
  headers: Record<string, string>
}

export interface CliproxyapiConfig {
  "openai-compatibility": CliproxyapiProviderEntry[]
}

// fixed provider name so every export replaces the same openai-compatibility entry
const CLIPROXYAPI_PROVIDER_NAME = "nous"
// CLIProxyAPI reads provider api keys as literal config values (no env expansion),
// so the export ships a placeholder the user replaces
const CLIPROXYAPI_API_KEY_PLACEHOLDER = "YOUR_NOUS_API_KEY"

// openai-compatibility only understands text/image modalities; video, file, audio and embeddings are dropped
const CLIPROXYAPI_KNOWN_MODALITIES = ["text", "image"]
// thinking level vocabulary from CLIProxyAPI's internal/thinking; undeclared levels fail request validation
const CLIPROXYAPI_KNOWN_LEVELS = [
  "none",
  "auto",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max"
]

function buildCliproxyapiModalities(raw: string[] | undefined): CliproxyapiModality[] {
  const known = [...new Set(raw ?? [])].filter((modality): modality is CliproxyapiModality =>
    CLIPROXYAPI_KNOWN_MODALITIES.includes(modality)
  )
  return known.length ? known : ["text"]
}

function buildCliproxyapiThinkingLevels(efforts: string[] | undefined): string[] {
  const levels = new Set<string>()
  for (const effort of efforts ?? []) {
    const level = effort.toLowerCase()
    if (CLIPROXYAPI_KNOWN_LEVELS.includes(level)) levels.add(level)
  }
  return [...levels]
}

export function buildCliproxyapiConfig(models: ExportableModel[]): CliproxyapiConfig {
  return {
    "openai-compatibility": [
      {
        name: CLIPROXYAPI_PROVIDER_NAME,
        "base-url": GCMP_BASE_URL,
        "api-key-entries": [{ "api-key": CLIPROXYAPI_API_KEY_PLACEHOLDER }],
        headers: {
          "User-Agent": "HermesAgent/0.21.7",
          Authorization: "Bearer " + CLIPROXYAPI_API_KEY_PLACEHOLDER
        },
        models: models.map((model) => {
          const contextWindow = getContextWindow(model)
          const outputModalities = buildCliproxyapiModalities(model.architecture?.output_modalities)
          const levels = buildCliproxyapiThinkingLevels(model.reasoning?.supported_efforts)
          return {
            name: model.id,
            // empty alias: CPA falls back to the upstream name, so the client-visible id is unchanged
            alias: "",
            ...(model.name ? { "display-name": model.name } : {}),
            ...(contextWindow > 0 ? { "max-context-length": contextWindow } : {}),
            "input-modalities": buildCliproxyapiModalities(model.architecture?.input_modalities),
            // text is the default output; only image-producing models need declaring
            ...(outputModalities.includes("image")
              ? { "output-modalities": outputModalities }
              : {}),
            ...(levels.length ? { thinking: { levels } } : {})
          }
        })
      }
    ]
  }
}

// opencode
// ---- OpenCode (opencode.json, native v2 shape) ----
// Field names per https://opencode.ai/v2/docs/providers/ and the V1→V2
// migration guide: provider→providers, npm→package (with the aisdk: prefix),
// options→settings, tool_call/attachment→capabilities. V1's reasoning,
// attachment, and tool_call flags are ignored by v2 with a warning, so the
// export no longer emits them.

export type OpencodeModality = "text" | "image"

export interface OpencodeModelCapabilities {
  tools: boolean
  input: OpencodeModality[]
  output: OpencodeModality[]
}

export interface OpencodeModelEntry {
  name: string
  limit: { context: number; input: number; output: number }
  capabilities: OpencodeModelCapabilities
}

export interface OpencodeProviderEntry {
  package: "aisdk:@ai-sdk/openai-compatible"
  name: string
  settings: { baseURL: string; apiKey: string }
  models: Record<string, OpencodeModelEntry>
}

export interface OpencodeConfig {
  $schema: string
  providers: Record<string, OpencodeProviderEntry>
}

// v2 always writes capabilities, so fall back to text-only output
const buildCapabilities = (model: ExportableModel): OpencodeModelCapabilities => {
  const inputDeclared = model.architecture?.input_modalities ?? []
  const outputDeclared = model.architecture?.output_modalities ?? []
  const pick = (declared: string[]) =>
    (["text", "image"] as const).filter((modality) => declared.includes(modality))
  const input = pick(inputDeclared)
  const output = pick(outputDeclared)
  return {
    tools: supportsToolCalling(model),
    input: input.length > 0 ? input : ["text"],
    output: output.length > 0 ? output : ["text"]
  }
}

export function buildOpencodeConfig(models: ExportableModel[]): OpencodeConfig {
  const modelEntries = Object.fromEntries(
    models.map((model) => {
      const contextWindow = getContextWindow(model)
      const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
      const entry: OpencodeModelEntry = {
        name: model.name,
        limit: { context: contextWindow, input: maxInputTokens, output: maxOutputTokens },
        capabilities: buildCapabilities(model)
      }
      return [model.id, entry]
    })
  )
  return {
    $schema: "https://opencode.ai/config.json",
    providers: {
      nous: {
        package: "aisdk:@ai-sdk/openai-compatible",
        name: "nous",
        settings: {
          baseURL: GCMP_BASE_URL,
          apiKey: "{env:NOUS_API_KEY}"
        },
        models: modelEntries
      }
    }
  }
}

// crush
// ---- Crush (crush.json) ----

export interface CrushModelEntry {
  id: string
  name: string
  context_window: number
  default_max_tokens: number
  cost_per_1m_in: number
  cost_per_1m_out: number
  cost_per_1m_in_cached: number
  cost_per_1m_out_cached: number
  can_reason: boolean
  supports_attachments: boolean
}

export interface CrushProviderEntry {
  id: string
  name: string
  type: "openai"
  base_url: string
  api_key: string
  models: CrushModelEntry[]
}

export interface CrushConfig {
  $schema: string
  providers: Record<string, CrushProviderEntry>
}

export function buildCrushConfig(models: ExportableModel[]): CrushConfig {
  return {
    $schema: "https://charm.land/crush.json",
    providers: {
      nous: {
        id: "nous",
        name: "nous",
        type: "openai",
        base_url: GCMP_BASE_URL,
        api_key: `$${NOUS_API_KEY_ENV}`,
        models: models.map((model) => {
          const pricing: Partial<Record<PriceField, string>> = model.pricing ?? {}
          const contextWindow = getContextWindow(model)
          const { maxOutputTokens } = deriveContextTokens(model)
          return {
            id: model.id,
            name: model.name,
            context_window: contextWindow,
            default_max_tokens: maxOutputTokens,
            // all four cost fields are schema-required; cache-write has no API price
            cost_per_1m_in: pricing.prompt != null ? toPerMillion(pricing.prompt) : 0,
            cost_per_1m_out: pricing.completion != null ? toPerMillion(pricing.completion) : 0,
            cost_per_1m_in_cached:
              pricing.input_cache_read != null ? toPerMillion(pricing.input_cache_read) : 0,
            cost_per_1m_out_cached: 0,
            can_reason: isReasoningModel(model),
            supports_attachments: hasImageInput(model)
          }
        })
      }
    }
  }
}

// chatbox
// ---- Chatbox (one-click provider import) ----

export type ChatboxCapability = "vision" | "reasoning" | "tool_use"

export interface ChatboxModelEntry {
  modelId: string
  nickname: string
  type: "chat"
  capabilities?: ChatboxCapability[]
  contextWindow?: number
  maxOutput?: number
}

export interface ChatboxProviderConfig {
  id: string
  name: string
  type: "openai"
  iconUrl: string
  urls: { website: string }
  settings: {
    apiHost: string
    models: ChatboxModelEntry[]
  }
}

export function buildChatboxProviderConfig(models: ExportableModel[]): ChatboxProviderConfig {
  return {
    id: "nous",
    name: "nous",
    type: "openai",
    iconUrl: "https://nousresearch.com/favicon.ico",
    urls: { website: "https://nousresearch.com" },
    settings: {
      // chatbox appends /v1/chat/completions itself, so no /v1 here
      apiHost: NOUS_API_HOST,
      models: models.map((model) => {
        const contextWindow = getContextWindow(model)
        const { maxOutputTokens } = deriveContextTokens(model)
        const capabilities: ChatboxCapability[] = []
        if (hasImageInput(model)) capabilities.push("vision")
        if (isReasoningModel(model)) capabilities.push("reasoning")
        if (supportsToolCalling(model)) capabilities.push("tool_use")
        return {
          modelId: model.id,
          nickname: model.name,
          type: "chat",
          ...(capabilities.length ? { capabilities } : {}),
          ...(contextWindow ? { contextWindow } : {}),
          ...(maxOutputTokens ? { maxOutput: maxOutputTokens } : {})
        }
      })
    }
  }
}

// cherry-studio
// ---- Cherry Studio (provider entry for settings.json data.providers) ----

export type CherryStudioCapability = "vision" | "reasoning" | "function_calling"

export interface CherryStudioModelEntry {
  id: string
  name: string
  provider: string
  group: string
  description?: string
  capabilities?: Array<{ type: CherryStudioCapability }>
}

export interface CherryStudioProviderEntry {
  id: string
  type: "openai"
  name: string
  apiKey: string
  apiHost: string
  models: CherryStudioModelEntry[]
  enabled: boolean
  isSystem: false
}

export function buildCherryStudioProvider(models: ExportableModel[]): CherryStudioProviderEntry {
  return {
    id: "nous",
    type: "openai",
    name: "nous",
    apiKey: "",
    // cherry studio appends /v1 itself, so no /v1 here
    apiHost: NOUS_API_HOST,
    models: models.map((model) => {
      const capabilities: CherryStudioCapability[] = []
      if (hasImageInput(model)) capabilities.push("vision")
      if (isReasoningModel(model)) capabilities.push("reasoning")
      if (supportsToolCalling(model)) capabilities.push("function_calling")
      return {
        id: model.id,
        name: model.name,
        provider: "nous",
        group: "nous",
        ...(model.description ? { description: model.description } : {}),
        ...(capabilities.length ? { capabilities: capabilities.map((type) => ({ type })) } : {})
      }
    }),
    enabled: true,
    isSystem: false
  }
}

// zed
// ---- Zed (language_models.openai_compatible settings fragment) ----

// Zed's reasoning_effort enum for OpenAI-compatible providers
const ZED_KNOWN_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"]

export type ZedReasoningEffort = (typeof ZED_KNOWN_EFFORTS)[number]

export interface ZedModelCapabilities {
  tools: boolean
  images: boolean
  parallel_tool_calls: boolean
  prompt_cache_key: boolean
  chat_completions: boolean
  interleaved_reasoning: boolean
  max_tokens_parameter: boolean
}

export interface ZedAvailableModel {
  name: string
  display_name?: string
  max_tokens: number
  max_output_tokens?: number
  reasoning_effort?: ZedReasoningEffort
  capabilities?: ZedModelCapabilities
}

export interface ZedOpenAiCompatibleProvider {
  api_url: string
  available_models: ZedAvailableModel[]
}

export interface ZedSettings {
  language_models: {
    openai_compatible: Record<string, ZedOpenAiCompatibleProvider>
  }
}

// fixed provider id so every export replaces the same entry; Zed derives the env
// var name from it (NOUS → NOUS_API_KEY)
const ZED_PROVIDER_ID = "nous"

function buildZedReasoningEffort(
  efforts: string[] | undefined,
  defaultEffort: string | undefined
): ZedReasoningEffort | undefined {
  const known = efforts?.filter((e): e is ZedReasoningEffort => ZED_KNOWN_EFFORTS.includes(e)) ?? []
  const nonNone = known.filter((effort) => effort !== "none")
  const usableDefault =
    defaultEffort && defaultEffort !== "none" && ZED_KNOWN_EFFORTS.includes(defaultEffort)
      ? (defaultEffort as ZedReasoningEffort)
      : undefined
  // Zed's provider setup only exposes non-none levels: prefer the model's default,
  // falling back to its first supported non-none effort
  return usableDefault ?? nonNone[0]
}

// emitted in full (not just deviations from Zed's defaults) so exports stay stable if
// Zed changes them; max_tokens_parameter is true because the gateway expects the output
// limit as max_tokens, not max_completion_tokens (same fix the DeepSeek Harness compat applies)
function buildZedCapabilities(model: ExportableModel): ZedModelCapabilities {
  return {
    tools: supportsToolCalling(model),
    images: hasImageInput(model),
    parallel_tool_calls: false,
    prompt_cache_key: false,
    chat_completions: true,
    interleaved_reasoning: false,
    max_tokens_parameter: true
  }
}

export function buildZedSettings(models: ExportableModel[]): ZedSettings {
  return {
    language_models: {
      openai_compatible: {
        [ZED_PROVIDER_ID]: {
          api_url: GCMP_BASE_URL,
          available_models: models.map((model) => {
            const contextWindow = getContextWindow(model)
            const { maxOutputTokens } = deriveContextTokens(model)
            const reasoningEffort = buildZedReasoningEffort(
              model.reasoning?.supported_efforts,
              model.reasoning?.default_effort
            )
            return {
              name: model.id,
              ...(model.name ? { display_name: model.name } : {}),
              max_tokens: contextWindow,
              ...(maxOutputTokens ? { max_output_tokens: maxOutputTokens } : {}),
              ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
              capabilities: buildZedCapabilities(model)
            }
          })
        }
      }
    }
  }
}

// mimocode
// ---- Xiaomi MiMo Desktop (mimocode.jsonc) ----
// Model entry fields per https://mimo.xiaomi.com/mimocode/config.json ProviderConfig

export interface MimocodeCost {
  input: number
  output: number
  cache_read?: number
  cache_write?: number
}

export interface MimocodeModelEntry {
  id: string
  name: string
  attachment: boolean
  reasoning: boolean
  temperature: boolean
  tool_call: boolean
  cost?: MimocodeCost
  limit: { context: number; input: number; output: number }
  modalities: { input: string[]; output: string[] }
  headers: Record<string, string>
}

export interface MimocodeProviderEntry {
  id: string
  name: string
  npm: "@ai-sdk/openai-compatible"
  models: Record<string, MimocodeModelEntry>
  options: { apiKey: string; baseURL: string }
}

export interface MimocodeConfig {
  $schema: string
  provider: Record<string, MimocodeProviderEntry>
}

// modality enum from the mimocode config schema
const INPUT_MODALITIES = ["text", "audio", "image", "video", "pdf"] as const
const OUTPUT_MODALITIES = ["text", "audio", "image", "video", "pdf"] as const

const MIMOCODE_USER_AGENT = "HermesAgent/0.21.7"

const buildModalities = (model: ExportableModel) => {
  const inputDeclared = model.architecture?.input_modalities ?? []
  const outputDeclared = model.architecture?.output_modalities ?? []
  const input = INPUT_MODALITIES.filter((modality) => inputDeclared.includes(modality))
  const output = OUTPUT_MODALITIES.filter((modality) => outputDeclared.includes(modality))
  return {
    input: input.length > 0 ? input : ["text"],
    output: output.length > 0 ? output : ["text"]
  }
}

// cost is USD per 1M tokens; omit unless the API reports both required rates
const buildCost = (model: ExportableModel): MimocodeCost | undefined => {
  const pricing = model.pricing
  if (!pricing?.prompt || !pricing?.completion) return undefined
  const cost: MimocodeCost = {
    input: toPerMillion(pricing.prompt),
    output: toPerMillion(pricing.completion)
  }
  if (pricing.input_cache_read) cost.cache_read = toPerMillion(pricing.input_cache_read)
  if (pricing.input_cache_write) cost.cache_write = toPerMillion(pricing.input_cache_write)
  return cost
}

export function buildMimocodeConfig(models: ExportableModel[]): MimocodeConfig {
  const modelEntries = Object.fromEntries(
    models.map((model) => {
      const contextWindow = getContextWindow(model)
      const { maxInputTokens, maxOutputTokens } = deriveContextTokens(model)
      const cost = buildCost(model)
      const entry: MimocodeModelEntry = {
        id: model.id,
        name: model.name,
        attachment: hasImageInput(model),
        reasoning: isReasoningModel(model),
        temperature: model.supported_parameters?.includes("temperature") ?? false,
        tool_call: supportsToolCalling(model),
        ...(cost ? { cost } : {}),
        limit: { context: contextWindow, input: maxInputTokens, output: maxOutputTokens },
        modalities: buildModalities(model),
        headers: { "User-Agent": MIMOCODE_USER_AGENT }
      }
      return [model.id, entry]
    })
  )
  return {
    $schema: "https://mimo.xiaomi.com/mimocode/config.json",
    provider: {
      nous: {
        id: "nous",
        name: "nous",
        npm: "@ai-sdk/openai-compatible",
        models: modelEntries,
        options: {
          apiKey: "{env:NOUS_API_KEY}",
          baseURL: GCMP_BASE_URL
        }
      }
    }
  }
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
  const generatedFiles = new Set((opts.generated ?? []).map((g) => g.file))

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

  for (const g of opts.generated ?? []) {
    order.push(g.file)
    const det = detectExport(g.file, g.text, "loose")
    if (!det) {
      outcomes.set(g.file, { input: g.file, status: "failed", message: { key: "unrecognized" } })
      continue
    }
    loaded.push({ file: g.file, text: g.text, det })
  }

  // phase 1.5: a Codex config.toml brings its sibling models.json along
  for (const item of [...loaded]) {
    if (item.det.ruleId !== "codex" || generatedFiles.has(item.file)) continue
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

const MODELS_API_URL = "https://inference-api.nousresearch.com/v1/models"

interface ExportFileSpec {
  fileName: string
  format: Format
  /** pasted into the app UI instead of merged into a config file (e.g. Chatbox) */
  pasteOnly?: boolean
  build: (models: ExportableModel[]) => unknown
}

/** Mirrors `exporterRegistry` in src/model-export/registry.ts; merge.test.ts keeps them in sync. */
export const EXPORT_PROGRAMS: { id: string; files: ExportFileSpec[] }[] = [
  {
    id: "codex",
    files: [
      { fileName: "config.toml", format: "toml", build: buildCodexConfigToml },
      { fileName: "models.json", format: "json", build: buildModelCatalogJson }
    ]
  },
  {
    id: "codex-osaurus",
    files: [
      { fileName: "config.toml", format: "toml", build: buildCodexOsaurusConfigToml },
      { fileName: "models.json", format: "json", build: buildCodexOsaurusModelCatalogJson }
    ]
  },
  {
    id: "github-copilot-gcmp",
    files: [{ fileName: "gcmp-compatible-models.json", format: "json", build: buildGcmpCompatibleModels }]
  },
  {
    id: "github-copilot-language-models",
    files: [
      { fileName: "chatLanguageModels.json", format: "json", build: buildGithubCopilotLanguageModels }
    ]
  },
  {
    id: "zcode",
    files: [{ fileName: "zcode-provider-config.json", format: "json", build: buildZcodeConfig }]
  },
  {
    id: "deepseek-harness",
    files: [{ fileName: "dsh-llm-pi-ai.yaml", format: "yaml", build: buildDshProviderConfig }]
  },
  {
    id: "deepseek-harness-desktop",
    files: [{ fileName: "dsh-desktop-cordis-patch.yml", format: "yaml", build: buildDshDesktopPatch }]
  },
  {
    id: "litellm",
    files: [{ fileName: "litellm-config.yaml", format: "yaml", build: buildLitellmConfig }]
  },
  {
    id: "cliproxyapi",
    files: [{ fileName: "cliproxyapi-config.yaml", format: "yaml", build: buildCliproxyapiConfig }]
  },
  {
    id: "opencode",
    files: [{ fileName: "opencode.json", format: "json", build: buildOpencodeConfig }]
  },
  {
    id: "crush",
    files: [{ fileName: "crush.json", format: "json", build: buildCrushConfig }]
  },
  {
    id: "chatbox",
    files: [{ fileName: "chatbox-nous-provider.json", format: "json", pasteOnly: true, build: buildChatboxProviderConfig }]
  },
  {
    id: "cherry-studio",
    files: [{ fileName: "cherry-studio-nous.json", format: "json", build: buildCherryStudioProvider }]
  },
  {
    id: "zed",
    files: [{ fileName: "zed-language-models.json", format: "json", build: buildZedSettings }]
  },
  {
    id: "mimocode",
    files: [{ fileName: "mimocode.jsonc", format: "json", build: buildMimocodeConfig }]
  }
]

interface ProgramSpec {
  program: string
  ids: string[]
}

export function parseProgramSpecs(raws: string[]): ProgramSpec[] {
  const byProgram = new Map<string, string[]>()
  for (const raw of raws) {
    const eq = raw.indexOf("=")
    const program = eq > 0 ? raw.slice(0, eq).trim() : ""
    const ids =
      eq > 0
        ? raw
            .slice(eq + 1)
            .split(",")
            // ids are shown verbatim in the generated command; older dashboard
            // builds percent-encoded them (`xiaomi%2Fmimo`), so decode to the
            // literal id the upstream API expects, but keep raw text when the
            // id is not valid percent-encoding (e.g. a literal `100%`)
            .map((s) => {
              const id = s.trim()
              try {
                return decodeURIComponent(id)
              } catch {
                return id
              }
            })
            .filter(Boolean)
        : []
    if (!program || ids.length === 0) throw new MergeError({ key: "programSyntax", args: [raw] })
    byProgram.set(program, [...(byProgram.get(program) ?? []), ...ids])
  }
  return [...byProgram].map(([program, ids]) => ({ program, ids: [...new Set(ids)] }))
}

async function fetchUpstreamModels(): Promise<ExportableModel[]> {
  const res = await fetch(MODELS_API_URL, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { data?: ExportableModel[] }
  return body.data ?? []
}

const serializeGenerated = (value: unknown, format: Format): string =>
  format === "yaml"
    ? yaml.stringify(value)
    : format === "toml"
      ? String(value)
      : JSON.stringify(value, null, 2)

async function generateExports(raws: string[]): Promise<GeneratedExport[]> {
  const specs = parseProgramSpecs(raws)
  for (const spec of specs) {
    if (!EXPORT_PROGRAMS.some((p) => p.id === spec.program))
      throw new MergeError({ key: "unknownProgram", args: [spec.program] })
  }

  let upstream: ExportableModel[]
  try {
    upstream = await fetchUpstreamModels()
  } catch (e) {
    throw new MergeError({
      key: "fetchModelsFail",
      args: [e instanceof Error ? e.message : String(e)]
    })
  }
  const byId = new Map(upstream.map((m) => [m.id, m]))

  const generated: GeneratedExport[] = []
  for (const spec of specs) {
    const missing = spec.ids.filter((id) => !byId.has(id))
    if (missing.length > 0)
      throw new MergeError({ key: "unknownModel", args: [missing.join(", ")] })
    const models = spec.ids.map((id) => byId.get(id)!)
    const program = EXPORT_PROGRAMS.find((p) => p.id === spec.program)!
    for (const file of program.files) {
      generated.push({
        file: join(GENERATED_DIR, program.id, file.fileName),
        text: serializeGenerated(file.build(models), file.format)
      })
    }
  }
  return generated
}

const GENERATED_DIR = "<generated>"

/** Remote entrypoint the dashboard embeds in its one-command export block. */
export const REMOTE_MERGE_URL =
  "https://raw.githubusercontent.com/ftzahao/NousResearchModelsPanel/main/scripts/merge.ts"

// `--reload=<url>` busts Deno's module cache for this script only (scoped, so
// the pinned esm.sh parsers keep their cache) — a changed merge.ts is picked
// up on the very next run instead of serving a stale copy.
const DENO_ONE_PREFIX = `deno run --no-lock --reload=${REMOTE_MERGE_URL} --allow-read --allow-write --allow-env --allow-net ${REMOTE_MERGE_URL}`

const REMOTE_NOTE_KEY = "remoteNote"
const PASTE_ONLY_NOTE_KEY = "pasteOnly"

/**
 * Single copy-paste command that generates the config for `program` from `ids`
 * and merges it in place — no download, no separate merge step.
 * Returns `{ note }` for paste-only programs or an empty selection, so the
 * dashboard can render guidance instead of a command.
 */
export function buildOneCommand(
  program: string,
  ids: string[],
  lang: "zh" | "en"
): { command: string } | { note: string } {
  const spec = EXPORT_PROGRAMS.find((p) => p.id === program)
  if (!spec) throw new Error(`unknown program: ${program}`)
  const pasteOnly = spec.files.every((f) => f.pasteOnly === true)
  if (pasteOnly) return { note: MERGE_CLI_MESSAGES[lang][PASTE_ONLY_NOTE_KEY as "pasteOnly"] }
  if (ids.length === 0) return { note: MERGE_CLI_MESSAGES[lang].needSelection }
  return {
    command: `${DENO_ONE_PREFIX} --one ${program}=${ids.join(",")}`
  }
}

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
    program?: string[]
    one?: string[]
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
        program: { type: "string", short: "p", multiple: true },
        one: { type: "string", multiple: true }
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
  const programs = [...(values.program ?? []), ...(values.one ?? [])]

  if (values.help) {
    printUsage(t)
    return 0
  }
  if (values.list) {
    printRuleList(t, home, process.cwd())
    console.log(`\n${t.programsHeader}:`)
    for (const p of EXPORT_PROGRAMS) console.log(`  ${p.id}`)
    return 0
  }

  let generated: GeneratedExport[] = []
  if (programs.length > 0) {
    try {
      generated = await generateExports(programs)
    } catch (e) {
      if (!(e instanceof MergeError)) throw e
      console.log(`✗ ${fmt(t[e.notice.key], ...(e.notice.args ?? []))}`)
      return 1
    }
  }

  let paths = positionals
  let scanned: string | null = null
  if (paths.length === 0 && programs.length === 0) {
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
  if (files.length === 0 && generated.length === 0) {
    if (scanned) console.log(`${t.scanning}: ${displayPath(scanned, home)}`)
    console.log(`✗ ${t.noExportFiles}`)
    return 1
  }
  if (values.target && files.length + generated.length > 1) {
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
    generated
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
