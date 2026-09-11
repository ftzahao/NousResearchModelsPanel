import React from "react"
import { useTheme } from "../contexts"

export function StatCard({
  icon,
  label,
  value,
  sub
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
}) {
  const { theme } = useTheme()
  return (
    <div className="glass p-4 flex items-center gap-3 animate-fade-in">
      <div
        className={`w-10 h-10 flex items-center justify-center flex-shrink-0 border ${theme === "dark" ? "bg-brand-500/15 border-brand-500/40 text-brand-300" : "bg-brand-50 border-brand-200 text-brand-600"}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className={`text-2xl font-display font-semibold leading-none ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          {value}
        </div>
        <div
          className={`text-[10px] font-mono uppercase tracking-wider mt-1.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
        >
          {label}
        </div>
        {sub && (
          <div
            className={`text-[10px] font-mono ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}
