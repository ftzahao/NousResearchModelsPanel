import React, { useState, useMemo, useEffect } from "react"
import BigNumber from "bignumber.js"
import { buildGcmpCompatibleModels, buildModelCatalogJson } from "./model-export"
import type { Model, ExportableModel, ModelConfigExporter, Lang, Theme } from "./types"
import { translations, LangContext } from "./i18n"
import { ThemeContext, CurrencyContext } from "./contexts"
import { useModels } from "./hooks/useModels"
import { useCurrencyState } from "./hooks/useCurrency"
import { bn, getProvider } from "./utils"
import { Header, type Tab } from "./components/Header"
import { StatsGrid, type AppStats } from "./components/StatsGrid"
import { FilterBar } from "./components/FilterBar"
import { ModelCard } from "./components/ModelCard"
import { ExportToolbar } from "./components/ExportToolbar"
import { ExportPreviewModal } from "./components/ExportPreviewModal"
import { Footer } from "./components/Footer"
import { PricingChart, BenchmarkScatter, ContextChart, ProviderPie } from "./components/charts"
import { Search } from "lucide-react"

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang")
    if (saved === "zh" || saved === "en") return saved
    return "zh"
  })
  const t = translations[lang]

  const handleSetLang = (l: Lang) => {
    setLang(l)
    localStorage.setItem("lang", l)
  }
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme")
    if (saved === "light" || saved === "dark") return saved
    return "dark"
  })

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      localStorage.setItem("theme", next)
      return next
    })
  }

  useEffect(() => {
    document.body.className = theme
  }, [theme])

  const currency = useCurrencyState()
  const { models, loading, error } = useModels()

  const [search, setSearch] = useState("")
  const [provider, setProvider] = useState<string[]>([])
  const [modality, setModality] = useState<string[]>([])
  const [sortBy, setSortBy] = useState("newest")
  const [showReasoning, setShowReasoning] = useState(false)
  const [showFree, setShowFree] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rawDetails, setRawDetails] = useState<Record<string, boolean>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporterId, setExporterId] = useState("codex")
  const [previewPayload, setPreviewPayload] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("models")

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
    if (showFree) result = result.filter((m) => bn(m.pricing?.prompt).isZero())

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
  }, [models, search, provider, modality, sortBy, showReasoning, showFree])

  const exporters = useMemo<ModelConfigExporter[]>(
    () => [
      {
        id: "codex",
        label: t.codexCatalog,
        fileName: "models.json",
        build: (items) => buildModelCatalogJson(items)
      },
      {
        id: "github-copilot-gcmp",
        label: t.gcmpCompatible,
        fileName: "gcmp-compatible-models.json",
        build: (items) => buildGcmpCompatibleModels(items)
      }
    ],
    [t]
  )
  const selectedModels = useMemo(
    () => models.filter((model) => selectedIds.has(model.id)),
    [models, selectedIds]
  )
  const activeExporter = exporters.find((exporter) => exporter.id === exporterId) ?? exporters[0]

  const openExportPreview = () => {
    if (!activeExporter || selectedModels.length === 0) return
    setPreviewPayload(
      JSON.stringify(activeExporter.build(selectedModels as ExportableModel[]), null, 2)
    )
  }

  const closeExportPreview = () => setPreviewPayload(null)

  const stats = useMemo<AppStats>(
    () => ({
      total: models.length,
      providers: new Set(models.map((m) => getProvider(m.id))).size,
      reasoning: models.filter((m) => m.reasoning).length,
      free: models.filter((m) => bn(m.pricing?.prompt).isZero()).length,
      avgIntelligence: (() => {
        const vals = models
          .map((m) => m.benchmarks?.artificial_analysis?.intelligence_index)
          .filter((v): v is number => v != null)
        if (!vals.length) return "—"
        const sum = vals.reduce((acc, v) => acc.plus(v), new BigNumber(0))
        return sum.div(vals.length).toFixed(1)
      })()
    }),
    [models]
  )

  if (loading) {
    return (
      <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
        <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                {t.loading}
              </p>
            </div>
          </div>
        </LangContext.Provider>
      </ThemeContext.Provider>
    )
  }

  if (error) {
    return (
      <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
        <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center glass rounded-2xl p-8">
              <p className="text-red-400 text-sm mb-2">{t.loadFailed}</p>
              <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                {error}
              </p>
            </div>
          </div>
        </LangContext.Provider>
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <LangContext.Provider value={{ lang, t, setLang: handleSetLang }}>
        <CurrencyContext.Provider value={currency}>
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
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    providers={providers}
                    modalities={modalities}
                  />

                  <ExportToolbar
                    selectedCount={selectedModels.length}
                    exporters={exporters}
                    exporterId={exporterId}
                    setExporterId={setExporterId}
                    onSelectVisible={() =>
                      setSelectedIds(new Set(filtered.map((model) => model.id)))
                    }
                    onClearSelection={() => setSelectedIds(new Set())}
                    onPreview={openExportPreview}
                  />

                  <div
                    className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                  >
                    {t.showing} {filtered.length} {t.of} {models.length} {t.modelsCount}
                    {search && (
                      <span>
                        {" "}
                        {t.matching} "{search}"
                      </span>
                    )}
                  </div>

                  <div
                    className={`grid gap-3 ${
                      viewMode === "grid"
                        ? "model-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                        : "grid-cols-1"
                    }`}
                  >
                    {filtered.map((m) => (
                      <ModelCard
                        key={m.id}
                        model={m}
                        expanded={expandedId === m.id}
                        onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                        selected={selectedIds.has(m.id)}
                        onSelect={() =>
                          setSelectedIds((current) => {
                            const next = new Set(current)
                            if (next.has(m.id)) next.delete(m.id)
                            else next.add(m.id)
                            return next
                          })
                        }
                        rawDetails={rawDetails[m.id] ?? false}
                        onToggleRawDetails={() =>
                          setRawDetails((current) => ({
                            ...current,
                            [m.id]: !(current[m.id] ?? false)
                          }))
                        }
                      />
                    ))}
                  </div>

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
                  <PricingChart models={models} />
                  <BenchmarkScatter models={models} />
                  <ContextChart models={models} />
                  <ProviderPie models={models} />
                </div>
              )}
            </main>

            {previewPayload && activeExporter && (
              <ExportPreviewModal
                payload={previewPayload}
                fileName={activeExporter.fileName}
                selectedCount={selectedModels.length}
                onClose={closeExportPreview}
              />
            )}

            <Footer />
          </div>
        </CurrencyContext.Provider>
      </LangContext.Provider>
    </ThemeContext.Provider>
  )
}
