import React, { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell, PieChart, Pie } from "recharts"
import { DollarSign, Brain, Layers, Globe } from "lucide-react"
import type { Model } from "../types"
import { useLang } from "../i18n"
import { useTheme, useCurrency } from "../contexts"
import { bn, currencyUnit, formatCtx, getProvider, getProviderColor, providerColors } from "../utils"

export function PricingChart({ models }: { models: Model[] }) {
  const { lang, t } = useLang()
  const { theme } = useTheme()
  const { currency } = useCurrency()
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
      <h3
        className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? "text-gray-200" : "text-gray-700"}`}
      >
        <DollarSign size={14} className={isDark ? "text-emerald-400" : "text-emerald-600"} />{" "}
        {t.promptPriceChart} <span className="opacity-60">({currencyUnit(lang, currency)})</span>
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
          />
          <XAxis
            type="number"
            tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
            tickFormatter={(v) => `${currency === "CNY" ? "¥" : "$"}${v.toFixed(2)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: isDark ? "#D1D5DB" : "#374151", fontSize: 10 }}
            width={60}
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

export function BenchmarkScatter({ models }: { models: Model[] }) {
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
      <h3
        className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? "text-gray-200" : "text-gray-700"}`}
      >
        <Brain size={14} className={isDark ? "text-violet-400" : "text-violet-600"} />{" "}
        {t.intelligenceVsCoding}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ bottom: 4, left: 0, right: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
          />
          <XAxis
            type="number"
            dataKey="coding"
            name="Coding"
            tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
            label={{
              value: "Coding Index",
              position: "bottom",
              fill: isDark ? "#6B7280" : "#9CA3AF",
              fontSize: 10
            }}
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
          <span
            key={p}
            className={`flex items-center gap-1 text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
          >
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
    <div className="glass rounded-2xl p-4 animate-fade-in">
      <h3
        className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? "text-gray-200" : "text-gray-700"}`}
      >
        <Layers size={14} className={isDark ? "text-cyan-400" : "text-cyan-600"} />{" "}
        {t.maxContextByProvider}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
          />
          <XAxis
            dataKey="provider"
            tick={{ fill: isDark ? "#D1D5DB" : "#374151", fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
            tickFormatter={(v) => formatCtx(v)}
          />
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
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value, color: providerColors[name] ?? "#6B7280" }))
      .sort((a, b) => b.value - a.value)
  }, [models])

  return (
    <div className="glass rounded-2xl p-4 animate-fade-in">
      <h3
        className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? "text-gray-200" : "text-gray-700"}`}
      >
        <Globe size={14} className={isDark ? "text-amber-400" : "text-amber-600"} />{" "}
        {t.modelsByProvider}
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
          <span
            key={d.name}
            className={`flex items-center gap-1 text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
            {d.name} ({d.value})
          </span>
        ))}
      </div>
    </div>
  )
}

