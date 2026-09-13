import { Copy, Clock, Zap, Brain, BarChart3, Sparkles } from "lucide-react"
import type { Model } from "../types"
import { useLang } from "../i18n"
import { useTheme } from "../contexts"
import { ModelPricingDetails } from "./ModelPricingDetails"
import { DetailBox } from "./DetailBox"
import { formatDate, daysSince } from "../utils"

export function ModelExpandedDetails({
  model,
  rawDetails,
  onToggleRawDetails
}: {
  model: Model
  rawDetails: boolean
  onToggleRawDetails: () => void
}) {
  const { lang, t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const benchmarks = model.benchmarks?.artificial_analysis
  const arenas = model.benchmarks?.design_arena ?? []

  return (
    <div
      className={`border-t p-4 space-y-4 animate-slide-down ${isDark ? "border-white/5" : "border-gray-200"}`}
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
            <p className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              {model.description}
            </p>
          )}

          {/* Pricing */}
          <ModelPricingDetails model={model} />

          {/* Capabilities */}
          <div>
            <h4
              className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? "text-gray-300" : "text-gray-600"}`}
            >
              <Zap size={12} /> {t.capabilities}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <DetailBox>
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
              </DetailBox>
              {model.top_provider?.max_completion_tokens && (
                <DetailBox>
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>{t.maxOutput}</span>
                  <div className={`font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                    {model.top_provider.max_completion_tokens} tokens
                  </div>
                </DetailBox>
              )}
              {model.architecture?.tokenizer && (
                <DetailBox>
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>{t.tokenizer}</span>
                  <div className={`font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                    {model.architecture.tokenizer}
                  </div>
                </DetailBox>
              )}
              {model.top_provider?.is_moderated != null && (
                <DetailBox>
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>{t.moderated}</span>
                  <div className={`font-medium ${isDark ? "text-gray-200" : "text-gray-700"}`}>
                    {model.top_provider.is_moderated ? t.yes : t.no}
                  </div>
                </DetailBox>
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
                    <DetailBox key={b.label}>
                      <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
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
                    </DetailBox>
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
                  <DetailBox key={`${a.arena}-${a.category}`}>
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
                      <span className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        ELO {a.elo}
                      </span>
                    </div>
                    <div
                      className={`text-[10px] ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
                    >
                      {a.win_rate}% {t.winRate}
                    </div>
                  </DetailBox>
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
  )
}
