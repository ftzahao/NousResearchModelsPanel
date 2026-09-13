import { ChevronDown, ChevronUp, Brain, Shield } from "lucide-react"
import type { Model } from "../types"
import { useLang } from "../i18n"
import { useTheme, useCurrency } from "../contexts"
import { SelectCheckbox } from "./SelectCheckbox"
import { CardBadge } from "./CardBadge"
import { ModalityFlow } from "./ModalityFlow"
import { ModelExpandedDetails } from "./ModelExpandedDetails"
import {
  bn,
  formatPrice,
  formatCtx,
  daysSince,
  currencyUnit,
  getProviderColor,
  getDiscount,
  formatDiscount
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
  const color = getProviderColor(model.id)
  const benchmarks = model.benchmarks?.artificial_analysis
  const isNew = daysSince(model.created) < 7
  const isBatch = model.id.includes(":batch")
  const isFree = bn(model.pricing?.prompt).isZero()
  const isRouter = model.id.startsWith("~")
  const discount = getDiscount(model)
  const isDark = theme === "dark"

  return (
    <div
      id={`model-card-${model.id}`}
      className={`glass rounded-2xl overflow-hidden transition-all duration-300 card-glow animate-fade-in relative
        ${expanded ? "col-span-full" : ""}
        ${selected ? `ring-1 ${isDark ? "ring-[#edff45]/70" : "ring-brand-600"}` : ""}`}
    >
      {/* Provider color edge */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-[3px] flex-shrink-0"
        style={{ background: color }}
      />
      {/* Header */}
      <div
        className={`p-4 cursor-pointer transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-gray-50"}`}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SelectCheckbox
                checked={selected}
                onToggle={onSelect}
                ariaLabel={selected ? `Deselect ${model.name}` : `Select ${model.name}`}
                theme={theme}
              />
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
                <CardBadge
                  label={t.newLabel}
                  darkClass="bg-emerald-500/20 text-emerald-300"
                  lightClass="bg-emerald-100 text-emerald-700"
                />
              )}
              {isBatch && (
                <CardBadge
                  label={t.batchLabel}
                  darkClass="bg-[#edff45]/15 text-[#edff45]"
                  lightClass="bg-brand-100 text-brand-700"
                />
              )}
              {isFree && (
                <CardBadge
                  label={t.freeLabel}
                  darkClass="bg-green-500/20 text-green-300"
                  lightClass="bg-green-100 text-green-700"
                />
              )}
              {discount && (
                <CardBadge
                  label={formatDiscount(discount.ratio, lang)}
                  title={`${t.originalPrice}: ${formatPrice(discount.originalPrompt, lang, currency, exchangeRate)}`}
                  darkClass="bg-amber-500/20 text-amber-300"
                  lightClass="bg-amber-100 text-amber-700"
                />
              )}
              {isRouter && (
                <CardBadge
                  label={t.routerLabel}
                  darkClass="bg-cyan-500/20 text-cyan-300"
                  lightClass="bg-cyan-100 text-cyan-700"
                />
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
                <Brain size={14} className={isDark ? "text-brand-400" : "text-brand-600"} />
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
        <ModalityFlow model={model} />

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {t.context}
            </div>
            <div
              className={`text-xs font-medium font-mono ${isDark ? "text-gray-200" : "text-gray-700"}`}
            >
              {formatCtx(model.context_length)}
              {model.top_provider?.context_length &&
                model.top_provider.context_length !== model.context_length && (
                  <span className={isDark ? "text-gray-500 ml-1" : "text-gray-400 ml-1"}>
                    ({formatCtx(model.top_provider.context_length)})
                  </span>
                )}
            </div>
          </div>
          {model.top_provider?.max_completion_tokens ? (
            <div>
              <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                {t.maxOutput}
              </div>
              <div
                className={`text-xs font-medium font-mono ${isDark ? "text-gray-200" : "text-gray-700"}`}
              >
                {formatCtx(model.top_provider.max_completion_tokens)}
              </div>
            </div>
          ) : null}
          <div>
            <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {t.promptPrice} <span className="opacity-60">{currencyUnit(lang, currency)}</span>
            </div>
            {isFree ? (
              <div
                className={`text-xs font-mono font-semibold ${isDark ? "text-green-400" : "text-green-700"}`}
              >
                {t.freeLabel}
              </div>
            ) : (
              <div
                className={`text-xs font-medium font-mono ${isDark ? "text-brand-300" : "text-brand-700"}`}
              >
                {formatPrice(model.pricing.prompt, lang, currency, exchangeRate)}
              </div>
            )}
          </div>
          <div>
            <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {t.completePrice} <span className="opacity-60">{currencyUnit(lang, currency)}</span>
            </div>
            {isFree ? (
              <div
                className={`text-xs font-mono font-semibold ${isDark ? "text-green-400" : "text-green-700"}`}
              >
                {t.freeLabel}
              </div>
            ) : (
              <div
                className={`text-xs font-medium font-mono ${isDark ? "text-brand-400" : "text-brand-600"}`}
              >
                {formatPrice(model.pricing.completion, lang, currency, exchangeRate)}
              </div>
            )}
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
        <ModelExpandedDetails
          model={model}
          rawDetails={rawDetails}
          onToggleRawDetails={onToggleRawDetails}
        />
      )}
    </div>
  )
}
