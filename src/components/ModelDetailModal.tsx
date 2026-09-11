import { useEffect } from "react"
import { X } from "lucide-react"
import type { Model } from "../types"
import { useLang } from "../i18n"
import { useTheme } from "../contexts"
import { ModelCard } from "./ModelCard"

export function ModelDetailModal({
  model,
  selected,
  onSelect,
  rawDetails,
  onToggleRawDetails,
  onClose
}: {
  model: Model
  selected: boolean
  onSelect: () => void
  rawDetails: boolean
  onToggleRawDetails: () => void
  onClose: () => void
}) {
  const { t } = useLang()
  const { theme } = useTheme()
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm overlay-in" />
      <div
        className={`panel-in relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${isDark ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}
        >
          <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {t.modelDetails}
          </h3>
          <button
            type="button"
            onClick={onClose}
            title={t.close}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto min-h-0 p-3 sm:p-4">
          <ModelCard
            model={model}
            expanded
            onToggle={onClose}
            selected={selected}
            onSelect={onSelect}
            rawDetails={rawDetails}
            onToggleRawDetails={onToggleRawDetails}
          />
        </div>
      </div>
    </div>
  )
}
