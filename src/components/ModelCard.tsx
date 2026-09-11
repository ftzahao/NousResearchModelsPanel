import React from "react"
import {
  Copy,
  ChevronDown,
  ChevronUp,
  Brain,
  Shield,
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  Layers,
  Cpu,
  DollarSign,
  Clock,
  Zap,
  BarChart3,
  Sparkles
} from "lucide-react"
import type { Model } from "../types"
import { useLang } from "../i18n"
import { useTheme, useCurrency } from "../contexts"
import {
  bn,
  formatPrice,
  formatCtx,
  formatDate,
  daysSince,
  currencyUnit,
  modalityIcons,
  modalityColors,
  getProvider,
  getProviderColor,
  stripZeros
} from "../utils"

export function ModelCard({
  model,
  expanded,
  onToggle,
  selected,
  onSelect,
  rawDetails,
  onToggleRawDetails
}: {
  model: Model
  expanded: boolean
  onToggle: () => void
  selected: boolean
  onSelect: () => void
  rawDetails: boolean
  onToggleRawDetails: () => void
}) {
  const { lang, t } = useLang()
  const { theme } = useTheme()
  const { currency, exchangeRate } = useCurrency()
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
      id={`model-card-${model.id}`}
      className={`glass rounded-2xl overflow-hidden transition-all duration-300 card-glow animate-fade-in
        ${expanded ? "col-span-full" : ""}`}
    >
      {/* Header */}
      <div
        className={`p-4 cursor-pointer transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-gray-50"}`}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                aria-label={selected ? `Deselect ${model.name}` : `Select ${model.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect()
                }}
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  selected
                    ? "!bg-blue-700 !border-blue-900 text-white shadow-[0_0_0_2px_rgba(37,99,235,0.35)]"
                    : isDark
                      ? "border-gray-500 bg-gray-800/80 text-transparent hover:border-brand-400"
                      : "border-gray-400 bg-white text-transparent shadow-sm hover:border-brand-500"
                }`}
              >
                {selected && (
                  <span
                    aria-hidden="true"
                    className="text-white font-black text-[12px] leading-none"
                    style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
                  >
                    ✓
                  </span>
                )}
              </button>
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <span
                className={`text-sm font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {model.name}
              </span>
              {isNew && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}
                >
                  {t.newLabel}
                </span>
              )}
              {isBatch && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700"}`}
                >
                  {t.batchLabel}
                </span>
              )}
              {isFree && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? "bg-green-500/20 text-green-300" : "bg-green-100 text-green-700"}`}
                >
                  {t.freeLabel}
                </span>
              )}
              {isRouter && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? "bg-cyan-500/20 text-cyan-300" : "bg-cyan-100 text-cyan-700"}`}
                >
                  {t.routerLabel}
                </span>
              )}
            </div>
            <div
              className={`text-[11px] mt-0.5 font-mono truncate ${isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              {model.id}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {model.reasoning?.mandatory && (
              <span title="Reasoning mandatory">
                <Brain size={14} className={isDark ? "text-violet-400" : "text-violet-600"} />
              </span>
            )}
            {model.top_provider?.is_moderated && (
              <span title="Moderated">
                <Shield size={14} className={isDark ? "text-blue-400" : "text-blue-600"} />
              </span>
            )}
            {expanded ? (
              <ChevronUp size={16} className={isDark ? "text-gray-500" : "text-gray-400"} />
            ) : (
              <ChevronDown size={16} className={isDark ? "text-gray-500" : "text-gray-400"} />
            )}
          </div>
        </div>

        {/* Modality tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {model.architecture?.input_modalities?.map((m) => {
            const colors =
              modalityColors[m] ??
              (isDark
                ? { dark: "bg-gray-500/20 text-gray-300", light: "bg-gray-100 text-gray-600" }
                : { dark: "", light: "" })
            return (
              <span
                key={m}
                className={`modality-tag flex items-center gap-0.5 ${isDark ? colors.dark : colors.light}`}
              >
                {modalityIcons[m]} {m}
              </span>
            )
          })}
          <span className={`text-[10px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>→</span>
          {model.architecture?.output_modalities?.map((m) => {
            const colors =
              modalityColors[m] ??
              (isDark
                ? { dark: "bg-gray-500/20 text-gray-300", light: "bg-gray-100 text-gray-600" }
                : { dark: "", light: "" })
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
            <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {t.context}
            </div>
            <div className={`text-xs font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
              {model.context_length}
              {model.top_provider?.context_length &&
                model.top_provider.context_length !== model.context_length && (
                  <span className={isDark ? "text-gray-500 ml-1" : "text-gray-400 ml-1"}>
                    ({model.top_provider.context_length})
                  </span>
                )}
            </div>
          </div>
          {model.top_provider?.max_completion_tokens ? (
            <div>
              <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                {t.maxOutput}
              </div>
              <div className={`text-xs font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                {model.top_provider.max_completion_tokens}
              </div>
            </div>
          ) : null}
          <div>
            <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {t.promptPrice} <span className="opacity-60">{currencyUnit(lang, currency)}</span>
            </div>
            <div
              className={`text-xs font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
            >
              {formatPrice(model.pricing.prompt, lang, currency, exchangeRate)}
            </div>
          </div>
          <div>
            <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {t.completePrice} <span className="opacity-60">{currencyUnit(lang, currency)}</span>
            </div>
            <div className={`text-xs font-medium ${isDark ? "text-sky-400" : "text-sky-600"}`}>
              {formatPrice(model.pricing.completion, lang, currency, exchangeRate)}
            </div>
          </div>
        </div>

        {/* Benchmark bar */}
        {benchmarks?.intelligence_index != null && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className={isDark ? "text-gray-500" : "text-gray-400"}>{t.intelligence}</span>
              <span className={`font-medium ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                {benchmarks.intelligence_index}
              </span>
            </div>
            <div
              className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-gray-800" : "bg-gray-200"}`}
            >
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
        <div
          className={`border-t p-4 space-y-4 animate-fade-in ${isDark ? "border-white/5" : "border-gray-200"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div
              className={`flex rounded-lg border overflow-hidden ${isDark ? "border-white/10" : "border-gray-200"}`}
            >
              <button
                type="button"
                onClick={() => onToggleRawDetails()}
                className={`px-2 py-1 text-[10px] ${!rawDetails ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                {t.optimized}
              </button>
              <button
                type="button"
                onClick={() => onToggleRawDetails()}
                className={`px-2 py-1 text-[10px] ${rawDetails ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                {t.apiJson}
              </button>
            </div>
            {rawDetails && (
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(JSON.stringify(model, null, 2))}
                className={`p-1.5 rounded ${isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
                title="Copy JSON"
              >
                <Copy size={13} />
              </button>
            )}
          </div>
          {rawDetails ? (
            <pre
              className={`max-h-[520px] overflow-auto rounded-lg p-3 text-[10px] leading-relaxed whitespace-pre-wrap break-all ${isDark ? "bg-gray-950 text-gray-300" : "bg-gray-50 text-gray-700"}`}
            >
              {JSON.stringify(model, null, 2)}
            </pre>
          ) : (
            <>
              {/* Description */}
              {model.description && (
                <p
                  className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}
                >
                  {model.description}
                </p>
              )}

              {/* Pricing Grid */}
              <div>
                <h4
                  className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? "text-gray-300" : "text-gray-600"}`}
                >
                  <DollarSign size={12} /> {t.pricingDetails}
                  <span
                    className={`text-[10px] font-normal ${isDark ? "text-gray-500" : "text-gray-400"}`}
                  >
                    ({currencyUnit(lang, currency)})
                  </span>
                </h4>
                {(() => {
                  const pricingItems: Array<{
                    key: string
                    label: string
                    colorDark: string
                    colorLight: string
                    per1k?: boolean
                  }> = [
                    {
                      key: "prompt",
                      label: t.prompt,
                      colorDark: "text-emerald-400",
                      colorLight: "text-emerald-600"
                    },
                    {
                      key: "completion",
                      label: t.completion,
                      colorDark: "text-sky-400",
                      colorLight: "text-sky-600"
                    },
                    {
                      key: "input_cache_read",
                      label: t.cacheRead,
                      colorDark: "text-violet-400",
                      colorLight: "text-violet-600"
                    },
                    {
                      key: "input_cache_write",
                      label: t.cacheWrite,
                      colorDark: "text-violet-400",
                      colorLight: "text-violet-600"
                    },
                    {
                      key: "input_cache_write_1h",
                      label: t.cacheWrite1h,
                      colorDark: "text-purple-400",
                      colorLight: "text-purple-600"
                    },
                    {
                      key: "web_search",
                      label: t.webSearch,
                      colorDark: "text-amber-400",
                      colorLight: "text-amber-600",
                      per1k: true
                    },
                    {
                      key: "image",
                      label: t.image,
                      colorDark: "text-purple-400",
                      colorLight: "text-purple-600"
                    },
                    {
                      key: "audio",
                      label: t.audio,
                      colorDark: "text-orange-400",
                      colorLight: "text-orange-600"
                    },
                    {
                      key: "internal_reasoning",
                      label: t.reasoningPrice,
                      colorDark: "text-rose-400",
                      colorLight: "text-rose-600"
                    }
                  ]
                  const p = model.pricing as unknown as Record<string, string | undefined>
                  const orig = model.pricing.original as unknown as
                    | Record<string, string | undefined>
                    | undefined
                  const active = pricingItems.filter((item) => p[item.key])
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {active.map((item) => (
                        <div
                          key={item.key}
                          className={`rounded-lg p-2 ${isDark ? "bg-gray-900/50" : "bg-gray-100"}`}
                        >
                          <div
                            className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
                          >
                            {item.label}
                          </div>
                          <div
                            className={`text-xs font-medium ${isDark ? item.colorDark : item.colorLight}`}
                          >
                            {item.per1k
                              ? currency === "CNY"
                                ? `¥${stripZeros(bn(p[item.key]).times(1000).times(exchangeRate).toFixed(4))}/1K`
                                : `$${stripZeros(bn(p[item.key]).times(1000).toFixed(4))}/1K`
                              : formatPrice(p[item.key], lang, currency, exchangeRate)}
                          </div>
                          {orig?.[item.key] && (
                            <div
                              className={`text-[10px] line-through ${isDark ? "text-gray-500" : "text-gray-400"}`}
                            >
                              {item.per1k
                                ? currency === "CNY"
                                  ? `¥${stripZeros(bn(orig[item.key]).times(1000).times(exchangeRate).toFixed(4))}/1K`
                                  : `$${stripZeros(bn(orig[item.key]).times(1000).toFixed(4))}/1K`
                                : formatPrice(orig[item.key], lang, currency, exchangeRate)}
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
                            <div
                              className={`text-[10px] mb-1.5 flex items-center gap-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                            >
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
                                  <div
                                    key={i}
                                    className={`rounded-lg p-2 text-[11px] ${isDark ? "bg-gray-900/50" : "bg-gray-100"}`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] ${isWeekend ? (isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700") : isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-700"}`}
                                      >
                                        {isWeekend ? t.weekend : t.weekday}
                                      </span>
                                      <span className={isDark ? "text-gray-400" : "text-gray-500"}>
                                        {days}
                                      </span>
                                      {timeRange && (
                                        <span
                                          className={isDark ? "text-gray-500" : "text-gray-400"}
                                        >
                                          {timeRange}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                      {o.prompt && (
                                        <span
                                          className={
                                            isDark ? "text-emerald-400" : "text-emerald-600"
                                          }
                                        >
                                          {t.prompt}:{" "}
                                          {formatPrice(o.prompt, lang, currency, exchangeRate)}
                                        </span>
                                      )}
                                      {o.completion && (
                                        <span className={isDark ? "text-sky-400" : "text-sky-600"}>
                                          {t.completion}:{" "}
                                          {formatPrice(o.completion, lang, currency, exchangeRate)}
                                        </span>
                                      )}
                                      {o.input_cache_read && (
                                        <span
                                          className={isDark ? "text-violet-400" : "text-violet-600"}
                                        >
                                          {t.cacheRead}:{" "}
                                          {formatPrice(
                                            o.input_cache_read,
                                            lang,
                                            currency,
                                            exchangeRate
                                          )}
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
                            <div
                              className={`text-[10px] mb-1.5 flex items-center gap-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                            >
                              <Layers size={10} /> {t.tieredPricing}
                            </div>
                            <div className="space-y-1.5">
                              {tokenOverrides.map((o, i) => (
                                <div
                                  key={i}
                                  className={`rounded-lg p-2 text-[11px] ${isDark ? "bg-gray-900/50" : "bg-gray-100"}`}
                                >
                                  <div className="mb-1">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-teal-500/20 text-teal-300" : "bg-teal-100 text-teal-700"}`}
                                    >
                                      ≥{formatCtx(o.min_prompt_tokens!)} {t.aboveTokens}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                    {o.prompt && (
                                      <span
                                        className={isDark ? "text-emerald-400" : "text-emerald-600"}
                                      >
                                        {t.prompt}:{" "}
                                        {formatPrice(o.prompt, lang, currency, exchangeRate)}
                                      </span>
                                    )}
                                    {o.completion && (
                                      <span className={isDark ? "text-sky-400" : "text-sky-600"}>
                                        {t.completion}:{" "}
                                        {formatPrice(o.completion, lang, currency, exchangeRate)}
                                      </span>
                                    )}
                                    {o.input_cache_read && (
                                      <span
                                        className={isDark ? "text-violet-400" : "text-violet-600"}
                                      >
                                        {t.cacheRead}:{" "}
                                        {formatPrice(
                                          o.input_cache_read,
                                          lang,
                                          currency,
                                          exchangeRate
                                        )}
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
                <h4
                  className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? "text-gray-300" : "text-gray-600"}`}
                >
                  <Zap size={12} /> {t.capabilities}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`rounded-lg p-2 ${isDark ? "bg-gray-900/50" : "bg-gray-100"}`}>
                    <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                      {t.contextLengthLabel}
                    </span>
                    <div className={`font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                      {model.context_length} tokens
                    </div>
                    {model.top_provider?.context_length &&
                      model.top_provider.context_length !== model.context_length && (
                        <div
                          className={`text-[10px] mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}
                        >
                          {t.contextTopProvider}: {model.top_provider.context_length} tokens
                        </div>
                      )}
                  </div>
                  {model.top_provider?.max_completion_tokens && (
                    <div className={`rounded-lg p-2 ${isDark ? "bg-gray-900/50" : "bg-gray-100"}`}>
                      <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                        {t.maxOutput}
                      </span>
                      <div className={`font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                        {model.top_provider.max_completion_tokens} tokens
                      </div>
                    </div>
                  )}
                  {model.architecture?.tokenizer && (
                    <div className={`rounded-lg p-2 ${isDark ? "bg-gray-900/50" : "bg-gray-100"}`}>
                      <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                        {t.tokenizer}
                      </span>
                      <div className={`font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                        {model.architecture.tokenizer}
                      </div>
                    </div>
                  )}
                  {model.top_provider?.is_moderated != null && (
                    <div className={`rounded-lg p-2 ${isDark ? "bg-gray-900/50" : "bg-gray-100"}`}>
                      <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                        {t.moderated}
                      </span>
                      <div className={`font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                        {model.top_provider.is_moderated ? t.yes : t.no}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reasoning */}
              {model.reasoning && (
                <div>
                  <h4
                    className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? "text-gray-300" : "text-gray-600"}`}
                  >
                    <Brain size={12} /> {t.reasoningLabel}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(model.reasoning.supported_efforts ?? []).map((e) => (
                      <span
                        key={e}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          e === model.reasoning!.default_effort
                            ? isDark
                              ? "bg-violet-500/30 text-violet-200 ring-1 ring-violet-500/40"
                              : "bg-violet-100 text-violet-700 ring-1 ring-violet-300"
                            : isDark
                              ? "bg-gray-800 text-gray-400"
                              : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {e} {e === model.reasoning!.default_effort && "★"}
                      </span>
                    ))}
                  </div>
                  <div className={`text-[10px] mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    {model.reasoning.mandatory ? t.mandatory : t.optional}
                    {model.reasoning.default_enabled && ` · ${t.enabledByDefault}`}
                  </div>
                </div>
              )}

              {/* Benchmarks */}
              {benchmarks && (
                <div>
                  <h4
                    className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? "text-gray-300" : "text-gray-600"}`}
                  >
                    <BarChart3 size={12} /> {t.benchmarks}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: t.intelligence, val: benchmarks.intelligence_index, max: 70 },
                      { label: t.codingIndex, val: benchmarks.coding_index, max: 90 },
                      { label: t.agentic, val: benchmarks.agentic_index, max: 70 }
                    ]
                      .filter((b) => b.val != null)
                      .map((b) => (
                        <div
                          key={b.label}
                          className={`rounded-lg p-2 ${isDark ? "bg-gray-900/50" : "bg-gray-100"}`}
                        >
                          <div
                            className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
                          >
                            {b.label}
                          </div>
                          <div
                            className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                          >
                            {b.val}
                          </div>
                          <div
                            className={`h-1 rounded-full mt-1 overflow-hidden ${isDark ? "bg-gray-800" : "bg-gray-200"}`}
                          >
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
                  <h4
                    className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? "text-gray-300" : "text-gray-600"}`}
                  >
                    <Sparkles size={12} /> {t.designArena}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {arenas.map((a) => (
                      <div
                        key={`${a.arena}-${a.category}`}
                        className={`rounded-lg p-2 ${isDark ? "bg-gray-900/50" : "bg-gray-100"}`}
                      >
                        <div
                          className={`text-[10px] capitalize ${isDark ? "text-gray-500" : "text-gray-400"}`}
                        >
                          {a.category.replace(/-/g, " ")}
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                          >
                            #{a.rank}
                          </span>
                          <span
                            className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
                          >
                            ELO {a.elo}
                          </span>
                        </div>
                        <div
                          className={`text-[10px] ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
                        >
                          {a.win_rate}% {t.winRate}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parameters */}
              <div>
                <h4
                  className={`text-xs font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-600"}`}
                >
                  {t.supportedParams}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {(model.supported_parameters ?? []).map((p) => (
                    <span
                      key={p}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-200 text-gray-600"}`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div
                className={`flex items-center gap-4 text-[10px] pt-2 border-t ${isDark ? "text-gray-500 border-white/5" : "text-gray-400 border-gray-200"}`}
              >
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {formatDate(model.created, lang)}
                </span>
                <span>
                  {daysSince(model.created)} {t.daysAgo}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
