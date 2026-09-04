import React, { useState, useEffect, useMemo, createContext, useContext } from "react"
import { createRoot } from "react-dom/client"
import BigNumber from "bignumber.js"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  PieChart,
  Pie
} from "recharts"
import {
  Search,
  Grid3X3,
  List,
  ChevronDown,
  ChevronUp,
  Zap,
  Brain,
  Globe,
  Cpu,
  X,
  Mic,
  FileText,
  Video,
  Image as ImageIcon,
  DollarSign,
  Activity,
  Layers,
  BarChart3,
  Sparkles,
  ExternalLink,
  Clock,
  Shield,
  Sun,
  Moon
} from "lucide-react"

// ─── i18n ────────────────────────────────────────────────────────────
type Lang = "zh" | "en"

const translations = {
  zh: {
    title: "NousResearch 模型面板",
    subtitle: "推理 API 模型浏览器",
    models: "模型",
    analytics: "数据分析",
    totalModels: "模型总数",
    providers: "提供商",
    reasoningModels: "推理模型",
    freeModels: "免费模型",
    avgIntelligence: "平均智能指数",
    searchPlaceholder: "搜索模型...",
    allProviders: "全部提供商",
    allModalities: "全部模态",
    newest: "最新发布",
    priceLowHigh: "价格: 低→高",
    priceHighLow: "价格: 高→低",
    contextLength: "上下文长度",
    intelligence: "智能指数",
    codingIndex: "编程指数",
    nameAZ: "名称 A→Z",
    reasoning: "推理",
    free: "免费",
    showing: "显示",
    of: "共",
    modelsCount: "个模型",
    matching: "匹配",
    noModels: "没有匹配的模型",
    loading: "正在从 NousResearch API 加载模型...",
    loadFailed: "加载模型失败",
    context: "上下文",
    promptPrice: "输入价格 $/M",
    completePrice: "输出价格 $/M",
    pricingDetails: "价格详情",
    prompt: "输入",
    completion: "输出",
    cacheRead: "缓存读取",
    cacheWrite: "缓存写入",
    cacheWrite1h: "缓存写入(1h)",
    webSearch: "网络搜索",
    image: "图像",
    audio: "音频",
    reasoningPrice: "推理",
    capabilities: "能力参数",
    contextLengthLabel: "上下文长度",
    maxOutput: "最大输出",
    tokenizer: "分词器",
    moderated: "内容审核",
    yes: "是",
    no: "否",
    reasoningLabel: "推理能力",
    mandatory: "必须启用",
    optional: "可选",
    enabledByDefault: "默认启用",
    benchmarks: "基准测试",
    agentic: "智能体",
    designArena: "设计竞技场",
    winRate: "胜率",
    supportedParams: "支持参数",
    daysAgo: "天前",
    promptPriceChart: "输入价格对比 ($/1M tokens)",
    intelligenceVsCoding: "智能指数 vs 编程指数",
    maxContextByProvider: "各提供商最大上下文长度",
    originalPrice: "原价",
    currentPrice: "当前价",
    peakPricing: "分时定价",
    tieredPricing: "阶梯定价",
    offPeak: "低峰",
    peak: "高峰",
    weekday: "工作日",
    weekend: "周末",
    perM: "/1M",
    contextTopProvider: "上下文(提供商)",
    aboveTokens: "以上",
    modelsByProvider: "各提供商模型数量",
    maxContext: "最大上下文",
    dataFrom: "数据来自 NousResearch 推理 API · 每 5 分钟自动刷新",
    builtWith: "使用 Bun + React + Recharts 构建",
    freeLabel: "免费",
    batchLabel: "批处理",
    newLabel: "新",
    routerLabel: "路由",
    daysAgoLabel: "天前"
  },
  en: {
    title: "NousResearch Models",
    subtitle: "Inference API Model Explorer",
    models: "Models",
    analytics: "Analytics",
    totalModels: "Total Models",
    providers: "Providers",
    reasoningModels: "Reasoning Models",
    freeModels: "Free Models",
    avgIntelligence: "Avg Intelligence",
    searchPlaceholder: "Search models...",
    allProviders: "All Providers",
    allModalities: "All Modalities",
    newest: "Newest First",
    priceLowHigh: "Price: Low→High",
    priceHighLow: "Price: High→Low",
    contextLength: "Context Length",
    intelligence: "Intelligence",
    codingIndex: "Coding Index",
    nameAZ: "Name A→Z",
    reasoning: "Reasoning",
    free: "Free",
    showing: "Showing",
    of: "of",
    modelsCount: "models",
    matching: "matching",
    noModels: "No models match your filters",
    loading: "Loading models from NousResearch API...",
    loadFailed: "Failed to load models",
    context: "Context",
    promptPrice: "Prompt $/M",
    completePrice: "Complete $/M",
    pricingDetails: "Pricing Details",
    prompt: "Prompt",
    completion: "Completion",
    cacheRead: "Cache Read",
    cacheWrite: "Cache Write",
    cacheWrite1h: "Cache Write (1h)",
    webSearch: "Web Search",
    image: "Image",
    audio: "Audio",
    reasoningPrice: "Reasoning",
    capabilities: "Capabilities",
    contextLengthLabel: "Context Length",
    maxOutput: "Max Output",
    tokenizer: "Tokenizer",
    moderated: "Moderated",
    yes: "Yes",
    no: "No",
    reasoningLabel: "Reasoning",
    mandatory: "Mandatory",
    optional: "Optional",
    enabledByDefault: "Enabled by default",
    benchmarks: "Benchmarks",
    agentic: "Agentic",
    designArena: "Design Arena",
    winRate: "win",
    supportedParams: "Supported Parameters",
    daysAgo: "days ago",
    promptPriceChart: "Prompt Price Comparison ($/1M tokens)",
    intelligenceVsCoding: "Intelligence vs Coding Index",
    maxContextByProvider: "Max Context Length by Provider",
    modelsByProvider: "Models by Provider",
    maxContext: "Max Context",
    originalPrice: "Original",
    currentPrice: "Current",
    peakPricing: "Time-of-Day Pricing",
    tieredPricing: "Tiered Pricing",
    offPeak: "Off-Peak",
    peak: "Peak",
    weekday: "Weekday",
    weekend: "Weekend",
    perM: "/1M",
    contextTopProvider: "Context (Provider)",
    aboveTokens: "and above",
    dataFrom: "Data from NousResearch Inference API · Auto-refreshes every 5 min",
    builtWith: "Built with Bun + React + Recharts",
    freeLabel: "FREE",
    batchLabel: "BATCH",
    newLabel: "NEW",
    routerLabel: "ROUTER",
    daysAgoLabel: "days ago"
  }
}

type Translations = typeof translations.zh

const LangContext = createContext<{
  lang: Lang
  t: Translations
  setLang: (l: Lang) => void
}>({
  lang: "zh",
  t: translations.zh,
  setLang: () => {}
})

function useLang() {
  return useContext(LangContext)
}

// ─── Theme ────────────────────────────────────────────────────────────
type Theme = "dark" | "light"

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {}
})

function useTheme() {
  return useContext(ThemeContext)
}

// ─── Types ───────────────────────────────────────────────────────────
interface Model {
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

// ─── Helpers ─────────────────────────────────────────────────────────
const providerColors: Record<string, string> = {
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

function getProvider(id: string): string {
  const key = id.split("/")[0]?.replace("~", "") ?? "unknown"
  return key
}

function getProviderColor(id: string): string {
  return providerColors[getProvider(id)] ?? "#6B7280"
}

BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_HALF_UP })

function bn(val: string | undefined | null): BigNumber {
  return new BigNumber(val ?? "0")
}

function stripZeros(s: string): string {
  if (!s.includes(".")) return s
  return s.replace(/\.?0+$/, "")
}

function formatPrice(val: string | undefined, lang: Lang = "zh"): string {
  if (!val) return "—"
  const n = bn(val)
  if (n.isZero()) return lang === "zh" ? "免费" : "Free"
  return `$${stripZeros(n.times(1e6).toFixed(2))}/1M`
}

function formatPriceRaw(val: string | undefined): string {
  if (!val) return "—"
  const n = bn(val)
  if (n.isZero()) return "$0"
  return `$${stripZeros(n.toFixed(10))}`
}

function formatCtx(n: number): string {
  const bnN = new BigNumber(n)
  if (bnN.gte(1_000_000)) {
    const v = bnN.div(1_000_000)
    return `${stripZeros(v.toFixed(v.gte(10) ? 1 : 2))}M`
  }
  if (bnN.gte(1000)) return `${stripZeros(bnN.div(1000).toFixed(1))}K`
  return `${n}`
}

function formatDate(ts: number, lang: Lang = "zh"): string {
  return new Date(ts * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

function daysSince(ts: number): number {
  return Math.floor((Date.now() / 1000 - ts) / 86400)
}

const modalityIcons: Record<string, React.ReactNode> = {
  text: <FileText size={10} />,
  image: <ImageIcon size={10} />,
  audio: <Mic size={10} />,
  video: <Video size={10} />,
  file: <Layers size={10} />,
  embeddings: <Cpu size={10} />
}

const modalityColors: Record<string, { dark: string; light: string }> = {
  text: { dark: "bg-blue-500/20 text-blue-300", light: "bg-blue-100 text-blue-700" },
  image: { dark: "bg-purple-500/20 text-purple-300", light: "bg-purple-100 text-purple-700" },
  audio: { dark: "bg-orange-500/20 text-orange-300", light: "bg-orange-100 text-orange-700" },
  video: { dark: "bg-pink-500/20 text-pink-300", light: "bg-pink-100 text-pink-700" },
  file: { dark: "bg-gray-500/20 text-gray-300", light: "bg-gray-100 text-gray-600" },
  embeddings: { dark: "bg-green-500/20 text-green-300", light: "bg-green-100 text-green-700" }
}

// ─── Stat Card ───────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
}) {
  const { theme } = useTheme()
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-3 animate-fade-in">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-brand-500/10 text-brand-400' : 'bg-brand-50 text-brand-600'}`}>
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</div>
        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{label}</div>
        {sub && <div className={`text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Model Card ──────────────────────────────────────────────────────
function ModelCard({
  model,
  expanded,
  onToggle
}: {
  model: Model
  expanded: boolean
  onToggle: () => void
}) {
  const { lang, t } = useLang()
  const { theme } = useTheme()
  const provider = getProvider(model.id)
  const color = getProviderColor(model.id)
  const benchmarks = model.benchmarks?.artificial_analysis
  const arenas = model.benchmarks?.design_arena ?? []
  const isNew = daysSince(model.created) < 7
  const isBatch = model.id.includes(":batch")
  const isFree = bn(model.pricing?.prompt).isZero()
  const isRouter = model.id.startsWith("~")
  const isDark = theme === "dark"

  return (
    <div
      className={`glass rounded-2xl overflow-hidden transition-all duration-300 card-glow animate-fade-in
        ${expanded ? "col-span-full" : ""}`}
    >
      {/* Header */}
      <div
        className={`p-4 cursor-pointer transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <span className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{model.name}</span>
              {isNew && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                  {t.newLabel}
                </span>
              )}
              {isBatch && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                  {t.batchLabel}
                </span>
              )}
              {isFree && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>
                  {t.freeLabel}
                </span>
              )}
              {isRouter && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                  {t.routerLabel}
                </span>
              )}
            </div>
            <div className={`text-[11px] mt-0.5 font-mono truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{model.id}</div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {model.reasoning?.mandatory && (
              <span title="Reasoning mandatory">
                <Brain size={14} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
              </span>
            )}
            {model.top_provider?.is_moderated && (
              <span title="Moderated">
                <Shield size={14} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
              </span>
            )}
            {expanded ? (
              <ChevronUp size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
            ) : (
              <ChevronDown size={16} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
            )}
          </div>
        </div>

        {/* Modality tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {model.architecture?.input_modalities?.map((m) => {
            const colors = modalityColors[m] ?? (isDark ? { dark: "bg-gray-500/20 text-gray-300", light: "bg-gray-100 text-gray-600" } : { dark: "", light: "" })
            return (
              <span
                key={m}
                className={`modality-tag flex items-center gap-0.5 ${isDark ? colors.dark : colors.light}`}
              >
                {modalityIcons[m]} {m}
              </span>
            )
          })}
          <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>→</span>
          {model.architecture?.output_modalities?.map((m) => {
            const colors = modalityColors[m] ?? (isDark ? { dark: "bg-gray-500/20 text-gray-300", light: "bg-gray-100 text-gray-600" } : { dark: "", light: "" })
            return (
              <span
                key={m}
                className={`modality-tag flex items-center gap-0.5 ${isDark ? colors.dark : colors.light}`}
              >
                {modalityIcons[m]} {m}
              </span>
            )
          })}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t.context}</div>
            <div className={`text-xs font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              {model.context_length}
              {model.top_provider?.context_length &&
                model.top_provider.context_length !== model.context_length && (
                  <span className={isDark ? 'text-gray-500 ml-1' : 'text-gray-400 ml-1'}>({model.top_provider.context_length})</span>
                )}
            </div>
          </div>
          {model.top_provider?.max_completion_tokens ? (
            <div>
              <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t.maxOutput}</div>
              <div className={`text-xs font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                {model.top_provider.max_completion_tokens}
              </div>
            </div>
          ) : null}
          <div>
            <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t.promptPrice}</div>
            <div className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {formatPrice(model.pricing.prompt, lang)}
            </div>
          </div>
          <div>
            <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t.completePrice}</div>
            <div className={`text-xs font-medium ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
              {formatPrice(model.pricing.completion, lang)}
            </div>
          </div>
        </div>

        {/* Benchmark bar */}
        {benchmarks?.intelligence_index != null && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{t.intelligence}</span>
              <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{benchmarks.intelligence_index}</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((benchmarks.intelligence_index / 70) * 100, 100)}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}88)`
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className={`border-t p-4 space-y-4 animate-fade-in ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
          {/* Description */}
          {model.description && (
            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{model.description}</p>
          )}

          {/* Pricing Grid */}
          <div>
            <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              <DollarSign size={12} /> {t.pricingDetails}
              <span className={`text-[10px] font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>($/1M tokens)</span>
            </h4>
            {(() => {
              const pricingItems: Array<{
                key: string
                label: string
                colorDark: string
                colorLight: string
                per1k?: boolean
              }> = [
                { key: "prompt", label: t.prompt, colorDark: "text-emerald-400", colorLight: "text-emerald-600" },
                { key: "completion", label: t.completion, colorDark: "text-sky-400", colorLight: "text-sky-600" },
                { key: "input_cache_read", label: t.cacheRead, colorDark: "text-violet-400", colorLight: "text-violet-600" },
                { key: "input_cache_write", label: t.cacheWrite, colorDark: "text-violet-400", colorLight: "text-violet-600" },
                { key: "input_cache_write_1h", label: t.cacheWrite1h, colorDark: "text-purple-400", colorLight: "text-purple-600" },
                { key: "web_search", label: t.webSearch, colorDark: "text-amber-400", colorLight: "text-amber-600", per1k: true },
                { key: "image", label: t.image, colorDark: "text-purple-400", colorLight: "text-purple-600" },
                { key: "audio", label: t.audio, colorDark: "text-orange-400", colorLight: "text-orange-600" },
                { key: "internal_reasoning", label: t.reasoningPrice, colorDark: "text-rose-400", colorLight: "text-rose-600" }
              ]
              const p = model.pricing as unknown as Record<string, string | undefined>
              const orig = model.pricing.original as unknown as
                | Record<string, string | undefined>
                | undefined
              const active = pricingItems.filter((item) => p[item.key])
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {active.map((item) => (
                    <div key={item.key} className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                      <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.label}</div>
                      <div className={`text-xs font-medium ${isDark ? item.colorDark : item.colorLight}`}>
                        {item.per1k
                          ? `$${stripZeros(bn(p[item.key]).times(1000).toFixed(4))}/1K`
                          : formatPrice(p[item.key], lang)}
                      </div>
                      {orig?.[item.key] && (
                        <div className={`text-[10px] line-through ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {item.per1k
                            ? `$${stripZeros(bn(orig[item.key]).times(1000).toFixed(4))}/1K`
                            : formatPrice(orig[item.key], lang)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
            {/* Pricing overrides */}
            {model.pricing.overrides &&
              model.pricing.overrides.length > 0 &&
              (() => {
                const timeOverrides = model.pricing.overrides.filter((o) => o.utc_days)
                const tokenOverrides = model.pricing.overrides.filter(
                  (o) => o.min_prompt_tokens != null
                )
                return (
                  <div className="mt-2 space-y-2">
                    {/* Time-based overrides */}
                    {timeOverrides.length > 0 && (
                      <div>
                        <div className={`text-[10px] mb-1.5 flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <Clock size={10} /> {t.peakPricing}
                        </div>
                        <div className="space-y-1.5">
                          {timeOverrides.map((o, i) => {
                            const days =
                              o.utc_days
                                ?.map((d) =>
                                  lang === "zh"
                                    ? ({
                                        monday: "周一",
                                        tuesday: "周二",
                                        wednesday: "周三",
                                        thursday: "周四",
                                        friday: "周五",
                                        saturday: "周六",
                                        sunday: "周日"
                                      }[d] ?? d)
                                    : d.slice(0, 3)
                                )
                                .join(", ") ?? ""
                            const timeRange =
                              o.utc_start != null && o.utc_end != null
                                ? `${String(o.utc_start).padStart(2, "0")}:00–${String(o.utc_end).padStart(2, "0")}:00 UTC`
                                : ""
                            const isWeekend = o.utc_days?.every(
                              (d) => d === "saturday" || d === "sunday"
                            )
                            return (
                              <div key={i} className={`rounded-lg p-2 text-[11px] ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] ${isWeekend ? (isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700") : (isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-700")}`}
                                  >
                                    {isWeekend ? t.weekend : t.weekday}
                                  </span>
                                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{days}</span>
                                  {timeRange && <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{timeRange}</span>}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  {o.prompt && (
                                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                                      {t.prompt}: {formatPrice(o.prompt, lang)}
                                    </span>
                                  )}
                                  {o.completion && (
                                    <span className={isDark ? 'text-sky-400' : 'text-sky-600'}>
                                      {t.completion}: {formatPrice(o.completion, lang)}
                                    </span>
                                  )}
                                  {o.input_cache_read && (
                                    <span className={isDark ? 'text-violet-400' : 'text-violet-600'}>
                                      {t.cacheRead}: {formatPrice(o.input_cache_read, lang)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {/* Token-based overrides */}
                    {tokenOverrides.length > 0 && (
                      <div>
                        <div className={`text-[10px] mb-1.5 flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <Layers size={10} /> {t.tieredPricing}
                        </div>
                        <div className="space-y-1.5">
                          {tokenOverrides.map((o, i) => (
                            <div key={i} className={`rounded-lg p-2 text-[11px] ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                              <div className="mb-1">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-700'}`}>
                                  ≥{formatCtx(o.min_prompt_tokens!)} {t.aboveTokens}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                {o.prompt && (
                                  <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                                    {t.prompt}: {formatPrice(o.prompt, lang)}
                                  </span>
                                )}
                                {o.completion && (
                                  <span className={isDark ? 'text-sky-400' : 'text-sky-600'}>
                                    {t.completion}: {formatPrice(o.completion, lang)}
                                  </span>
                                )}
                                {o.input_cache_read && (
                                  <span className={isDark ? 'text-violet-400' : 'text-violet-600'}>
                                    {t.cacheRead}: {formatPrice(o.input_cache_read, lang)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
          </div>

          {/* Capabilities */}
          <div>
            <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              <Zap size={12} /> {t.capabilities}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{t.contextLengthLabel}</span>
                <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{model.context_length} tokens</div>
                {model.top_provider?.context_length &&
                  model.top_provider.context_length !== model.context_length && (
                    <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t.contextTopProvider}: {model.top_provider.context_length} tokens
                    </div>
                  )}
              </div>
              {model.top_provider?.max_completion_tokens && (
                <div className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{t.maxOutput}</span>
                  <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {model.top_provider.max_completion_tokens} tokens
                  </div>
                </div>
              )}
              {model.architecture?.tokenizer && (
                <div className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{t.tokenizer}</span>
                  <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{model.architecture.tokenizer}</div>
                </div>
              )}
              {model.top_provider?.is_moderated != null && (
                <div className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                  <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{t.moderated}</span>
                  <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {model.top_provider.is_moderated ? t.yes : t.no}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reasoning */}
          {model.reasoning && (
            <div>
              <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <Brain size={12} /> {t.reasoningLabel}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(model.reasoning.supported_efforts ?? []).map((e) => (
                  <span
                    key={e}
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      e === model.reasoning!.default_effort
                        ? isDark ? "bg-violet-500/30 text-violet-200 ring-1 ring-violet-500/40" : "bg-violet-100 text-violet-700 ring-1 ring-violet-300"
                        : isDark ? "bg-gray-800 text-gray-400" : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {e} {e === model.reasoning!.default_effort && "★"}
                  </span>
                ))}
              </div>
              <div className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {model.reasoning.mandatory ? t.mandatory : t.optional}
                {model.reasoning.default_enabled && ` · ${t.enabledByDefault}`}
              </div>
            </div>
          )}

          {/* Benchmarks */}
          {benchmarks && (
            <div>
              <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <BarChart3 size={12} /> {t.benchmarks}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t.intelligence, val: benchmarks.intelligence_index, max: 70 },
                  { label: t.codingIndex, val: benchmarks.coding_index, max: 90 },
                  { label: t.agentic, val: benchmarks.agentic_index, max: 70 }
                ]
                  .filter((b) => b.val != null)
                  .map((b) => (
                    <div key={b.label} className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                      <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{b.label}</div>
                      <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{b.val}</div>
                      <div className={`h-1 rounded-full mt-1 overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                          style={{ width: `${Math.min((b.val! / b.max) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Design Arena */}
          {arenas.length > 0 && (
            <div>
              <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <Sparkles size={12} /> {t.designArena}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {arenas.map((a) => (
                  <div key={`${a.arena}-${a.category}`} className={`rounded-lg p-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                    <div className={`text-[10px] capitalize ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {a.category.replace(/-/g, " ")}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>#{a.rank}</span>
                      <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ELO {a.elo}</span>
                    </div>
                    <div className={`text-[10px] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {a.win_rate}% {t.winRate}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parameters */}
          <div>
            <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t.supportedParams}</h4>
            <div className="flex flex-wrap gap-1">
              {(model.supported_parameters ?? []).map((p) => (
                <span
                  key={p}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div className={`flex items-center gap-4 text-[10px] pt-2 border-t ${isDark ? 'text-gray-500 border-white/5' : 'text-gray-400 border-gray-200'}`}>
            <span className="flex items-center gap-1">
              <Clock size={10} /> {formatDate(model.created, lang)}
            </span>
            <span>
              {daysSince(model.created)} {t.daysAgo}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pricing Chart ───────────────────────────────────────────────────
function PricingChart({ models }: { models: Model[] }) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const data = useMemo(() => {
    return models
      .filter((m) => !m.id.includes(":batch") && !m.synthesizedFreeVariant && !m.id.startsWith("~"))
      .filter((m) => {
        const p = bn(m.pricing?.prompt)
        return p.gt(0) && p.lt(0.00001)
      })
      .map((m) => ({
        name: m.name
          .replace(
            /^(Anthropic|Google|Meta|DeepSeek|Qwen|NVIDIA|IBM|Inception|MoonshotAI|ByteDance|Z\.ai|Upstage|Poolside|Sakana|Thinking Machines|Meituan|Tencent|InclusionAI|VoyageAI):\s*/,
            ""
          )
          .slice(0, 20),
        provider: getProvider(m.id),
        prompt: bn(m.pricing?.prompt).times(1e6).toNumber(),
        completion: bn(m.pricing?.completion).times(1e6).toNumber(),
        color: getProviderColor(m.id)
      }))
      .sort((a, b) => a.prompt - b.prompt)
      .slice(0, 20)
  }, [models])

  return (
    <div className="glass rounded-2xl p-4 animate-fade-in">
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
        <DollarSign size={14} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} /> {t.promptPriceChart}
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 80, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
          <XAxis
            type="number"
            tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
            tickFormatter={(v) => `$${v.toFixed(2)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: isDark ? "#D1D5DB" : "#374151", fontSize: 10 }}
            width={80}
          />
          <Tooltip
            contentStyle={{
              background: isDark ? "#1F2937" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 12,
              color: isDark ? "#f3f4f6" : "#111827"
            }}
            formatter={(v) => [`$${Number(v).toFixed(4)}/M`, "Prompt Price"]}
          />
          <Bar dataKey="prompt" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Benchmark Scatter ───────────────────────────────────────────────
function BenchmarkScatter({ models }: { models: Model[] }) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const data = useMemo(() => {
    return models
      .filter(
        (m) =>
          m.benchmarks?.artificial_analysis?.intelligence_index != null && !m.id.includes(":batch")
      )
      .filter((m) => !m.id.startsWith("~"))
      .map((m) => ({
        name: m.name
          .replace(
            /^(Anthropic|Google|Meta|DeepSeek|Qwen|NVIDIA|IBM|Inception|MoonshotAI|ByteDance|Z\.ai|Upstage|Poolside|Sakana|Thinking Machines|Meituan|Tencent|InclusionAI|VoyageAI):\s*/,
            ""
          )
          .slice(0, 18),
        intelligence: m.benchmarks!.artificial_analysis!.intelligence_index!,
        coding: m.benchmarks!.artificial_analysis!.coding_index ?? 0,
        agentic: m.benchmarks!.artificial_analysis!.agentic_index ?? 0,
        prompt: bn(m.pricing?.prompt).times(1e6).toNumber(),
        color: getProviderColor(m.id),
        provider: getProvider(m.id)
      }))
  }, [models])

  return (
    <div className="glass rounded-2xl p-4 animate-fade-in">
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
        <Brain size={14} className={isDark ? 'text-violet-400' : 'text-violet-600'} /> {t.intelligenceVsCoding}
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ bottom: 8, left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
          <XAxis
            type="number"
            dataKey="coding"
            name="Coding"
            tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
            label={{ value: "Coding Index", position: "bottom", fill: isDark ? "#6B7280" : "#9CA3AF", fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="intelligence"
            name="Intelligence"
            tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
            label={{
              value: "Intelligence",
              angle: -90,
              position: "insideLeft",
              fill: isDark ? "#6B7280" : "#9CA3AF",
              fontSize: 10
            }}
          />
          <Tooltip
            contentStyle={{
              background: isDark ? "#1F2937" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 12,
              color: isDark ? "#f3f4f6" : "#111827"
            }}
            formatter={(v, n) => [Number(v).toFixed(1), String(n)]}
            labelFormatter={() => ""}
          />
          <Scatter data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={0.85} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2 justify-center">
        {Array.from(new Set(data.map((d) => d.provider))).map((p) => (
          <span key={p} className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: providerColors[p] ?? "#6B7280" }}
            />
            {p}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Context Length Chart ────────────────────────────────────────────
function ContextChart({ models }: { models: Model[] }) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const data = useMemo(() => {
    const byProvider = new Map<
      string,
      { provider: string; maxCtx: number; count: number; color: string }
    >()
    models
      .filter((m) => !m.id.startsWith("~"))
      .forEach((m) => {
        const p = getProvider(m.id)
        const existing = byProvider.get(p)
        if (existing) {
          existing.maxCtx = Math.max(existing.maxCtx, m.context_length)
          existing.count++
        } else {
          byProvider.set(p, {
            provider: p,
            maxCtx: m.context_length,
            count: 1,
            color: getProviderColor(m.id)
          })
        }
      })
    return Array.from(byProvider.values()).sort((a, b) => b.maxCtx - a.maxCtx)
  }, [models])

  return (
    <div className="glass rounded-2xl p-4 animate-fade-in">
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
        <Layers size={14} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} /> {t.maxContextByProvider}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
          <XAxis
            dataKey="provider"
            tick={{ fill: isDark ? "#D1D5DB" : "#374151", fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 10 }} tickFormatter={(v) => formatCtx(v)} />
          <Tooltip
            contentStyle={{
              background: isDark ? "#1F2937" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 12,
              color: isDark ? "#f3f4f6" : "#111827"
            }}
            formatter={(v) => [Number(v).toLocaleString() + " tokens", "Max Context"]}
          />
          <Bar dataKey="maxCtx" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Provider Pie ────────────────────────────────────────────────────
function ProviderPie({ models }: { models: Model[] }) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const data = useMemo(() => {
    const counts = new Map<string, number>()
    models
      .filter((m) => !m.id.startsWith("~"))
      .forEach((m) => {
        const p = getProvider(m.id)
        counts.set(p, (counts.get(p) ?? 0) + 1)
      })
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value, color: providerColors[name] ?? "#6B7280" }))
      .sort((a, b) => b.value - a.value)
  }, [models])

  return (
    <div className="glass rounded-2xl p-4 animate-fade-in">
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
        <Globe size={14} className={isDark ? 'text-amber-400' : 'text-amber-600'} /> {t.modelsByProvider}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={40}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={0.8} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: isDark ? "#1F2937" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 12,
              color: isDark ? "#f3f4f6" : "#111827"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 justify-center mt-1">
        {data.slice(0, 8).map((d) => (
          <span key={d.name} className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.name} ({d.value})
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Filter Bar ──────────────────────────────────────────────────────
function FilterBar({
  search,
  setSearch,
  provider,
  setProvider,
  modality,
  setModality,
  sortBy,
  setSortBy,
  showReasoning,
  setShowReasoning,
  showFree,
  setShowFree,
  viewMode,
  setViewMode,
  providers,
  modalities
}: {
  search: string
  setSearch: (v: string) => void
  provider: string
  setProvider: (v: string) => void
  modality: string
  setModality: (v: string) => void
  sortBy: string
  setSortBy: (v: string) => void
  showReasoning: boolean
  setShowReasoning: (v: boolean) => void
  showFree: boolean
  setShowFree: (v: boolean) => void
  viewMode: "grid" | "list"
  setViewMode: (v: "grid" | "list") => void
  providers: string[]
  modalities: string[]
}) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const inputClass = `w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50 border ${isDark ? 'bg-gray-900/50 text-gray-200 placeholder-gray-500 border-white/5' : 'bg-white text-gray-900 placeholder-gray-400 border-gray-200'}`
  const selectClass = `px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50 border ${isDark ? 'bg-gray-900/50 text-gray-300 border-white/5' : 'bg-white text-gray-700 border-gray-200'}`

  return (
    <div className="glass rounded-2xl p-3 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X size={14} className={isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} />
            </button>
          )}
        </div>

        {/* Provider */}
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className={selectClass}
        >
          <option value="">{t.allProviders}</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Modality */}
        <select
          value={modality}
          onChange={(e) => setModality(e.target.value)}
          className={selectClass}
        >
          <option value="">{t.allModalities}</option>
          {modalities.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className={selectClass}
        >
          <option value="newest">{t.newest}</option>
          <option value="prompt-asc">{t.priceLowHigh}</option>
          <option value="prompt-desc">{t.priceHighLow}</option>
          <option value="context">{t.contextLength}</option>
          <option value="intelligence">{t.intelligence}</option>
          <option value="coding">{t.codingIndex}</option>
          <option value="name">{t.nameAZ}</option>
        </select>

        {/* Toggles */}
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className={`px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${
            showReasoning
              ? isDark ? "bg-violet-500/20 text-violet-300 border-violet-500/30" : "bg-violet-100 text-violet-700 border-violet-300"
              : isDark ? "bg-gray-900/50 text-gray-400 border-white/5" : "bg-gray-100 text-gray-500 border-gray-200"
          }`}
        >
          <Brain size={12} /> {t.reasoning}
        </button>

        <button
          onClick={() => setShowFree(!showFree)}
          className={`px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${
            showFree
              ? isDark ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-green-100 text-green-700 border-green-300"
              : isDark ? "bg-gray-900/50 text-gray-400 border-white/5" : "bg-gray-100 text-gray-500 border-gray-200"
          }`}
        >
          <Sparkles size={12} /> {t.free}
        </button>

        {/* View toggle */}
        <div className={`flex rounded-lg border overflow-hidden ${isDark ? 'bg-gray-900/50 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 ${viewMode === "grid" ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : (isDark ? "text-gray-500" : "text-gray-400")}`}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : (isDark ? "text-gray-500" : "text-gray-400")}`}
          >
            <List size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────────
function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang")
    if (saved === "zh" || saved === "en") return saved
    return "zh"
  })
  const t = translations[lang]

  const handleSetLang = (l: Lang) => {
    setLang(l)
    localStorage.setItem("lang", l)
  }
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme")
    if (saved === "light" || saved === "dark") return saved
    return "dark"
  })
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [provider, setProvider] = useState("")
  const [modality, setModality] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [showReasoning, setShowReasoning] = useState(false)
  const [showFree, setShowFree] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<"models" | "charts">("models")

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      localStorage.setItem("theme", next)
      return next
    })
  }

  useEffect(() => {
    document.body.className = theme
  }, [theme])

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/models", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setModels(d.data ?? [])
        setLoading(false)
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  const providers = useMemo(
    () => [...new Set(models.map((m) => getProvider(m.id)))].sort(),
    [models]
  )

  const modalities = useMemo(() => {
    const s = new Set<string>()
    models.forEach((m) => m.architecture?.input_modalities?.forEach((mod) => s.add(mod)))
    return [...s].sort()
  }, [models])

  const filtered = useMemo(() => {
    let result = models

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q)
      )
    }
    if (provider) result = result.filter((m) => getProvider(m.id) === provider)
    if (modality)
      result = result.filter((m) => m.architecture?.input_modalities?.includes(modality))
    if (showReasoning) result = result.filter((m) => m.reasoning)
    if (showFree) result = result.filter((m) => bn(m.pricing?.prompt).isZero())

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.created - a.created
        case "prompt-asc":
          return bn(a.pricing?.prompt)
            .minus(b.pricing?.prompt ?? "0")
            .toNumber()
        case "prompt-desc":
          return bn(b.pricing?.prompt)
            .minus(a.pricing?.prompt ?? "0")
            .toNumber()
        case "context":
          return b.context_length - a.context_length
        case "intelligence":
          return (
            (b.benchmarks?.artificial_analysis?.intelligence_index ?? 0) -
            (a.benchmarks?.artificial_analysis?.intelligence_index ?? 0)
          )
        case "coding":
          return (
            (b.benchmarks?.artificial_analysis?.coding_index ?? 0) -
            (a.benchmarks?.artificial_analysis?.coding_index ?? 0)
          )
        case "name":
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return result
  }, [models, search, provider, modality, sortBy, showReasoning, showFree])

  const stats = useMemo(
    () => ({
      total: models.length,
      providers: new Set(models.map((m) => getProvider(m.id))).size,
      reasoning: models.filter((m) => m.reasoning).length,
      free: models.filter((m) => bn(m.pricing?.prompt).isZero()).length,
      avgIntelligence: (() => {
        const vals = models
          .map((m) => m.benchmarks?.artificial_analysis?.intelligence_index)
          .filter((v): v is number => v != null)
        if (!vals.length) return "—"
        const sum = vals.reduce((acc, v) => acc.plus(v), new BigNumber(0))
        return sum.div(vals.length).toFixed(1)
      })()
    }),
    [models]
  )

  if (loading) {
    return (
      <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
        <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t.loading}</p>
            </div>
          </div>
        </LangContext.Provider>
      </ThemeContext.Provider>
    )
  }

  if (error) {
    return (
      <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
        <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center glass rounded-2xl p-8">
              <p className="text-red-400 text-sm mb-2">{t.loadFailed}</p>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{error}</p>
            </div>
          </div>
        </LangContext.Provider>
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
        <div className="min-h-screen">
          {/* Header */}
          <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${theme === 'dark' ? 'bg-gray-950/80 border-white/5' : 'bg-white/80 border-gray-200'}`}>
            <div className="max-w-[1600px] mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
                    <Cpu size={16} className="text-white" />
                  </div>
                  <div>
                    <h1 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t.title}</h1>
                    <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{t.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTab("models")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      tab === "models"
                        ? theme === 'dark' ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700"
                        : theme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Grid3X3 size={12} className="inline mr-1" /> {t.models}
                  </button>
                  <button
                    onClick={() => setTab("charts")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      tab === "charts"
                        ? theme === 'dark' ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700"
                        : theme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <BarChart3 size={12} className="inline mr-1" /> {t.analytics}
                  </button>
                  <a
                    href="https://inference-api.nousresearch.com/v1/models"
                    target="_blank"
                    rel="noopener"
                    className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    API <ExternalLink size={10} />
                  </a>
                  {/* Theme Toggle */}
                  <button
                    onClick={toggleTheme}
                    className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-yellow-300 hover:bg-yellow-500/10' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                  {/* Language Toggle */}
                  <button
                    onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${theme === 'dark' ? 'bg-gray-800/50 text-gray-300 hover:text-white hover:bg-gray-700/50' : 'bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}
                  >
                    <Globe size={12} />
                    {lang === "zh" ? "EN" : "中"}
                  </button>
                </div>
              </div>
            </div>
          </header>

        <main className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard icon={<Layers size={18} />} label={t.totalModels} value={stats.total} />
            <StatCard icon={<Globe size={18} />} label={t.providers} value={stats.providers} />
            <StatCard
              icon={<Brain size={18} />}
              label={t.reasoningModels}
              value={stats.reasoning}
            />
            <StatCard icon={<Sparkles size={18} />} label={t.freeModels} value={stats.free} />
            <StatCard
              icon={<Activity size={18} />}
              label={t.avgIntelligence}
              value={stats.avgIntelligence}
            />
          </div>

          {tab === "models" ? (
            <>
              {/* Filters */}
              <FilterBar
                search={search}
                setSearch={setSearch}
                provider={provider}
                setProvider={setProvider}
                modality={modality}
                setModality={setModality}
                sortBy={sortBy}
                setSortBy={setSortBy}
                showReasoning={showReasoning}
                setShowReasoning={setShowReasoning}
                showFree={showFree}
                setShowFree={setShowFree}
                viewMode={viewMode}
                setViewMode={setViewMode}
                providers={providers}
                modalities={modalities}
              />

              {/* Results count */}
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {t.showing} {filtered.length} {t.of} {models.length} {t.modelsCount}
                {search && (
                  <span>
                    {" "}
                    {t.matching} "{search}"
                  </span>
                )}
              </div>

              {/* Model Grid */}
              <div
                className={`grid gap-3 ${
                  viewMode === "grid"
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    : "grid-cols-1"
                }`}
              >
                {filtered.map((m) => (
                  <ModelCard
                    key={m.id}
                    model={m}
                    expanded={expandedId === m.id}
                    onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                  />
                ))}
              </div>

              {filtered.length === 0 && (
                <div className={`text-center py-16 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Search size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t.noModels}</p>
                </div>
              )}
            </>
          ) : (
            /* Charts Tab */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PricingChart models={models} />
              <BenchmarkScatter models={models} />
              <ContextChart models={models} />
              <ProviderPie models={models} />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className={`border-t mt-8 ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
          <div className={`max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between text-[10px] ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
            <span>{t.dataFrom}</span>
            <span>{t.builtWith}</span>
          </div>
        </footer>
      </div>
      </LangContext.Provider>
    </ThemeContext.Provider>
  )
}

// ─── Mount ───────────────────────────────────────────────────────────
const root = createRoot(document.getElementById("root")!)
root.render(<App />)
