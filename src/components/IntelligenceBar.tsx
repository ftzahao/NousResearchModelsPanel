import type { Theme } from "../types"

// Normalizes the 0–100 intelligence index against a 70-point visual ceiling
const BAR_CEIL = 70

export function IntelligenceBar({
  score,
  color,
  theme,
  width = "w-10"
}: {
  score: number
  color: string
  theme: Theme
  width?: string
}) {
  const isDark = theme === "dark"
  return (
    <span className="inline-flex items-center gap-1.5" title={`Intelligence ${score}`}>
      <span
        className={`h-1 ${width} rounded-full overflow-hidden inline-block flex-shrink-0 ${isDark ? "bg-gray-800" : "bg-gray-200"}`}
      >
        <span
          className="block h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min((score / BAR_CEIL) * 100, 100)}%`,
            background: color
          }}
        />
      </span>
      <span className={`font-mono tabular-nums ${isDark ? "text-gray-200" : "text-gray-700"}`}>
        {score}
      </span>
    </span>
  )
}
