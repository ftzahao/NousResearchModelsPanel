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
    <div className="glass rounded-xl p-4 flex items-center gap-3 animate-fade-in">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === "dark" ? "bg-brand-500/10 text-brand-400" : "bg-brand-50 text-brand-600"}`}
      >
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
          {value}
        </div>
        <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
          {label}
        </div>
        {sub && (
          <div className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}
