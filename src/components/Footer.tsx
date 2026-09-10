import { useTheme } from "../contexts"
import { useLang } from "../i18n"

export function Footer() {
  const { theme } = useTheme()
  const { t } = useLang()
  return (
    <footer className={`border-t mt-8 ${theme === "dark" ? "border-white/5" : "border-gray-200"}`}>
      <div
        className={`max-w-[1600px] mx-auto px-3 sm:px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`}
      >
        <span>{t.dataFrom}</span>
        <span>{t.builtWith}</span>
      </div>
    </footer>
  )
}
