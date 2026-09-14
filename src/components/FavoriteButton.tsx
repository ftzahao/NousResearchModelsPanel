import { useState, useEffect } from "react"
import { Star } from "lucide-react"
import { useLang } from "../i18n"
import { useTheme } from "../contexts"

export function FavoriteButton({
  active,
  onToggle,
  size = 14
}: {
  active: boolean
  onToggle: () => void
  size?: number
}) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  // Track the activating click so the pop animation only plays on
  // favorite-on, never on initial mount or on unfavorite.
  const [bursting, setBursting] = useState(false)
  useEffect(() => {
    if (!bursting) return
    const timer = setTimeout(() => setBursting(false), 450)
    return () => clearTimeout(timer)
  }, [bursting])

  return (
    <span className="relative inline-flex flex-shrink-0">
      {bursting && (
        <span
          aria-hidden
          className="favorite-burst absolute inset-0 m-auto rounded-full"
          style={{ width: size, height: size }}
        />
      )}
      <button
        type="button"
        title={active ? t.removeFavorite : t.addFavorite}
        aria-label={active ? t.removeFavorite : t.addFavorite}
        aria-pressed={active}
        onClick={(event) => {
          event.stopPropagation()
          if (!active) setBursting(true)
          onToggle()
        }}
        className={`p-0.5 rounded flex-shrink-0 transition-colors ${
          bursting
            ? "favorite-pop text-amber-400"
            : active
              ? "text-amber-400"
              : isDark
                ? "text-gray-500 hover:text-amber-300 hover:bg-white/10"
                : "text-gray-400 hover:text-amber-500 hover:bg-gray-100"
        }`}
      >
        <Star
          size={size}
          fill={active || bursting ? "currentColor" : "none"}
          className={bursting ? "favorite-icon-pop" : undefined}
        />
      </button>
    </span>
  )
}
