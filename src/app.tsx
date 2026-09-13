import React, { useState, useMemo, useEffect } from "react"
import BigNumber from "bignumber.js"
import { stringify } from "yaml"
import {
  buildDshProviderConfig,
  buildGcmpCompatibleModels,
  buildGithubCopilotLanguageModels,
  buildCodexConfigToml,
  buildModelCatalogJson,
  buildZcodeConfig
} from "./model-export"
import type {
  Model,
  ExportableModel,
  ModelConfigExporter,
  ExportPreviewFile,
  Lang,
  Theme,
  ViewMode
} from "./types"
import { translations, LangContext } from "./i18n"
import { ThemeContext, CurrencyContext } from "./contexts"
import { useModels } from "./hooks/useModels"
import { useCurrencyState } from "./hooks/useCurrency"
import { bn, getProvider, getDiscount } from "./utils"
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
  const [showDiscount, setShowDiscount] = useState(false)
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
    if (showDiscount) result = result.filter((m) => getDiscount(m) !== null)

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
  }, [models, search, provider, modality, sortBy, showReasoning, showFree, showDiscount])

  const exporters = useMemo<ModelConfigExporter[]>(
    () => [
      {
        id: "codex",
        label: t.codexSetup,
        fileName: "codex-config.toml",
        format: "toml",
        usage: t.codexUsage,
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
    const items = selectedModels as ExportableModel[]
    setPreviewFiles([
      {
        fileName: activeExporter.fileName,
        content: serializeExport(activeExporter.build(items), activeExporter.format)
      },
      ...(activeExporter.extraFiles ?? []).map((file) => ({
        fileName: file.fileName,
        content: serializeExport(file.build(items), file.format)
      }))
    ])
  }

  const closeExportPreview = () => setPreviewFiles(null)

  const toggleSelect = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const removeSelected = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })

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
                    showDiscount={showDiscount}
                    setShowDiscount={setShowDiscount}
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
                    onSelectVisible={() =>
                      setSelectedIds(new Set(filtered.map((model) => model.id)))
                    }
                    onAppendVisible={() =>
                      setSelectedIds((current) => {
                        const next = new Set(current)
                        filtered.forEach((model) => next.add(model.id))
                        return next
                      })
                    }
                    onClearSelection={() => setSelectedIds(new Set())}
                    onPreview={openExportPreview}
                    onViewSelected={() => setShowSelectedModels(true)}
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

                  {viewMode === "compact-table" ? (
                    <CompactModelTable
                      models={filtered}
                      selectedIds={selectedIds}
                      onSelect={toggleSelect}
                      onShowDetails={setDetailId}
                    />
                  ) : viewMode === "compact-cards" ? (
                    <div className="card-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                      {filtered.map((m) => (
                        <CompactModelCard
                          key={m.id}
                          model={m}
                          selected={selectedIds.has(m.id)}
                          onSelect={() => toggleSelect(m.id)}
                          onShowDetails={() => setDetailId(m.id)}
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
                      {filtered.map((m) => (
                        <ModelCard
                          key={m.id}
                          model={m}
                          expanded={expandedId === m.id}
                          onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                          selected={selectedIds.has(m.id)}
                          onSelect={() => toggleSelect(m.id)}
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
                  <PricingChart models={models} />
                  <BenchmarkScatter models={models} />
                  <ContextChart models={models} />
                  <ProviderPie models={models} />
                </div>
              )}
            </main>

            {previewFiles && activeExporter && (
              <ExportPreviewModal
                files={previewFiles}
                usage={activeExporter.usage}
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
                onClose={() => setDetailId(null)}
              />
            )}

            <Footer />
          </div>
        </CurrencyContext.Provider>
      </LangContext.Provider>
    </ThemeContext.Provider>
  )
}
