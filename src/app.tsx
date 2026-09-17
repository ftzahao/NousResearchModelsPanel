import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"
import BigNumber from "bignumber.js"
import { stringify } from "yaml"
import {
  buildDshProviderConfig,
  buildGcmpCompatibleModels,
  buildGithubCopilotLanguageModels,
  buildCodexConfigToml,
  buildModelCatalogJson,
  buildZcodeConfig,
  buildLitellmConfig,
  buildOpencodeConfig,
  buildCrushConfig,
  buildChatboxProviderConfig,
  buildCherryStudioProvider,
  buildZedSettings
} from "./model-export"
import type { Model, ModelConfigExporter, ExportPreviewFile, Lang, Theme, ViewMode } from "./types"
import { translations, LangContext } from "./i18n"
import { ThemeContext, CurrencyContext } from "./contexts"
import { useModels } from "./hooks/useModels"
import { useCurrencyState } from "./hooks/useCurrency"
import { bn, getProvider, getDiscount, isFreePrice } from "./utils"
import { Header, type Tab } from "./components/Header"
import { StatsGrid, type AppStats } from "./components/StatsGrid"
import { FilterBar } from "./components/FilterBar"
import { ModelCard } from "./components/ModelCard"
import { CompactModelTable } from "./components/CompactModelTable"
import { CompactModelCard } from "./components/CompactModelCard"
import { ModelDetailModal } from "./components/ModelDetailModal"
import { ExportToolbar } from "./components/ExportToolbar"
import { ExportPreviewModal } from "./components/ExportPreviewModal"
import { SelectedModelsModal } from "./components/SelectedModelsModal"
import { Footer } from "./components/Footer"
import {
  PricingChart,
  BenchmarkScatter,
  ValueScatter,
  DiscountChart,
  ContextChart,
  ProviderPie
} from "./components/charts"
import { Search } from "lucide-react"

const PAGE_SIZE = 60

function AppProviders({
  themeValue,
  langValue,
  currency,
  children
}: {
  themeValue: { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void }
  langValue: { lang: Lang; t: (typeof translations)["zh"]; setLang: (l: Lang) => void }
  currency: ReturnType<typeof useCurrencyState>
  children: React.ReactNode
}) {
  return (
    <ThemeContext.Provider value={themeValue}>
      <LangContext.Provider value={langValue}>
        <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>
      </LangContext.Provider>
    </ThemeContext.Provider>
  )
}

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang")
    if (saved === "zh" || saved === "en") return saved
    return "zh"
  })
  const t = translations[lang]

  const handleSetLang = useCallback((l: Lang) => {
    setLang(l)
    localStorage.setItem("lang", l)
  }, [])
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme")
    if (saved === "light" || saved === "dark") return saved
    return "dark"
  })

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      localStorage.setItem("theme", next)
      return next
    })
  }, [])

  useEffect(() => {
    document.body.className = theme
  }, [theme])

  const currency = useCurrencyState()
  const { models, loading, error } = useModels()

  const themeValue = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, toggleTheme])
  const langValue = useMemo(() => ({ lang, t, setLang: handleSetLang }), [lang, t, handleSetLang])

  const [search, setSearch] = useState("")
  const [provider, setProvider] = useState<string[]>([])
  const [modality, setModality] = useState<string[]>([])
  const [sortBy, setSortBy] = useState("newest")
  const [showReasoning, setShowReasoning] = useState(false)
  const [showFree, setShowFree] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("favorites")
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify([...favorites]))
  }, [favorites])
  const toggleFavorite = useCallback(
    (id: string) =>
      setFavorites((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    []
  )
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("viewMode")
    if (saved === "list" || saved === "compact-table" || saved === "compact-cards") return saved
    return "grid"
  })
  const handleSetViewMode = (v: ViewMode) => {
    setViewMode(v)
    localStorage.setItem("viewMode", v)
  }
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rawDetails, setRawDetails] = useState<Record<string, boolean>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporterId, setExporterId] = useState("codex")
  const [previewFiles, setPreviewFiles] = useState<ExportPreviewFile[] | null>(null)
  const [showSelectedModels, setShowSelectedModels] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("models")

  // Progressive rendering: only a slice of filtered models is mounted; scroll appends more
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const providers = useMemo(
    () => [...new Set(models.map((m) => getProvider(m.id)))].sort(),
    [models]
  )

  const modalities = useMemo(() => {
    const s = new Set<string>()
    models.forEach((m) => m.architecture?.input_modalities?.forEach((mod) => s.add(mod)))
    return [...s].sort()
  }, [models])

  const filtered = useMemo(() => {
    let result = models

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q)
      )
    }
    if (provider.length) result = result.filter((m) => provider.includes(getProvider(m.id)))
    if (modality.length)
      result = result.filter((m) =>
        modality.some((mod) => m.architecture?.input_modalities?.includes(mod))
      )
    if (showReasoning) result = result.filter((m) => m.reasoning)
    if (showFree) result = result.filter((m) => isFreePrice(m.pricing?.prompt))
    if (showDiscount) result = result.filter((m) => getDiscount(m) !== null)
    if (showFavorites) result = result.filter((m) => favorites.has(m.id))

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.created - a.created
        case "prompt-asc":
          return bn(a.pricing?.prompt)
            .minus(b.pricing?.prompt ?? "0")
            .toNumber()
        case "prompt-desc":
          return bn(b.pricing?.prompt)
            .minus(a.pricing?.prompt ?? "0")
            .toNumber()
        case "context":
          return b.context_length - a.context_length
        case "intelligence":
          return (
            (b.benchmarks?.artificial_analysis?.intelligence_index ?? 0) -
            (a.benchmarks?.artificial_analysis?.intelligence_index ?? 0)
          )
        case "coding":
          return (
            (b.benchmarks?.artificial_analysis?.coding_index ?? 0) -
            (a.benchmarks?.artificial_analysis?.coding_index ?? 0)
          )
        case "name":
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return result
  }, [
    models,
    search,
    provider,
    modality,
    sortBy,
    showReasoning,
    showFree,
    showDiscount,
    showFavorites,
    favorites
  ])

  const visibleModels = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = filtered.length > visibleModels.length

  // one dependency for every filter that should restart the page window
  const filterKey = JSON.stringify([
    search,
    provider,
    modality,
    sortBy,
    showReasoning,
    showFree,
    showDiscount,
    showFavorites
  ])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filterKey])

  useEffect(() => {
    const el = sentinelRef.current
    if (!hasMore || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => count + PAGE_SIZE)
        }
      },
      { rootMargin: "600px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // re-observe after each append so a still-visible sentinel keeps loading
  }, [hasMore, visibleCount, viewMode])

  const exporters = useMemo<ModelConfigExporter[]>(
    () => [
      {
        id: "codex",
        label: t.codexSetup,
        fileName: "codex-config.toml",
        format: "toml",
        usage: t.codexUsage,
        warning: t.codexWarning,
        build: (items) => buildCodexConfigToml(items),
        extraFiles: [{ fileName: "models.json", build: (items) => buildModelCatalogJson(items) }]
      },
      {
        id: "github-copilot-gcmp",
        label: t.gcmpCompatible,
        fileName: "gcmp-compatible-models.json",
        build: (items) => buildGcmpCompatibleModels(items)
      },
      {
        id: "github-copilot-language-models",
        label: t.githubCopilotLanguageModels,
        fileName: "chatLanguageModels.json",
        build: (items) => buildGithubCopilotLanguageModels(items)
      },
      {
        id: "zcode",
        label: t.zcodeProviders,
        fileName: "zcode-providers.json",
        build: (items) => buildZcodeConfig(items)
      },
      {
        id: "deepseek-harness",
        label: t.deepseekHarnessProviders,
        fileName: "dsh-llm-pi-ai.yaml",
        format: "yaml",
        build: (items) => buildDshProviderConfig(items)
      },
      {
        id: "litellm",
        label: t.litellmConfig,
        fileName: "litellm-config.yaml",
        format: "yaml",
        usage: t.litellmUsage,
        build: (items) => buildLitellmConfig(items)
      },
      {
        id: "opencode",
        label: t.opencodeConfig,
        fileName: "opencode.json",
        usage: t.opencodeUsage,
        build: (items) => buildOpencodeConfig(items)
      },
      {
        id: "crush",
        label: t.crushConfig,
        fileName: "crush.json",
        usage: t.crushUsage,
        build: (items) => buildCrushConfig(items)
      },
      {
        id: "chatbox",
        label: t.chatboxProvider,
        fileName: "chatbox-nous-provider.json",
        usage: t.chatboxUsage,
        build: (items) => buildChatboxProviderConfig(items)
      },
      {
        id: "cherry-studio",
        label: t.cherryStudioProvider,
        fileName: "cherry-studio-nous.json",
        usage: t.cherryStudioUsage,
        build: (items) => buildCherryStudioProvider(items)
      },
      {
        id: "zed",
        label: t.zedSettings,
        fileName: "zed-language-models.json",
        usage: t.zedUsage,
        build: (items) => buildZedSettings(items)
      }
    ],
    [t]
  )
  const selectedModels = useMemo(
    () => models.filter((model) => selectedIds.has(model.id)),
    [models, selectedIds]
  )
  const detailModel = detailId ? (models.find((m) => m.id === detailId) ?? null) : null
  const activeExporter = exporters.find((exporter) => exporter.id === exporterId) ?? exporters[0]

  const serializeExport = (payload: unknown, format?: "yaml" | "toml") =>
    format === "yaml"
      ? stringify(payload)
      : format === "toml"
        ? String(payload)
        : JSON.stringify(payload, null, 2)

  const openExportPreview = () => {
    if (!activeExporter || selectedModels.length === 0) return
    setPreviewFiles([
      {
        fileName: activeExporter.fileName,
        content: serializeExport(activeExporter.build(selectedModels), activeExporter.format)
      },
      ...(activeExporter.extraFiles ?? []).map((file) => ({
        fileName: file.fileName,
        content: serializeExport(file.build(selectedModels), file.format)
      }))
    ])
  }

  const closeExportPreview = () => setPreviewFiles(null)

  const updateSelection = useCallback((mutate: (next: Set<string>) => void) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      mutate(next)
      return next
    })
  }, [])

  const toggleSelect = useCallback(
    (id: string) =>
      updateSelection((next) => {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }),
    [updateSelection]
  )

  const removeSelected = useCallback(
    (id: string) =>
      updateSelection((next) => {
        next.delete(id)
      }),
    [updateSelection]
  )

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id))
  }, [])

  const toggleRawDetails = useCallback((id: string) => {
    setRawDetails((current) => ({ ...current, [id]: !(current[id] ?? false) }))
  }, [])

  const locateSelected = (id: string) => {
    setShowSelectedModels(false)
    setExpandedId(id)
    setTab("models")
    requestAnimationFrame(() => {
      document
        .getElementById(`model-card-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  const stats = useMemo<AppStats>(
    () => ({
      total: models.length,
      providers: providers.length,
      reasoning: models.filter((m) => m.reasoning).length,
      free: models.filter((m) => isFreePrice(m.pricing?.prompt)).length,
      avgIntelligence: (() => {
        const vals = models
          .map((m) => m.benchmarks?.artificial_analysis?.intelligence_index)
          .filter((v): v is number => v != null)
        if (!vals.length) return "—"
        const sum = vals.reduce((acc, v) => acc.plus(v), new BigNumber(0))
        return sum.div(vals.length).toFixed(1)
      })()
    }),
    [models, providers]
  )

  if (loading) {
    return (
      <AppProviders themeValue={themeValue} langValue={langValue} currency={currency}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              {t.loading}
            </p>
          </div>
        </div>
      </AppProviders>
    )
  }

  if (error) {
    return (
      <AppProviders themeValue={themeValue} langValue={langValue} currency={currency}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center glass rounded-2xl p-8">
            <p className="text-red-400 text-sm mb-2">{t.loadFailed}</p>
            <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
              {error}
            </p>
          </div>
        </div>
      </AppProviders>
    )
  }

  return (
    <AppProviders themeValue={themeValue} langValue={langValue} currency={currency}>
      <div className="min-h-screen overflow-x-hidden">
        <Header tab={tab} onTabChange={setTab} />

        <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 space-y-4">
          <StatsGrid stats={stats} />

          {tab === "models" ? (
            <>
              <FilterBar
                search={search}
                setSearch={setSearch}
                provider={provider}
                setProvider={setProvider}
                modality={modality}
                setModality={setModality}
                sortBy={sortBy}
                setSortBy={setSortBy}
                showReasoning={showReasoning}
                setShowReasoning={setShowReasoning}
                showFree={showFree}
                setShowFree={setShowFree}
                showDiscount={showDiscount}
                setShowDiscount={setShowDiscount}
                showFavorites={showFavorites}
                setShowFavorites={setShowFavorites}
                favoriteCount={favorites.size}
                onClearFavorites={() => setFavorites(new Set())}
                viewMode={viewMode}
                setViewMode={handleSetViewMode}
                providers={providers}
                modalities={modalities}
              />

              <ExportToolbar
                selectedCount={selectedModels.length}
                exporters={exporters}
                exporterId={exporterId}
                setExporterId={setExporterId}
                onSelectVisible={() => setSelectedIds(new Set(filtered.map((model) => model.id)))}
                onAppendVisible={() =>
                  updateSelection((next) => {
                    filtered.forEach((model) => next.add(model.id))
                  })
                }
                onClearSelection={() => setSelectedIds(new Set())}
                onPreview={openExportPreview}
                onViewSelected={() => setShowSelectedModels(true)}
              />

              <div className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                {t.showing} {visibleModels.length}
                {hasMore ? ` / ${filtered.length}` : ` ${t.of} ${models.length}`} {t.modelsCount}
                {hasMore && <span className="ml-1.5">· {t.scrollForMore}</span>}
                {search && (
                  <span>
                    {" "}
                    {t.matching} "{search}"
                  </span>
                )}
              </div>

              {viewMode === "compact-table" ? (
                <CompactModelTable
                  models={visibleModels}
                  selectedIds={selectedIds}
                  onSelect={toggleSelect}
                  onShowDetails={setDetailId}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              ) : viewMode === "compact-cards" ? (
                <div className="card-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                  {visibleModels.map((m) => (
                    <CompactModelCard
                      key={m.id}
                      model={m}
                      selected={selectedIds.has(m.id)}
                      onSelect={toggleSelect}
                      onShowDetails={setDetailId}
                      favorite={favorites.has(m.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className={`grid gap-3 ${
                    viewMode === "grid"
                      ? "model-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                      : "grid-cols-1"
                  }`}
                >
                  {visibleModels.map((m) => (
                    <ModelCard
                      key={m.id}
                      model={m}
                      expanded={expandedId === m.id}
                      onToggle={toggleExpanded}
                      selected={selectedIds.has(m.id)}
                      onSelect={toggleSelect}
                      rawDetails={rawDetails[m.id] ?? false}
                      onToggleRawDetails={toggleRawDetails}
                      favorite={favorites.has(m.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}

              {hasMore && (
                <div
                  ref={sentinelRef}
                  className={`py-3 text-center text-xs font-mono uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                >
                  {t.scrollForMore}
                </div>
              )}

              {filtered.length === 0 && (
                <div
                  className={`text-center py-16 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                >
                  <Search size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t.noModels}</p>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="md:col-span-2">
                <BenchmarkScatter models={models} onShowDetails={setDetailId} />
              </div>
              <div className="md:col-span-2">
                <ValueScatter models={models} onShowDetails={setDetailId} />
              </div>
              <PricingChart models={models} />
              <DiscountChart models={models} />
              <ContextChart models={models} />
              <ProviderPie models={models} />
            </div>
          )}
        </main>

        {previewFiles && activeExporter && (
          <ExportPreviewModal
            files={previewFiles}
            usage={activeExporter.usage}
            warning={activeExporter.warning}
            selectedCount={selectedModels.length}
            onClose={closeExportPreview}
          />
        )}

        {showSelectedModels && (
          <SelectedModelsModal
            models={selectedModels}
            onRemove={removeSelected}
            onClear={() => setSelectedIds(new Set())}
            onLocate={locateSelected}
            onClose={() => setShowSelectedModels(false)}
          />
        )}

        {detailModel && (
          <ModelDetailModal
            model={detailModel}
            selected={selectedIds.has(detailModel.id)}
            onSelect={() => toggleSelect(detailModel.id)}
            rawDetails={rawDetails[detailModel.id] ?? false}
            onToggleRawDetails={() =>
              setRawDetails((current) => ({
                ...current,
                [detailModel.id]: !(current[detailModel.id] ?? false)
              }))
            }
            favorite={favorites.has(detailModel.id)}
            onToggleFavorite={() => toggleFavorite(detailModel.id)}
            onClose={() => setDetailId(null)}
          />
        )}

        <Footer />
      </div>
    </AppProviders>
  )
}
