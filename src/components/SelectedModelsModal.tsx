import { useEffect } from "react"
import { X, Crosshair, Trash2, ListChecks } from "lucide-react"
import type { Model } from "../types"
import { useTheme, useCurrency } from "../contexts"
import { useLang } from "../i18n"
import { formatPrice, formatCtx, getProvider, getProviderColor, currencyUnit } from "../utils"

export function SelectedModelsModal({
  models,
  onRemove,
  onClear,
  onLocate,
  onClose
}: {
  models: Model[]
  onRemove: (id: string) => void
  onClear: () => void
  onLocate: (id: string) => void
  onClose: () => void
}) {
  const { theme } = useTheme()
  const { lang, t } = useLang()
  const { currency, exchangeRate } = useCurrency()
  const isDark = theme === "dark"

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${isDark ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}
        >
          <div className="min-w-0">
            <h3 className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
              {t.selectedModels}
            </h3>
            <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {models.length} {t.selected}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t.close}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
          >
            <X size={16} />
          </button>
        </div>

        {models.length === 0 ? (
          <div
            className={`flex-1 flex flex-col items-center justify-center gap-2 py-16 ${isDark ? "text-gray-500" : "text-gray-400"}`}
          >
            <ListChecks size={28} className="opacity-30" />
            <p className="text-xs">{t.noSelection}</p>
          </div>
        ) : (
          <ul
            className={`flex-1 overflow-auto min-h-0 divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}
          >
            {models.map((model) => (
              <li
                key={model.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${isDark ? "hover:bg-white/[0.03]" : "hover:bg-gray-50"}`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: getProviderColor(model.id) }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    {model.name}
                  </div>
                  <div
                    className={`text-[10px] font-mono truncate ${isDark ? "text-gray-500" : "text-gray-400"}`}
                  >
                    {getProvider(model.id)} · {model.id}
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-[10px] flex-shrink-0">
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                    {t.context} {formatCtx(model.context_length)}
                  </span>
                  <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>
                    {formatPrice(model.pricing?.prompt, lang, currency, exchangeRate)}
                  </span>
                  <span className={isDark ? "text-sky-400" : "text-sky-600"}>
                    {formatPrice(model.pricing?.completion, lang, currency, exchangeRate)}
                  </span>
                  <span className={isDark ? "text-gray-600" : "text-gray-400"}>
                    {currencyUnit(lang, currency)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onLocate(model.id)}
                  title={t.locate}
                  className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${isDark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
                >
                  <Crosshair size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(model.id)}
                  title={t.remove}
                  className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${isDark ? "text-gray-400 hover:text-red-400 hover:bg-white/10" : "text-gray-500 hover:text-red-600 hover:bg-gray-100"}`}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div
          className={`flex items-center justify-between gap-2 px-4 py-3 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}
        >
          <button
            type="button"
            disabled={models.length === 0}
            onClick={onClear}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${isDark ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <Trash2 size={12} /> {t.clearSelection}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
