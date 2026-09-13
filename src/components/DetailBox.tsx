import type { ReactNode } from "react"
import { useTheme } from "../contexts"

export function DetailBox({
  children,
  className = ""
}: {
  children: ReactNode
  className?: string
}) {
  const { theme } = useTheme()
  return (
    <div
      className={`rounded-lg p-2 ${theme === "dark" ? "bg-gray-900/50" : "bg-gray-100"} ${className}`}
    >
      {children}
    </div>
  )
}
