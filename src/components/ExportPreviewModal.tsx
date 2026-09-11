import { useState } from "react"
import { X, Check, Copy, Download } from "lucide-react"
import { useTheme } from "../contexts"
import { useLang } from "../i18n"

export function ExportPreviewModal({
  payload,
  fileName,
  selectedCount,
  onClose
}: {
  payload: string
  fileName: string
  selectedCount: number
  onClose: () => void
}) {
  const { theme } = useTheme()
  const { t } = useLang()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable (e.g. permissions denied)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([payload], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm overlay-in" />
      <div
        className={`panel-in relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${theme === "dark" ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}
        >
          <div className="min-w-0">
            <h3
              className={`text-sm font-bold truncate ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {t.exportPreview} · {fileName}
            </h3>
            <p className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
              {selectedCount} {t.selected}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t.close}
            className={`p-1.5 rounded-lg transition-colors ${theme === "dark" ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
          >
            <X size={16} />
          </button>
        </div>
        <div
          className={`flex-1 overflow-auto p-4 min-h-0 ${theme === "dark" ? "bg-gray-950" : "bg-gray-50"}`}
        >
          <pre
            className={`text-[11px] leading-relaxed font-mono whitespace-pre ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
          >
            {payload}
          </pre>
        </div>
        <div
          className={`flex items-center justify-end gap-2 px-4 py-3 border-t ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}
        >
          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === "dark" ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t.copied : t.copy}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 transition-colors"
          >
            <Download size={12} /> {t.download} {fileName}
          </button>
        </div>
      </div>
    </div>
  )
}
