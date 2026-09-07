import React from "react"
import { Search, Brain, Sparkles, Grid3X3, List, X } from "lucide-react"
import { useLang } from "../i18n"
import { useTheme } from "../contexts"

export function FilterBar({
  search,
  setSearch,
  provider,
  setProvider,
  modality,
  setModality,
  sortBy,
  setSortBy,
  showReasoning,
  setShowReasoning,
  showFree,
  setShowFree,
  viewMode,
  setViewMode,
  providers,
  modalities
}: {
  search: string
  setSearch: (v: string) => void
  provider: string
  setProvider: (v: string) => void
  modality: string
  setModality: (v: string) => void
  sortBy: string
  setSortBy: (v: string) => void
  showReasoning: boolean
  setShowReasoning: (v: boolean) => void
  showFree: boolean
  setShowFree: (v: boolean) => void
  viewMode: "grid" | "list"
  setViewMode: (v: "grid" | "list") => void
  providers: string[]
  modalities: string[]
}) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const inputClass = `w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50 border ${isDark ? "bg-gray-900/50 text-gray-200 placeholder-gray-500 border-white/5" : "bg-white text-gray-900 placeholder-gray-400 border-gray-200"}`
  const selectClass = `px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50 border appearance-none select-arrow ${isDark ? "bg-gray-900/50 text-gray-300 border-white/5" : "bg-white text-gray-700 border-gray-200"}`

  return (
    <div className="glass rounded-2xl p-3 animate-fade-in">
      <div className="filter-inner flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="filter-search relative flex-1 min-w-[160px] sm:min-w-[200px]">
          <Search
            size={14}
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-500" : "text-gray-400"}`}
          />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X
                size={14}
                className={
                  isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                }
              />
            </button>
          )}
        </div>

        {/* Selects row */}
        <div className="filter-selects flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={selectClass}
          >
            <option value="">{t.allProviders}</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            className={selectClass}
          >
            <option value="">{t.allModalities}</option>
            {modalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={selectClass}
          >
            <option value="newest">{t.newest}</option>
            <option value="prompt-asc">{t.priceLowHigh}</option>
            <option value="prompt-desc">{t.priceHighLow}</option>
            <option value="context">{t.contextLength}</option>
            <option value="intelligence">{t.intelligence}</option>
            <option value="coding">{t.codingIndex}</option>
            <option value="name">{t.nameAZ}</option>
          </select>
        </div>

        {/* Toggles row */}
        <div className="filter-toggles flex items-center gap-2">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className={`px-2 sm:px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${
              showReasoning
                ? isDark
                  ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                  : "bg-violet-100 text-violet-700 border-violet-300"
                : isDark
                  ? "bg-gray-900/50 text-gray-400 border-white/5"
                  : "bg-gray-100 text-gray-500 border-gray-200"
            }`}
          >
            <Brain size={12} /> {t.reasoning}
          </button>
          <button
            onClick={() => setShowFree(!showFree)}
            className={`px-2 sm:px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${
              showFree
                ? isDark
                  ? "bg-green-500/20 text-green-300 border-green-500/30"
                  : "bg-green-100 text-green-700 border-green-300"
                : isDark
                  ? "bg-gray-900/50 text-gray-400 border-white/5"
                  : "bg-gray-100 text-gray-500 border-gray-200"
            }`}
          >
            <Sparkles size={12} /> {t.free}
          </button>
          <div
            className={`flex rounded-lg border overflow-hidden ${isDark ? "bg-gray-900/50 border-white/5" : "bg-gray-100 border-gray-200"}`}
          >
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

