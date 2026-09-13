import type { Model } from "../types"
import { useTheme } from "../contexts"
import { modalityIcons, modalityColors } from "../utils"

export function ModalityFlow({ model }: { model: Model }) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const renderTag = (m: string) => {
    const colors =
      modalityColors[m] ??
      (isDark
        ? { dark: "bg-gray-500/20 text-gray-300", light: "bg-gray-100 text-gray-600" }
        : { dark: "", light: "" })
    return (
      <span
        key={m}
        className={`modality-tag flex items-center gap-0.5 ${isDark ? colors.dark : colors.light}`}
      >
        {modalityIcons[m]} {m}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {model.architecture?.input_modalities?.map(renderTag)}
      <span className={`text-[10px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>→</span>
      {model.architecture?.output_modalities?.map(renderTag)}
    </div>
  )
}
