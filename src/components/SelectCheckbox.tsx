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
          ? isDark
            ? "!bg-[#edff45] !border-[#edff45] shadow-[0_0_0_2px_rgba(237,255,69,0.35)]"
            : "!bg-brand-600 !border-brand-700 text-white shadow-[0_0_0_2px_rgba(0,0,242,0.3)]"
          : isDark
            ? "border-gray-500 bg-gray-800/80 text-transparent hover:border-[#edff45]"
            : "border-gray-400 bg-white text-transparent shadow-sm hover:border-brand-500"
      }`}
    >
      {checked && (
        <span
          aria-hidden="true"
          className={`pop-check font-black text-[12px] leading-none ${isDark ? "text-[#070722]" : "text-white"}`}
          style={{
            color: isDark ? "#070722" : "#ffffff",
            WebkitTextFillColor: isDark ? "#070722" : "#ffffff"
          }}
        >
          ✓
        </span>
      )}
    </button>
  )
}
