import { Brain, Shield, Sparkles, Eye, BadgePercent } from "lucide-react"
import type { Model } from "../types"
import { useLang } from "../i18n"
import { useTheme, useCurrency } from "../contexts"
import {
  bn,
  formatCtx,
  formatPriceShort,
  getProviderColor,
  daysSince,
  getDiscount,
  formatDiscount
} from "../utils"
import { SelectCheckbox } from "./SelectCheckbox"
import { IntelligenceBar } from "./IntelligenceBar"

export function CompactModelTable({
  models,
  selectedIds,
  onSelect,
  onShowDetails
}: {
  models: Model[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onShowDetails: (id: string) => void
}) {
  const { lang, t } = useLang()
  const { theme } = useTheme()
  const { currency, exchangeRate } = useCurrency()
  const isDark = theme === "dark"

  const th = `px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${isDark ? "text-gray-500" : "text-gray-400"}`
  const td = `px-2.5 py-1.5 whitespace-nowrap ${isDark ? "text-gray-300" : "text-gray-600"}`

  return (
    <div className="glass rounded-2xl overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={`border-b ${isDark ? "border-white/5" : "border-gray-200"}`}>
              <th className={`${th} w-8`}></th>
              <th className={th}>{t.models}</th>
              <th className={th}>{t.context}</th>
              <th className={`${th} text-right`}>
                {t.promptPrice} <span className="opacity-60">{t.perM}</span>
              </th>
              <th className={`${th} text-right`}>
                {t.completePrice} <span className="opacity-60">{t.perM}</span>
              </th>
              <th className={`${th} text-right`}>{t.intelligence}</th>
              <th className={`${th} w-20 text-right`}></th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => {
              const selected = selectedIds.has(model.id)
              const color = getProviderColor(model.id)
              const intelligence = model.benchmarks?.artificial_analysis?.intelligence_index
              const discount = getDiscount(model)
              return (
                <tr
                  key={model.id}
                  onClick={() => onSelect(model.id)}
                  className={`cursor-pointer transition-colors border-b ${
                    isDark
                      ? "border-white/5 hover:bg-white/[0.03]"
                      : "border-gray-100 hover:bg-gray-50"
                  } ${selected ? (isDark ? "bg-[#edff45]/[0.08] hover:bg-[#edff45]/[0.1]" : "bg-brand-50") : ""}`}
                >
                  <td className={td}>
                    <SelectCheckbox
                      checked={selected}
                      onToggle={() => onSelect(model.id)}
                      ariaLabel={selected ? `Deselect ${model.name}` : `Select ${model.name}`}
                      theme={theme}
                    />
                  </td>
                  <td className="px-2.5 py-1.5 max-w-[280px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span
                        className={`truncate font-medium ${isDark ? "text-gray-100" : "text-gray-800"}`}
                        title={model.name}
                      >
                        {model.name}
                      </span>
                      <span
                        className={`hidden lg:inline font-mono text-[10px] truncate ${isDark ? "text-gray-600" : "text-gray-400"}`}
                        title={model.id}
                      >
                        {model.id}
                      </span>
                    </div>
                  </td>
                  <td className={`${td} font-mono`}>{formatCtx(model.context_length)}</td>
                  <td
                    className={`${td} text-right font-mono ${isDark ? "text-brand-300" : "text-brand-700"}`}
                  >
                    {bn(model.pricing.prompt).isZero() ? (
                      <span
                        className={`font-semibold ${isDark ? "text-green-400" : "text-green-700"}`}
                      >
                        {t.freeLabel}
                      </span>
                    ) : (
                      formatPriceShort(model.pricing.prompt, currency, exchangeRate)
                    )}
                  </td>
                  <td
                    className={`${td} text-right font-mono ${isDark ? "text-brand-400" : "text-brand-600"}`}
                  >
                    {bn(model.pricing.completion).isZero() ? (
                      <span
                        className={`font-semibold ${isDark ? "text-green-400" : "text-green-700"}`}
                      >
                        {t.freeLabel}
                      </span>
                    ) : (
                      formatPriceShort(model.pricing.completion, currency, exchangeRate)
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    {intelligence != null ? (
                      <IntelligenceBar
                        score={intelligence}
                        color={color}
                        theme={theme}
                        width="w-12"
                      />
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      {daysSince(model.created) < 7 && (
                        <span title={t.newLabel}>
                          <Sparkles
                            size={12}
                            className={isDark ? "text-emerald-400" : "text-emerald-600"}
                          />
                        </span>
                      )}
                      {discount && (
                        <span
                          title={`${formatDiscount(discount.ratio, lang)} · ${t.originalPrice}: ${formatPriceShort(discount.originalPrompt, currency, exchangeRate)}`}
                        >
                          <BadgePercent
                            size={12}
                            className={isDark ? "text-amber-400" : "text-amber-600"}
                          />
                        </span>
                      )}
                      {model.reasoning?.mandatory && (
                        <span title={t.reasoningLabel}>
                          <Brain
                            size={12}
                            className={isDark ? "text-brand-400" : "text-brand-600"}
                          />
                        </span>
                      )}
                      {model.top_provider?.is_moderated && (
                        <span title={t.moderated}>
                          <Shield
                            size={12}
                            className={isDark ? "text-blue-400" : "text-blue-600"}
                          />
                        </span>
                      )}
                      <button
                        type="button"
                        title={t.viewDetails}
                        aria-label={t.viewDetails}
                        onClick={(event) => {
                          event.stopPropagation()
                          onShowDetails(model.id)
                        }}
                        className={`p-1 rounded transition-colors ${isDark ? "text-gray-500 hover:text-gray-200 hover:bg-white/10" : "text-gray-400 hover:text-gray-800 hover:bg-gray-100"}`}
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
