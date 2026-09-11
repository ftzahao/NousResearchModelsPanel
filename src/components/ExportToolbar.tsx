import { useState } from "react"
import { Download, Eye, ListChecks } from "lucide-react"
import { useTheme } from "../contexts"
import { useLang } from "../i18n"
import type { ModelConfigExporter } from "../types"

export function ExportToolbar({
  selectedCount,
  exporters,
  exporterId,
  setExporterId,
  onSelectVisible,
  onAppendVisible,
  onClearSelection,
  onPreview,
  onViewSelected
}: {
  selectedCount: number
  exporters: ModelConfigExporter[]
  exporterId: string
  setExporterId: (id: string) => void
  onSelectVisible: () => void
  onAppendVisible: () => void
  onClearSelection: () => void
  onPreview: () => void
  onViewSelected: () => void
}) {
  const { theme } = useTheme()
  const { t } = useLang()
  const [showExportMenu, setShowExportMenu] = useState(false)

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2 ${theme === "dark" ? "border-white/10 bg-gray-900/40" : "border-gray-200 bg-white"}`}
    >
      <button
        type="button"
        disabled={!selectedCount}
        onClick={onViewSelected}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40 ${theme === "dark" ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
      >
        <ListChecks size={12} />
        {selectedCount} {t.selected}
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSelectVisible}
          className={`px-2 py-1.5 rounded-lg text-[10px] ${theme === "dark" ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {t.selectVisible}
        </button>
        <button
          type="button"
          onClick={onAppendVisible}
          className={`px-2 py-1.5 rounded-lg text-[10px] ${theme === "dark" ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {t.appendVisible}
        </button>
        <button
          type="button"
          onClick={onClearSelection}
          className={`px-2 py-1.5 rounded-lg text-[10px] ${theme === "dark" ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
        >
          {t.clearSelection}
        </button>
        <div className="relative">
          <button
            type="button"
            disabled={!selectedCount}
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] bg-brand-500/20 text-brand-300 disabled:opacity-40"
          >
            <Download size={12} /> {t.export}
          </button>
          {showExportMenu && (
            <div
              className={`absolute right-0 top-full mt-1 z-20 w-64 rounded-xl border p-2 shadow-xl ${theme === "dark" ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
            >
              <div
                className={`text-[10px] mb-2 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
              >
                {t.configurationFormat}
              </div>
              <select
                value={exporterId}
                onChange={(event) => setExporterId(event.target.value)}
                className={`w-full rounded-lg border px-2 py-1.5 text-xs mb-2 ${theme === "dark" ? "bg-gray-800 border-white/10 text-gray-200" : "bg-gray-50 border-gray-200 text-gray-700"}`}
              >
                {exporters.map((exporter) => (
                  <option key={exporter.id} value={exporter.id}>
                    {exporter.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  onPreview()
                  setShowExportMenu(false)
                }}
                className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${theme === "dark" ? "bg-brand-500/20 border-brand-500/30 text-brand-300 hover:bg-brand-500/30" : "bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100"}`}
              >
                <Eye size={12} /> {t.preview}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
