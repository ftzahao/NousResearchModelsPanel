import { Brain, Shield, Sparkles, Eye } from "lucide-react"
import type { Model } from "../types"
import { useLang } from "../i18n"
import { useTheme, useCurrency } from "../contexts"
import { bn, formatCtx, formatPriceShort, getProviderColor, daysSince } from "../utils"
import { SelectCheckbox } from "./SelectCheckbox"
import { IntelligenceBar } from "./IntelligenceBar"
export function CompactModelCard({
  model,
  selected,
  onSelect,
  onShowDetails
}: {
  model: Model
  selected: boolean
  onSelect: () => void
  onShowDetails: () => void
}) {
  const { t } = useLang()
  const { theme } = useTheme()
  const { currency, exchangeRate } = useCurrency()
  const isDark = theme === "dark"
  const color = getProviderColor(model.id)
  const intelligence = model.benchmarks?.artificial_analysis?.intelligence_index

  return (
    <div
      onClick={onSelect}
      className={`glass rounded-xl p-2.5 cursor-pointer transition-all duration-200 ${
        selected
          ? isDark
            ? "ring-1 ring-[#edff45]/80 shadow-[0_0_0_2px_rgba(237,255,69,0.2)]"
            : "ring-1 ring-brand-600 shadow-[0_0_0_2px_rgba(0,0,242,0.2)]"
          : isDark
            ? "hover:bg-white/[0.03]"
            : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-1.5">
        <SelectCheckbox
          checked={selected}
          onToggle={onSelect}
          ariaLabel={selected ? `Deselect ${model.name}` : `Select ${model.name}`}
          theme={theme}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            <span
              className={`text-xs font-medium truncate ${isDark ? "text-gray-100" : "text-gray-800"}`}
              title={model.name}
            >
              {model.name}
            </span>
            {daysSince(model.created) < 7 && (
              <Sparkles
                size={11}
                className={`flex-shrink-0 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
              />
            )}
            {model.reasoning?.mandatory && (
              <Brain
                size={11}
                className={`flex-shrink-0 ${isDark ? "text-brand-400" : "text-brand-600"}`}
              />
            )}
            {model.top_provider?.is_moderated && (
              <Shield
                size={11}
                className={`flex-shrink-0 ${isDark ? "text-blue-400" : "text-blue-600"}`}
              />
            )}
            <button
              type="button"
              title={t.viewDetails}
              aria-label={t.viewDetails}
              onClick={(event) => {
                event.stopPropagation()
                onShowDetails()
              }}
              className={`p-0.5 rounded flex-shrink-0 transition-colors ${isDark ? "text-gray-500 hover:text-gray-200 hover:bg-white/10" : "text-gray-400 hover:text-gray-800 hover:bg-gray-100"}`}
            >
              <Eye size={12} />
            </button>
          </div>
          <div
            className={`text-[10px] font-mono truncate ${isDark ? "text-gray-600" : "text-gray-400"}`}
            title={model.id}
          >
            {model.id}
          </div>
        </div>
      </div>
      <div
        className={`mt-2 flex items-center justify-between gap-1 text-[10px] font-mono ${isDark ? "text-gray-400" : "text-gray-500"}`}
      >
        <span title={t.context}>{formatCtx(model.context_length)}</span>
        <span
          className={isDark ? "text-brand-300" : "text-brand-700"}
          title={`${t.promptPrice} (${t.perM})`}
        >
          {bn(model.pricing.prompt).isZero() ? (
            <span className={`font-semibold ${isDark ? "text-green-400" : "text-green-700"}`}>
              {t.freeLabel}
            </span>
          ) : (
            formatPriceShort(model.pricing.prompt, currency, exchangeRate)
          )}
        </span>
        <span
          className={isDark ? "text-brand-400" : "text-brand-600"}
          title={`${t.completePrice} (${t.perM})`}
        >
          {bn(model.pricing.completion).isZero() ? (
            <span className={`font-semibold ${isDark ? "text-green-400" : "text-green-700"}`}>
              {t.freeLabel}
            </span>
          ) : (
            formatPriceShort(model.pricing.completion, currency, exchangeRate)
          )}
        </span>
        {intelligence != null ? (
          <IntelligenceBar score={intelligence} color={color} theme={theme} width="w-8" />
        ) : (
          <span className="opacity-50">—</span>
        )}
      </div>
    </div>
  )
}
