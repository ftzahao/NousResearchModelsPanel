import React from "react"
import BigNumber from "bignumber.js"
import { FileText, Image as ImageIcon, Mic, Video, Layers, Cpu } from "lucide-react"
import type { Lang, Currency } from "./types"

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

BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_HALF_UP })

export function bn(val: string | undefined | null): BigNumber {
  return new BigNumber(val ?? "0")
}

export function stripZeros(s: string): string {
  if (!s.includes(".")) return s
  return s.replace(/\.?0+$/, "")
}

export function currencyUnit(lang: Lang, currency: Currency): string {
  const sym = currency === "CNY" ? "¥" : "$"
  return lang === "zh" ? `${sym}/M` : `${sym}/1M tokens`
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

  if (currency === "CNY") {
    const cnyValue = n.times(1e6).times(exchangeRate)
    return `¥${stripZeros(cnyValue.toFixed(2))}/1M`
  }

  return `$${stripZeros(n.times(1e6).toFixed(2))}/1M`
}

export function formatPriceRaw(val: string | undefined, currency: Currency = "USD"): string {
  if (!val) return "—"
  const n = bn(val)
  const sym = currency === "CNY" ? "¥" : "$"
  if (n.isZero()) return `${sym}0`
  return `${sym}${stripZeros(n.toFixed(10))}`
}

export function formatCtx(n: number): string {
  const bnN = new BigNumber(n)
  if (bnN.gte(1_000_000)) {
    const v = bnN.div(1_000_000)
    return `${stripZeros(v.toFixed(v.gte(10) ? 1 : 2))}M`
  }
  if (bnN.gte(1000)) return `${stripZeros(bnN.div(1000).toFixed(1))}K`
  return `${n}`
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

export const modalityIcons: Record<string, React.ReactNode> = {
  text: React.createElement(FileText, { size: 10 }),
  image: React.createElement(ImageIcon, { size: 10 }),
  audio: React.createElement(Mic, { size: 10 }),
  video: React.createElement(Video, { size: 10 }),
  file: React.createElement(Layers, { size: 10 }),
  embeddings: React.createElement(Cpu, { size: 10 })
}

export const modalityColors: Record<string, { dark: string; light: string }> = {
  text: { dark: "bg-blue-500/20 text-blue-300", light: "bg-blue-100 text-blue-700" },
  image: { dark: "bg-purple-500/20 text-purple-300", light: "bg-purple-100 text-purple-700" },
  audio: { dark: "bg-orange-500/20 text-orange-300", light: "bg-orange-100 text-orange-700" },
  video: { dark: "bg-pink-500/20 text-pink-300", light: "bg-pink-100 text-pink-700" },
  file: { dark: "bg-gray-500/20 text-gray-300", light: "bg-gray-100 text-gray-600" },
  embeddings: { dark: "bg-green-500/20 text-green-300", light: "bg-green-100 text-green-700" }
}
