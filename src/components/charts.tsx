import React, { useMemo } from "react"
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
  Pie,
  ZAxis
} from "recharts"
import { DollarSign, Brain, Layers, Globe, Tag } from "lucide-react"
import type { Model } from "../types"
import { useLang } from "../i18n"
import { useTheme, useCurrency } from "../contexts"
import {
  bn,
  currencyUnit,
  formatCtx,
  formatDiscount,
  getDiscount,
  getProvider,
  getProviderColor,
  providerColors,
  stripZeros
} from "../utils"

const PROVIDER_PREFIX =
  /^(Anthropic|Google|Meta|DeepSeek|Qwen|NVIDIA|IBM|Inception|MoonshotAI|ByteDance|Z\.ai|Upstage|Poolside|Sakana|Thinking Machines|Meituan|Tencent|InclusionAI|VoyageAI):\s*/

function shortName(name: string, max: number): string {
  return name.replace(PROVIDER_PREFIX, "").slice(0, max)
}

function tooltipStyle(isDark: boolean): React.CSSProperties {
  return {
    background: isDark ? "#12112f" : "#ffffff",
    border: isDark ? "1px solid rgba(190,190,220,0.15)" : "1px solid #d6d6e5",
    borderRadius: 8,
    fontSize: 12,
    color: isDark ? "#f5f5f8" : "#12112f"
  }
}

function gridStroke(isDark: boolean): string {
  return isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"
}

function fmtPrice(v: number, sym: string): string {
  return `${sym}${v >= 1 ? v.toFixed(2) : stripZeros(v.toFixed(4))}`
}

function ChartCard({
  icon,
  title,
  desc,
  empty,
  children
}: {
  icon: React.ReactNode
  title: string
  desc?: string
  empty?: boolean
  children: React.ReactNode
}) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  return (
    <div className="glass rounded-2xl p-4 animate-fade-in">
      <h3
        className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? "text-gray-200" : "text-gray-700"}`}
      >
        {icon} {title}
      </h3>
      {desc && (
        <p className={`text-xs mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{desc}</p>
      )}
      {empty ? (
        <div
          className={`h-[200px] flex items-center justify-center text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}
        >
          {t.noData}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="opacity-60">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function ScatterTip(props: any) {
  const { active, payload, t, isDark, currency, rate } = props
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const sym = currency === "CNY" ? "¥" : "$"
  const price = d.prompt * (currency === "CNY" ? rate : 1)
  return (
    <div style={tooltipStyle(isDark)} className="p-2 rounded-lg min-w-[200px]">
      <div className="font-semibold text-xs mb-1">{d.name}</div>
      <div className="opacity-60 text-[10px] mb-1">{d.provider}</div>
      <TipRow label={t.intelligence} value={Number(d.intelligence).toFixed(1)} />
      <TipRow label={t.codingIndex} value={Number(d.coding).toFixed(1)} />
      <TipRow label={t.agentic} value={Number(d.agentic).toFixed(1)} />
      <TipRow label={t.promptPrice} value={`${fmtPrice(price, sym)}/M`} />
    </div>
  )
}

function ValueTip(props: any) {
  const { active, payload, t, isDark, currency, rate } = props
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const sym = currency === "CNY" ? "¥" : "$"
  const price = d.price * (currency === "CNY" ? rate : 1)
  return (
    <div style={tooltipStyle(isDark)} className="p-2 rounded-lg min-w-[200px]">
      <div className="font-semibold text-xs mb-1">{d.name}</div>
      <div className="opacity-60 text-[10px] mb-1">{d.provider}</div>
      <TipRow label={t.intelligence} value={Number(d.intel).toFixed(1)} />
      <TipRow label={t.promptPrice} value={`${fmtPrice(price, sym)}/M`} />
      <TipRow label={t.context} value={formatCtx(d.ctx)} />
    </div>
  )
}

function DiscountTip(props: any) {
  const { active, payload, t, isDark, lang, currency, rate } = props
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const sym = currency === "CNY" ? "¥" : "$"
  const conv = currency === "CNY" ? rate : 1
  return (
    <div style={tooltipStyle(isDark)} className="p-2 rounded-lg min-w-[200px]">
      <div className="font-semibold text-xs mb-1">{d.name}</div>
      <div
        className={`font-semibold text-sm mb-1 ${isDark ? "text-emerald-300" : "text-emerald-600"}`}
      >
        {formatDiscount(d.ratio, lang)}
      </div>
      {d.orig > 0 && <TipRow label={t.originalPrice} value={`${fmtPrice(d.orig * conv, sym)}/M`} />}
      <TipRow label={t.currentPrice} value={`${fmtPrice(d.now * conv, sym)}/M`} />
    </div>
  )
}

function PieTip(props: any) {
  const { active, payload, isDark } = props
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const pct = ((d.value / d.total) * 100).toFixed(1)
  return (
    <div style={tooltipStyle(isDark)} className="p-2 rounded-lg">
      <span className="font-semibold">{d.name}</span> {d.value} ({pct}%)
    </div>
  )
}

function ProviderLegend({ providers }: { providers: string[] }) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  return (
    <div className="flex flex-wrap gap-2 mt-2 justify-center">
      {providers.map((p) => (
        <span
          key={p}
          className={`flex items-center gap-1 text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: providerColors[p] ?? "#6e6ba6" }}
          />
          {p}
        </span>
      ))}
    </div>
  )
}

const AXIS_TICK_DARK = "#8484b0"
const AXIS_TICK_LIGHT = "#6e6ba6"

export function PricingChart({ models }: { models: Model[] }) {
  const { lang, t } = useLang()
  const { theme } = useTheme()
  const { currency, exchangeRate } = useCurrency()
  const isDark = theme === "dark"
  const conv = currency === "CNY" ? exchangeRate : 1
  const sym = currency === "CNY" ? "¥" : "$"
  const data = useMemo(() => {
    return models
      .filter((m) => !m.id.includes(":batch") && !m.synthesizedFreeVariant && !m.id.startsWith("~"))
      .filter((m) => {
        const p = bn(m.pricing?.prompt)
        return p.gt(0) && p.lt(0.00001)
      })
      .map((m) => ({
        id: m.id,
        name: shortName(m.name, 20),
        prompt: bn(m.pricing?.prompt).times(1e6).times(conv).toNumber(),
        color: getProviderColor(m.id)
      }))
      .sort((a, b) => a.prompt - b.prompt)
      .slice(0, 20)
  }, [models, conv])

  return (
    <ChartCard
      icon={<DollarSign size={14} className={isDark ? "text-brand-400" : "text-brand-600"} />}
      title={`${t.promptPriceChart} · ${currencyUnit(lang, currency)}`}
      desc={t.promptPriceChartDesc}
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(isDark)} />
          <XAxis
            type="number"
            tick={{ fill: isDark ? AXIS_TICK_DARK : AXIS_TICK_LIGHT, fontSize: 10 }}
            tickFormatter={(v) => `${sym}${v.toFixed(2)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: isDark ? "#bebedc" : "#514e88", fontSize: 10 }}
            width={60}
          />
          <Tooltip
            cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
            contentStyle={tooltipStyle(isDark)}
            formatter={(v) => [`${fmtPrice(Number(v), sym)}/M`, t.promptPrice]}
          />
          <Bar dataKey="prompt" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function BenchmarkScatter({
  models,
  onShowDetails
}: {
  models: Model[]
  onShowDetails: (id: string) => void
}) {
  const { t } = useLang()
  const { theme } = useTheme()
  const { currency, exchangeRate } = useCurrency()
  const isDark = theme === "dark"
  const data = useMemo(() => {
    return models
      .filter(
        (m) =>
          m.benchmarks?.artificial_analysis?.intelligence_index != null && !m.id.includes(":batch")
      )
      .filter((m) => !m.id.startsWith("~"))
      .map((m) => ({
        id: m.id,
        name: shortName(m.name, 18),
        intelligence: m.benchmarks!.artificial_analysis!.intelligence_index!,
        coding: m.benchmarks!.artificial_analysis!.coding_index ?? 0,
        agentic: m.benchmarks!.artificial_analysis!.agentic_index ?? 0,
        prompt: bn(m.pricing?.prompt).times(1e6).toNumber(),
        color: getProviderColor(m.id),
        provider: getProvider(m.id)
      }))
  }, [models])

  const handlePointClick = (entry: any) => {
    const d = entry?.payload ?? entry
    if (d?.id) onShowDetails(d.id)
  }

  return (
    <ChartCard
      icon={<Brain size={14} className={isDark ? "text-brand-400" : "text-brand-600"} />}
      title={t.intelligenceVsCoding}
      desc={t.intelligenceVsCodingDesc}
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ bottom: 4, left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(isDark)} />
          <XAxis
            type="number"
            dataKey="coding"
            name="Coding"
            tick={{ fill: isDark ? AXIS_TICK_DARK : AXIS_TICK_LIGHT, fontSize: 10 }}
            label={{
              value: "Coding Index",
              position: "bottom",
              fill: isDark ? "#6e6ba6" : "#8484b0",
              fontSize: 10
            }}
          />
          <YAxis
            type="number"
            dataKey="intelligence"
            name="Intelligence"
            tick={{ fill: isDark ? AXIS_TICK_DARK : AXIS_TICK_LIGHT, fontSize: 10 }}
            label={{
              value: "Intelligence",
              angle: -90,
              position: "insideLeft",
              fill: isDark ? "#6e6ba6" : "#8484b0",
              fontSize: 10
            }}
          />
          <Tooltip
            content={<ScatterTip isDark={isDark} t={t} currency={currency} rate={exchangeRate} />}
          />
          <Scatter data={data} onClick={handlePointClick} cursor="pointer">
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} fillOpacity={0.85} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <ProviderLegend providers={Array.from(new Set(data.map((d) => d.provider)))} />
    </ChartCard>
  )
}

export function ValueScatter({
  models,
  onShowDetails
}: {
  models: Model[]
  onShowDetails: (id: string) => void
}) {
  const { t } = useLang()
  const { theme } = useTheme()
  const { currency, exchangeRate } = useCurrency()
  const isDark = theme === "dark"
  const conv = currency === "CNY" ? exchangeRate : 1
  const sym = currency === "CNY" ? "¥" : "$"
  const data = useMemo(() => {
    return models
      .filter(
        (m) =>
          m.benchmarks?.artificial_analysis?.intelligence_index != null &&
          !m.id.includes(":batch") &&
          !m.id.startsWith("~") &&
          !m.synthesizedFreeVariant
      )
      .map((m) => ({
        id: m.id,
        name: shortName(m.name, 22),
        intel: m.benchmarks!.artificial_analysis!.intelligence_index!,
        price: bn(m.pricing?.prompt).times(1e6).times(conv).toNumber(),
        ctx: m.context_length,
        color: getProviderColor(m.id),
        provider: getProvider(m.id)
      }))
      .filter((d) => d.price > 0)
  }, [models, conv])

  const handlePointClick = (entry: any) => {
    const d = entry?.payload ?? entry
    if (d?.id) onShowDetails(d.id)
  }

  return (
    <ChartCard
      icon={<Brain size={14} className={isDark ? "text-amber-400" : "text-amber-600"} />}
      title={t.valueScatter}
      desc={t.valueScatterDesc}
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ bottom: 4, left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(isDark)} />
          <XAxis
            type="number"
            dataKey="price"
            scale="log"
            domain={["auto", "auto"]}
            tick={{ fill: isDark ? AXIS_TICK_DARK : AXIS_TICK_LIGHT, fontSize: 10 }}
            tickFormatter={(v) => fmtPrice(Number(v), sym)}
            label={{
              value: `${t.promptPrice} (${sym}/M, log)`,
              position: "bottom",
              fill: isDark ? "#6e6ba6" : "#8484b0",
              fontSize: 10
            }}
          />
          <YAxis
            type="number"
            dataKey="intel"
            domain={[0, 100]}
            tick={{ fill: isDark ? AXIS_TICK_DARK : AXIS_TICK_LIGHT, fontSize: 10 }}
            label={{
              value: t.intelligence,
              angle: -90,
              position: "insideLeft",
              fill: isDark ? "#6e6ba6" : "#8484b0",
              fontSize: 10
            }}
          />
          <ZAxis type="number" dataKey="ctx" range={[60, 380]} />
          <Tooltip
            content={<ValueTip isDark={isDark} t={t} currency={currency} rate={exchangeRate} />}
          />
          <Scatter data={data} onClick={handlePointClick} cursor="pointer">
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} fillOpacity={0.75} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <ProviderLegend providers={Array.from(new Set(data.map((d) => d.provider)))} />
    </ChartCard>
  )
}

export function DiscountChart({ models }: { models: Model[] }) {
  const { lang, t } = useLang()
  const { theme } = useTheme()
  const { currency, exchangeRate } = useCurrency()
  const isDark = theme === "dark"
  const conv = currency === "CNY" ? exchangeRate : 1
  const sym = currency === "CNY" ? "¥" : "$"
  const data = useMemo(() => {
    return models
      .filter((m) => !m.id.includes(":batch") && !m.id.startsWith("~") && !m.synthesizedFreeVariant)
      .map((m) => {
        const d = getDiscount(m)
        if (!d) return null
        const fromPrompt =
          d.originalPrompt != null && bn(m.pricing?.prompt).lt(bn(d.originalPrompt))
        const now = fromPrompt ? m.pricing?.prompt : m.pricing?.completion
        const orig = fromPrompt ? d.originalPrompt : d.originalCompletion
        return {
          id: m.id,
          name: shortName(m.name, 20),
          depth: (1 - d.ratio) * 100,
          ratio: d.ratio,
          now: bn(now).times(1e6).toNumber(),
          orig: orig ? bn(orig).times(1e6).toNumber() : 0,
          color: getProviderColor(m.id)
        }
      })
      .filter((d): d is NonNullable<typeof d> => d != null)
      .sort((a, b) => b.depth - a.depth)
      .slice(0, 10)
  }, [models])

  return (
    <ChartCard
      icon={<Tag size={14} className={isDark ? "text-emerald-400" : "text-emerald-600"} />}
      title={t.discountChart}
      desc={t.discountChartDesc}
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(isDark)} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: isDark ? AXIS_TICK_DARK : AXIS_TICK_LIGHT, fontSize: 10 }}
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: isDark ? "#bebedc" : "#514e88", fontSize: 10 }}
            width={60}
          />
          <Tooltip
            cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
            content={
              <DiscountTip
                isDark={isDark}
                t={t}
                lang={lang}
                currency={currency}
                rate={exchangeRate}
              />
            }
          />
          <Bar dataKey="depth" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function ContextChart({ models }: { models: Model[] }) {
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
    <ChartCard
      icon={<Layers size={14} className={isDark ? "text-brand-400" : "text-brand-600"} />}
      title={t.maxContextByProvider}
      desc={t.maxContextByProviderDesc}
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(isDark)} />
          <XAxis
            dataKey="provider"
            tick={{ fill: isDark ? AXIS_TICK_DARK : AXIS_TICK_LIGHT, fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fill: isDark ? "#bebedc" : "#514e88", fontSize: 10 }}
            tickFormatter={(v) => formatCtx(v)}
          />
          <Tooltip
            cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
            contentStyle={tooltipStyle(isDark)}
            formatter={(v) => [Number(v).toLocaleString() + " tokens", t.maxContext]}
          />
          <Bar dataKey="maxCtx" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.provider} fill={d.color} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function ProviderPie({ models }: { models: Model[] }) {
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
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0)
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value, total, color: providerColors[name] ?? "#6e6ba6" }))
      .sort((a, b) => b.value - a.value)
  }, [models])

  return (
    <ChartCard
      icon={<Globe size={14} className={isDark ? "text-amber-400" : "text-amber-600"} />}
      title={t.modelsByProvider}
      desc={t.modelsByProviderDesc}
      empty={data.length === 0}
    >
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
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} fillOpacity={0.8} />
            ))}
          </Pie>
          <Tooltip content={<PieTip isDark={isDark} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 justify-center mt-1">
        {data.slice(0, 8).map((d) => (
          <span
            key={d.name}
            className={`flex items-center gap-1 text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.name} ({d.value})
          </span>
        ))}
      </div>
    </ChartCard>
  )
}
