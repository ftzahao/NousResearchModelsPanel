/**
 * Text-splicing primitives for the export merge CLI (scripts/merge.ts).
 *
 * Merging is done by locating the affected fragment in the target file's raw
 * text and replacing only that fragment, so everything else — including the
 * user's comments and formatting — survives byte-for-byte. Every splice result
 * is re-parsed and deep-compared against the expected merged value by the
 * caller, which aborts the write when anything is off.
 *
 * Formats covered here: JSON / JSONC (key-path splices), YAML (one top-level
 * key block or a root-level array) and TOML (scalar lines + table blocks).
 */

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

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

export const deepEqual = (a: unknown, b: unknown): boolean => Bun.deepEquals(a, b)

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

export function tryParseJsonc(text: string): unknown {
  try {
    return Bun.JSONC.parse(text)
  } catch {
    return undefined
  }
}

export function parseByFormat(text: string, format: Format): unknown {
  if (format === "yaml") return Bun.YAML.parse(text)
  if (format === "toml") return Bun.TOML.parse(text)
  return Bun.JSONC.parse(text)
}

const ensureNewline = (s: string): string => (s.endsWith("\n") ? s : s + "\n")

export function serializeByFormat(value: unknown, format: Format, indent = "  "): string {
  if (format === "yaml") return ensureNewline(Bun.YAML.stringify(value, null, 2))
  if (format === "toml") return ensureNewline(Bun.TOML.stringify(value) ?? "")
  return JSON.stringify(value, null, indent) + "\n"
}

/**
 * Render `value` as JSON whose first line sits at the current cursor position
 * and whose remaining lines are indented to column `keyCol + indent` — i.e.
 * pretty-printed against the key it belongs to.
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

// ---------------------------------------------------------------------------
// JSON / JSONC
// ---------------------------------------------------------------------------

/** Skip whitespace plus `//` and `/* *` comments starting at `i`. */
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
  // scalar: stop at a delimiter or a comment, then trim trailing whitespace
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

/** Locate `key` among the entries of the object starting at `objStart` (a `{`). */
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

/** Column where the first root-level key sits; falls back to one indent unit. */
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

/** Insert `"key": value` into the object at `objStart`, keeping existing bytes. */
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

/**
 * Replace the value at `path` with `merged`'s value at the same path, or — when
 * a segment is missing — insert the missing key (carrying the whole subtree)
 * into the deepest object we could reach. Skips work when the value already
 * matches, which makes repeated merges idempotent.
 */
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
  let containerKeyCol: number | null = null // null → root object
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
      // last segment, or an intermediate that is not an object → replace value
      const old = text.slice(span.valueStart, span.valueEnd)
      const current = tryParseJsonc(old)
      if (deepEqual(current, subtree)) return { text, action: "skip", commentLoss: false }
      // keep the node's original layout: inline stays inline, block stays block
      const rendered = old.includes("\n")
        ? renderValue(subtree, colOf(text, span.keyStart), indent)
        : JSON.stringify(subtree)
      return {
        text: text.slice(0, span.valueStart) + rendered + text.slice(span.valueEnd),
        action: "replace",
        commentLoss: hasJsonComments(old),
      }
    }

    // key missing here: insert the remaining subtree into the current object
    const subtree = getAtPath(merged, path.slice(0, d + 1))
    if (subtree === undefined) throw new SpliceError(`missing merged value at ${path.join(".")}`)
    const childrenCol = containerKeyCol === null ? rootKeyCol : containerKeyCol + indent.length
    return {
      text: insertIntoObject(text, container, seg, subtree, childrenCol, indent),
      action: "insert",
      commentLoss: false,
    }
  }
  /* istanbul ignore next — the loop always returns */
  throw new SpliceError(`unreachable path ${path.join(".")}`)
}

// ---------------------------------------------------------------------------
// YAML
// ---------------------------------------------------------------------------

function yamlBlockLines(key: string, value: unknown): string[] {
  const s = Bun.YAML.stringify({ [key]: value }, null, 2)
  return s
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "")
    .split("\n")
}

/**
 * Replace the top-level `key:` block (or append it when absent). The block
 * ends at the next column-0 content line; trailing comments/blank lines before
 * that line are left alone because they document the following section.
 */
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
    if (current !== undefined) {
      // parsed target has the key but the line scanner could not find it
      return { text: serializeByFormat(merged, "yaml"), action: "rewrite", commentLoss: hasHashComments(text) }
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
    if (/^\s/.test(l)) continue // indented lines are part of our key's value
    if (l.startsWith("#")) continue // col-0 comment inside/after our block
    if (/^-(\s|$)/.test(l)) continue // col-0 sequence items belong to our key
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

/** Replace a root-level YAML sequence (e.g. a cordis patch file) in place. */
export function spliceYamlRootArray(text: string, targetParsed: unknown, merged: unknown): SpliceOutcome {
  if (!Array.isArray(targetParsed)) throw new SpliceError("target is not a YAML sequence")
  if (deepEqual(targetParsed, merged)) return { text, action: "skip", commentLoss: false }

  const lines = text.split("\n")
  const block = Bun.YAML.stringify(merged, null, 2)
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "")
    .split("\n")
  const start = lines.findIndex((l) => /^-(\s|$)/.test(l))

  if (start === -1) {
    // file is `[]` or comments only: keep the leading comment/blank lines
    let i = 0
    while (i < lines.length && (lines[i]!.trim() === "" || lines[i]!.startsWith("#"))) i++
    const kept = lines.slice(0, i)
    const mergedLines = [...kept, ...block]
    return { text: mergedLines.join("\n") + "\n", action: "replace", commentLoss: hasHashComments(lines.slice(i).join("\n")) }
  }

  let end = lines.length
  while (end - 1 > start) {
    const prev = lines[end - 1] ?? ""
    if (prev.trim() === "" || prev.startsWith("#")) end--
    else break
  }
  const region = lines.slice(start, end).join("\n")
  const next = [...lines.slice(0, start), ...block, ...lines.slice(end)]
  return { text: next.join("\n"), action: "replace", commentLoss: hasHashComments(region) }
}

// ---------------------------------------------------------------------------
// TOML
// ---------------------------------------------------------------------------

function tomlScalarLine(key: string, value: unknown): string {
  return (Bun.TOML.stringify({ [key]: value }) ?? "").trim()
}

/** Body lines of `[op.key]` built from a throwaway single-key document. */
function tomlTableBlock(op: Extract<TomlOp, { kind: "table" }>): string[] | null {
  const wrapped = Bun.TOML.stringify({ v: op.value }) ?? ""
  const lines = wrapped.split("\n") // ["[v]", ...body, ""]
  const body = lines.slice(1)
  while (body.length > 0 && (body[body.length - 1] ?? "") === "") body.pop()
  // a nested table inside the body would be emitted as `[v.sub]` — wrong name
  if (body.some((l) => /^\s*\[/.test(l))) return null
  return [`[${op.key}]`, ...body]
}

/**
 * Apply targeted TOML edits: scalar lines are replaced/inserted in the
 * top-level region (before the first `[table]`), table blocks are replaced
 * wholesale or appended. Ops whose value already matches the parsed target are
 * skipped, so re-running a merge is a no-op.
 */
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
    const idx = lines.findIndex((l) => /^\s*\[/.test(l))
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
        // deletion: only report a change when a line was actually there
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
        // insert after the last scalar line of the top-level region
        let pos = 0
        for (let i = 0; i < end; i++) if (/^\s*\S+\s*=/.test(lines[i] ?? "")) pos = i + 1
        lines.splice(pos, 0, line)
        changes.push(op.key)
      }
      continue
    }

    // table op
    if (deepEqual(current, op.value)) continue
    changes.push(`[${op.key}]`)
    const headerRe = new RegExp(`^\\s*\\[\\s*${escapeRegExp(op.key)}\\s*\\]\\s*(#.*)?$`)
    const idx = lines.findIndex((l) => headerRe.test(l))
    const block = tomlTableBlock(op)
    if (block === null) return rewriteTomlOutcome(text, merged, changes)

    if (idx === -1) {
      if (current !== undefined) return rewriteTomlOutcome(text, merged, changes)
      while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
      lines.push("", ...block)
      continue
    }
    // block runs until the next table header; keep the comment run before it
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

  return { text: lines.join("\n"), action: changes.length ? "replace" : "skip", commentLoss, changes }
}

function rewriteTomlOutcome(text: string, merged: unknown, changes: string[]): TomlSpliceOutcome {
  return {
    text: serializeByFormat(merged, "toml"),
    action: "rewrite",
    commentLoss: hasHashComments(text),
    changes,
  }
}
