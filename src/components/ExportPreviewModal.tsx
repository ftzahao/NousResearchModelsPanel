import { useState } from "react"
import { X, Check, Copy, Download } from "lucide-react"
import { useTheme } from "../contexts"
import { useLang } from "../i18n"
import type { ExportPreviewFile } from "../types"

export function ExportPreviewModal({
  files,
  usage,
  selectedCount,
  onClose
}: {
  files: ExportPreviewFile[]
  usage?: string[]
  selectedCount: number
  onClose: () => void
}) {
  const { theme } = useTheme()
  const { t } = useLang()
  const [copiedFile, setCopiedFile] = useState<string | null>(null)

  const handleCopy = async (file: ExportPreviewFile) => {
    try {
      await navigator.clipboard.writeText(file.content)
      setCopiedFile(file.fileName)
      setTimeout(() => setCopiedFile(null), 2000)
    } catch {
      // clipboard unavailable (e.g. permissions denied)
    }
  }

  const handleDownload = (file: ExportPreviewFile) => {
    const blob = new Blob([file.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = file.fileName
    anchor.click()
    URL.revokeObjectURL(url)
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
              {t.exportPreview}
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
          {usage?.length ? (
            <div
              className={`mb-3 rounded-xl border p-3 ${theme === "dark" ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"}`}
            >
              <p
                className={`mb-1.5 text-[11px] font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
              >
                {t.usageTitle}
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                {usage.map((step) => (
                  <li
                    key={step}
                    className={`text-[11px] leading-relaxed ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  >
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {files.map((file) => (
            <div key={file.fileName} className="mb-3 last:mb-0">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span
                  className={`font-mono text-[11px] font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                >
                  {file.fileName}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(file)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${theme === "dark" ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {copiedFile === file.fileName ? <Check size={11} /> : <Copy size={11} />}
                    {copiedFile === file.fileName ? t.copied : t.copy}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 transition-colors"
                  >
                    <Download size={11} /> {t.download}
                  </button>
                </div>
              </div>
              <pre
                className={`rounded-xl border p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap ${theme === "dark" ? "text-gray-300 border-white/10 bg-black/30" : "text-gray-700 border-gray-200 bg-white"}`}
              >
                {file.content}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
