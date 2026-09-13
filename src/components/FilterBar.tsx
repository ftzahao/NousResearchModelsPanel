import React, { useEffect, useRef, useState } from "react"
import {
  Search,
  Brain,
  Sparkles,
  Grid3X3,
  List,
  Table,
  LayoutGrid,
  X,
  BadgePercent
} from "lucide-react"
import type { ViewMode } from "../types"
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
  showDiscount,
  setShowDiscount,
  viewMode,
  setViewMode,
  providers,
  modalities
}: {
  search: string
  setSearch: (v: string) => void
  provider: string[]
  setProvider: (v: string[]) => void
  modality: string[]
  setModality: (v: string[]) => void
  sortBy: string
  setSortBy: (v: string) => void
  showReasoning: boolean
  setShowReasoning: (v: boolean) => void
  showFree: boolean
  setShowFree: (v: boolean) => void
  showDiscount: boolean
  setShowDiscount: (v: boolean) => void
  viewMode: ViewMode
  setViewMode: (v: ViewMode) => void
  providers: string[]
  modalities: string[]
}) {
  const { t } = useLang()
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const inputClass = `w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50 border ${isDark ? "bg-gray-900/50 text-gray-200 placeholder-gray-500 border-white/5" : "bg-white text-gray-900 placeholder-gray-400 border-gray-200"}`
  const selectClass = `px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500/50 border appearance-none select-arrow ${isDark ? "bg-gray-900/50 text-gray-300 border-white/5" : "bg-white text-gray-700 border-gray-200"}`

  const [providerOpen, setProviderOpen] = useState(false)
  const providerRef = useRef<HTMLDivElement>(null)
  const [modalityOpen, setModalityOpen] = useState(false)
  const modalityRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!providerOpen) return
    const handler = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node))
        setProviderOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [providerOpen])

  useEffect(() => {
    if (!modalityOpen) return
    const handler = (e: MouseEvent) => {
      if (modalityRef.current && !modalityRef.current.contains(e.target as Node))
        setModalityOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [modalityOpen])

  const toggleProvider = (p: string) => {
    setProvider(provider.includes(p) ? provider.filter((x) => x !== p) : [...provider, p])
  }

  const toggleModality = (m: string) => {
    setModality(modality.includes(m) ? modality.filter((x) => x !== m) : [...modality, m])
  }

  return (
    <div className="glass relative z-20 rounded-2xl p-3 animate-fade-in">
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
          <div className="relative" ref={providerRef}>
            <button
              onClick={() => setProviderOpen(!providerOpen)}
              className={`${selectClass} flex items-center gap-1.5`}
            >
              {provider.length === 0 ? t.allProviders : `${provider.length} ${t.selected}`}
            </button>
            {providerOpen && (
              <div
                className={`absolute left-0 top-full z-30 mt-1 max-h-64 w-48 overflow-y-auto rounded-lg border p-1 shadow-lg ${isDark ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
              >
                {providers.map((p) => {
                  const checked = provider.includes(p)
                  return (
                    <label
                      key={p}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${isDark ? "text-gray-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-100"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProvider(p)}
                        className="accent-brand-500"
                      />
                      {p}
                    </label>
                  )
                })}
                {provider.length > 0 && (
                  <button
                    onClick={() => setProvider([])}
                    className={`mt-1 w-full rounded-md px-2 py-1.5 text-xs ${isDark ? "text-gray-500 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}
                  >
                    {t.clear}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="relative" ref={modalityRef}>
            <button
              onClick={() => setModalityOpen(!modalityOpen)}
              className={`${selectClass} flex items-center gap-1.5`}
            >
              {modality.length === 0 ? t.allModalities : `${modality.length} ${t.selected}`}
            </button>
            {modalityOpen && (
              <div
                className={`absolute left-0 top-full z-30 mt-1 max-h-64 w-48 overflow-y-auto rounded-lg border p-1 shadow-lg ${isDark ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
              >
                {modalities.map((m) => {
                  const checked = modality.includes(m)
                  return (
                    <label
                      key={m}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${isDark ? "text-gray-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-100"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModality(m)}
                        className="accent-brand-500"
                      />
                      {m}
                    </label>
                  )
                })}
                {modality.length > 0 && (
                  <button
                    onClick={() => setModality([])}
                    className={`mt-1 w-full rounded-md px-2 py-1.5 text-xs ${isDark ? "text-gray-500 hover:bg-white/5" : "text-gray-400 hover:bg-gray-100"}`}
                  >
                    {t.clear}
                  </button>
                )}
              </div>
            )}
          </div>
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
                  ? "bg-brand-500/20 text-brand-300 border-brand-500/40"
                  : "bg-brand-100 text-brand-700 border-brand-300"
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
          <button
            onClick={() => setShowDiscount(!showDiscount)}
            className={`px-2 sm:px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${
              showDiscount
                ? isDark
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-amber-100 text-amber-700 border-amber-300"
                : isDark
                  ? "bg-gray-900/50 text-gray-400 border-white/5"
                  : "bg-gray-100 text-gray-500 border-gray-200"
            }`}
          >
            <BadgePercent size={12} /> {t.discount}
          </button>
          <div
            className={`flex rounded-lg border overflow-hidden ${isDark ? "bg-gray-900/50 border-white/5" : "bg-gray-100 border-gray-200"}`}
          >
            <button
              onClick={() => setViewMode("grid")}
              title={t.gridView}
              className={`p-2 ${viewMode === "grid" ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title={t.listView}
              className={`p-2 ${viewMode === "list" ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode("compact-table")}
              title={t.compactTable}
              className={`p-2 ${viewMode === "compact-table" ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              <Table size={14} />
            </button>
            <button
              onClick={() => setViewMode("compact-cards")}
              title={t.compactCards}
              className={`p-2 ${viewMode === "compact-cards" ? (isDark ? "bg-brand-500/20 text-brand-300" : "bg-brand-100 text-brand-700") : isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
