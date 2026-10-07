import { AlertTriangle } from "lucide-react"
import { useLang } from "../i18n"
import { useTheme } from "../contexts"
import { getProviderColor } from "../utils"
import { FavoriteButton } from "./FavoriteButton"

/**
 * Favorited ids that the upstream API no longer returns. They can't render as
 * normal model cards (there is no data left), so they get their own strip where
 * each one can still be unfavorited.
 */
export function MissingFavorites({
  ids,
  onToggleFavorite,
  onRemoveAll
}: {
  ids: string[]
  onToggleFavorite: (id: string) => void
  onRemoveAll: () => void
}) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"

  if (ids.length === 0) return null

  return (
    <div
      className={`glass animate-fade-in rounded-2xl p-3 border ${
        isDark ? "border-amber-500/25 bg-amber-500/[0.04]" : "border-amber-300/70 bg-amber-50/70"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className={`text-xs font-semibold ${isDark ? "text-amber-300" : "text-amber-800"}`}>
              {t.missingFavoritesTitle}
              <span className={`ml-1.5 font-mono ${isDark ? "text-amber-400/70" : "text-amber-700/80"}`}>
                ({ids.length})
              </span>
            </p>
            <p className={`mt-0.5 text-[11px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              {t.missingFavoritesDesc}
            </p>
          </div>
        </div>
        {ids.length > 1 && (
          <button
            type="button"
            onClick={onRemoveAll}
            title={t.removeAllMissing}
            aria-label={t.removeAllMissing}
            className={`flex-shrink-0 rounded-lg border px-2 py-1 text-[11px] transition-colors ${
              isDark
                ? "border-white/10 bg-gray-900/50 text-gray-400 hover:border-red-400/30 hover:text-red-400"
                : "border-gray-200 bg-white text-gray-500 hover:border-red-300 hover:text-red-600"
            }`}
          >
            {t.removeAllMissing}
          </button>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <li
            key={id}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
              isDark ? "border-white/10 bg-black/20" : "border-gray-200 bg-white/80"
            }`}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ background: getProviderColor(id) }}
            />
            <span
              className={`font-mono text-[11px] ${isDark ? "text-gray-300" : "text-gray-700"}`}
              title={id}
            >
              {id}
            </span>
            <FavoriteButton active onToggle={() => onToggleFavorite(id)} size={12} />
          </li>
        ))}
      </ul>
    </div>
  )
}
