import { createElement, type ReactNode } from "react"
import BigNumber from "bignumber.js"
import { FileText, Image as ImageIcon, Mic, Video, Layers, Cpu } from "lucide-react"
import type { Lang, Currency, Model } from "./types"
export type { Lang, Currency, Model }

// Global rounding for every BigNumber derived from API price strings.
BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_HALF_UP })

// Theme-aware Tailwind text classes, named by role. Dark mode dims to
// gray-500; the faint pair inverts so dark mode keeps a lighter gray.
export const textMuted = (isDark: boolean) => (isDark ? "text-gray-500" : "text-gray-400")
export const textFaint = (isDark: boolean) => (isDark ? "text-gray-400" : "text-gray-500")

export function currencySymbol(currency: Currency): string {
  return currency === "CNY" ? "¥" : "$"
}

export function bn(val: string | number | undefined | null): BigNumber {
  return new BigNumber(val ?? "0")
}

export const providerColors: Record<string, string> = {
  anthropic: "#D97706",
  google: "#4285F4",
  meta: "#0668E1",
  deepseek: "#536DFE",
  qwen: "#7C3AED",
  "z-ai": "#10B981",
  nvidia: "#76B900",
  ibm: "#1F70C1",
  tencent: "#07C160",
  inception: "#F43F5E",
  moonshotai: "#8B5CF6",
  voyageai: "#0EA5E9",
  bytedance: "#FE2C55",
  sakana: "#F97316",
  upstage: "#06B6D4",
  poolside: "#EC4899",
  thinkingmachines: "#A855F7",
  inclusionai: "#14B8A6",
  meituan: "#FFD700"
}

export function getProvider(id: string): string {
  const key = id.split("/")[0]?.replace("~", "") ?? "unknown"
  return key
}

export function getProviderColor(id: string): string {
  return providerColors[getProvider(id)] ?? "#6B7280"
}

// Reorder a favorites id list for drag-and-drop: move fromId next to toId.
// Returns a new array; unknown ids leave the order unchanged.
export function reorderFavorites(
  order: string[],
  fromId: string,
  toId: string,
  position: "before" | "after"
): string[] {
  const from = order.indexOf(fromId)
  const to = order.indexOf(toId)
  if (from === -1 || to === -1 || fromId === toId) return [...order]
  const next = order.filter((id) => id !== fromId)
  const target = next.indexOf(toId)
  next.splice(position === "before" ? target : target + 1, 0, fromId)
  return next
}

// Sort items into the manual favorites drag order (Set insertion order);
// non-favorites keep their original relative order at the end.
export function sortByFavorites<T extends { id: string }>(
  items: T[],
  favorites: ReadonlySet<string>
): T[] {
  if (favorites.size === 0) return [...items]
  const order = new Map([...favorites].map((id, i) => [id, i]))
  return [...items].sort(
    (a, b) =>
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  )
}

// Favorite ids that no longer appear in the upstream model list, in the
// manual favorites order. The upstream may have removed them, so they are
// surfaced separately instead of silently disappearing from Favorites.
export function missingFavorites<T extends { id: string }>(
  favorites: ReadonlySet<string>,
  items: readonly T[]
): string[] {
  if (favorites.size === 0) return []
  const present = new Set(items.map((item) => item.id))
  return [...favorites].filter((id) => !present.has(id))
}

export function currencyUnit(lang: Lang, currency: Currency): string {
  const sym = currencySymbol(currency)
  return lang === "zh" ? `${sym}/M` : `${sym}/1M tokens`
}

// USD per-token price → display string per 1M tokens, CNY converted at the rate.
function perMillion(n: BigNumber, currency: Currency, exchangeRate: number): string {
  const value = n.times(1e6).times(currency === "CNY" ? exchangeRate : 1)
  return stripZeros(value.toFixed(2))
}

export function formatPrice(
  val: string | undefined,
  lang: Lang = "zh",
  currency: Currency = "USD",
  exchangeRate: number = 7.25
): string {
  if (!val) return "—"
  const n = bn(val)
  if (n.isZero()) return lang === "zh" ? "免费" : "Free"
  return `${currencySymbol(currency)}${perMillion(n, currency, exchangeRate)}/1M`
}

export function formatPriceShort(
  val: string | undefined,
  currency: Currency = "USD",
  exchangeRate: number = 7.25
): string {
  if (!val) return "—"
  const n = bn(val)
  const sym = currencySymbol(currency)
  if (n.isZero()) return `${sym}0`
  return `${sym}${perMillion(n, currency, exchangeRate)}`
}

export function isFreePrice(val: string | undefined | null): boolean {
  return bn(val).isZero()
}

export function stripZeros(s: string): string {
  if (!s.includes(".")) return s
  return s.replace(/\.?0+$/, "")
}

export function formatCtx(n: number): string {
  const bnN = bn(n)
  if (bnN.gte(1_000_000)) {
    const v = bnN.div(1_000_000)
    return `${stripZeros(v.toFixed(v.gte(10) ? 1 : 2))}M`
  }
  if (bnN.gte(1000)) return `${stripZeros(bnN.div(1000).toFixed(1))}K`
  return `${n}`
}

/** One `label: value` line of the copyable card summary. */
export interface ParamsLine {
  label: string
  value: string
}

/**
 * The card's headline numbers as ordered `label: value` lines, used by the
 * copy button (and rendered on the card itself). Free prices show the
 * localized Free label; absent values are skipped.
 */
export function modelParamsLines(
  model: Model,
  lang: Lang = "zh",
  currency: Currency = "USD",
  exchangeRate: number = 7.25
): ParamsLine[] {
  const labels =
    lang === "zh"
      ? { context: "上下文", maxOutput: "最大输出", prompt: "输入", completion: "输出", intelligence: "智能指数" }
      : { context: "Context", maxOutput: "Max Output", prompt: "Prompt", completion: "Complete", intelligence: "Intelligence" }
  const free = lang === "zh" ? "免费" : "Free"
  const fmt = (v: string | undefined) =>
    v == null ? undefined : isFreePrice(v) ? free : formatPrice(v, lang, currency, exchangeRate)

  const lines: ParamsLine[] = [{ label: labels.context, value: formatCtx(model.context_length) }]
  const topCtx = model.top_provider?.context_length
  if (topCtx && topCtx !== model.context_length) {
    lines[0]!.value += ` (${formatCtx(topCtx)})`
  }
  if (model.top_provider?.max_completion_tokens) {
    lines.push({ label: labels.maxOutput, value: formatCtx(model.top_provider.max_completion_tokens) })
  }
  lines.push({ label: labels.prompt, value: fmt(model.pricing?.prompt) ?? "—" })
  lines.push({ label: labels.completion, value: fmt(model.pricing?.completion) ?? "—" })

  const intel = model.benchmarks?.artificial_analysis?.intelligence_index
  if (intel != null) lines.push({ label: labels.intelligence, value: `${intel}` })
  return lines
}

/** The copy button payload: model id on its own line, then `label: value` lines. */
export function formatParamsForCopy(lines: ParamsLine[], id: string): string {
  return [id, ...lines.map((l) => `${l.label}: ${l.value}`)].join("\n")
}

export function formatDate(ts: number, lang: Lang = "zh"): string {
  return new Date(ts * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

export function daysSince(ts: number): number {
  return Math.floor((Date.now() / 1000 - ts) / 86400)
}

export function isNewModel(created: number): boolean {
  return daysSince(created) < 7
}

export interface DiscountSide {
  ratio: number
  originalPrice: string
}

export interface DiscountInfo {
  prompt?: DiscountSide
  completion?: DiscountSide
}

export function getDiscount(model: Model): DiscountInfo | null {
  const p = model.pricing
  const orig = p?.original
  if (!p || !orig) return null
  const result: DiscountInfo = {}
  const origPrompt = orig.prompt ? bn(orig.prompt) : null
  const origCompletion = orig.completion ? bn(orig.completion) : null
  if (origPrompt && origPrompt.gt(0) && bn(p.prompt).lt(origPrompt)) {
    const ratio = bn(p.prompt).div(origPrompt).toNumber()
    if (ratio < 0.995) result.prompt = { ratio, originalPrice: orig.prompt! }
  }
  if (origCompletion && origCompletion.gt(0) && bn(p.completion).lt(origCompletion)) {
    const ratio = bn(p.completion).div(origCompletion).toNumber()
    if (ratio < 0.995) result.completion = { ratio, originalPrice: orig.completion! }
  }
  return result.prompt || result.completion ? result : null
}

export function formatDiscount(ratio: number, lang: Lang): string {
  if (lang === "zh") {
    const zhe = Math.round(ratio * 100) / 10
    return `${stripZeros(zhe.toFixed(1))}折`
  }
  return `${Math.round(ratio * 100)}% OFF`
}

export const modalityIcons: Record<string, ReactNode> = {
  text: createElement(FileText, { size: 10 }),
  image: createElement(ImageIcon, { size: 10 }),
  audio: createElement(Mic, { size: 10 }),
  video: createElement(Video, { size: 10 }),
  file: createElement(Layers, { size: 10 }),
  embeddings: createElement(Cpu, { size: 10 })
}

export const modalityColors: Record<string, { dark: string; light: string }> = {
  text: { dark: "bg-blue-500/20 text-blue-300", light: "bg-blue-100 text-blue-700" },
  image: { dark: "bg-purple-500/20 text-purple-300", light: "bg-purple-100 text-purple-700" },
  audio: { dark: "bg-orange-500/20 text-orange-300", light: "bg-orange-100 text-orange-700" },
  video: { dark: "bg-pink-500/20 text-pink-300", light: "bg-pink-100 text-pink-700" },
  file: { dark: "bg-gray-500/20 text-gray-300", light: "bg-gray-100 text-gray-600" },
  embeddings: { dark: "bg-green-500/20 text-green-300", light: "bg-green-100 text-green-700" }
}
