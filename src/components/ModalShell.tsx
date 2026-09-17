import { useEffect } from "react"
import type { ReactNode } from "react"
import { X } from "lucide-react"
import { useTheme } from "../contexts"
import { useLang } from "../i18n"

export function ModalShell({
  title,
  subtitle,
  maxWidth = "max-w-3xl",
  bodyClassName,
  footer,
  onClose,
  children
}: {
  title: string
  subtitle?: string
  maxWidth?: string
  /** scroll container for the body; omit when the content scrolls itself */
  bodyClassName?: string
  footer?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const { theme } = useTheme()
  const { t } = useLang()
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
        className={`panel-in relative w-full ${maxWidth} max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${isDark ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}
        >
          <div className="min-w-0">
            <h3 className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
              {title}
            </h3>
            {subtitle && (
              <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                {subtitle}
              </p>
            )}
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
        {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
        {footer}
      </div>
    </div>
  )
}
