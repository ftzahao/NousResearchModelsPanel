import type { Theme } from "../types"

export function SelectCheckbox({
  checked,
  onToggle,
  ariaLabel,
  theme
}: {
  checked: boolean
  onToggle: () => void
  ariaLabel: string
  theme: Theme
}) {
  const isDark = theme === "dark"
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
        checked
          ? "!bg-blue-700 !border-blue-900 text-white shadow-[0_0_0_2px_rgba(37,99,235,0.35)]"
          : isDark
            ? "border-gray-500 bg-gray-800/80 text-transparent hover:border-brand-400"
            : "border-gray-400 bg-white text-transparent shadow-sm hover:border-brand-500"
      }`}
    >
      {checked && (
        <span
          aria-hidden="true"
          className="text-white font-black text-[12px] leading-none"
          style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
        >
          ✓
        </span>
      )}
    </button>
  )
}
