import { useEffect, useRef, useState } from "react"
import { Check, Copy, Download } from "lucide-react"
import { useTheme } from "../contexts"
import { useLang } from "../i18n"
import type { ExportPreviewFile } from "../types"
import { ModalShell } from "./ModalShell"

export function ExportPreviewModal({
  files,
  usage,
  warning,
  selectedCount,
  onClose
}: {
  files: ExportPreviewFile[]
  usage?: string[]
  warning?: string
  selectedCount: number
  onClose: () => void
}) {
  const { theme } = useTheme()
  const { t } = useLang()
  const [copiedFile, setCopiedFile] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    },
    []
  )

  const handleCopy = async (file: ExportPreviewFile) => {
    try {
      await navigator.clipboard.writeText(file.content)
      setCopiedFile(file.fileName)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopiedFile(null), 2000)
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
    <ModalShell
      title={t.exportPreview}
      subtitle={`${selectedCount} ${t.selected}`}
      maxWidth="max-w-3xl"
      bodyClassName={`flex-1 overflow-auto p-4 min-h-0 ${theme === "dark" ? "bg-gray-950" : "bg-gray-50"}`}
      onClose={onClose}
    >
      {warning ? (
        <div
          className={`mb-3 rounded-xl border p-3 text-[11px] leading-relaxed ${theme === "dark" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-300 bg-amber-50 text-amber-800"}`}
        >
          ⚠️ {warning}
        </div>
      ) : null}
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
    </ModalShell>
  )
}
