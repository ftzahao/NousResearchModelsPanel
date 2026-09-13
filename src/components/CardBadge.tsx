import type { ReactNode } from "react"
import { useTheme } from "../contexts"

export function CardBadge({
  label,
  title,
  darkClass,
  lightClass
}: {
  label: ReactNode
  title?: string
  darkClass: string
  lightClass: string
}) {
  const { theme } = useTheme()
  return (
    <span
      title={title}
      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
        theme === "dark" ? darkClass : lightClass
      }`}
    >
      {label}
    </span>
  )
}
