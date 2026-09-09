import React, { useState, useEffect, useMemo } from "react"
import BigNumber from "bignumber.js"
import { buildGcmpCompatibleModels, buildModelCatalogJson } from "../model-export"
import type { Model, ExportableModel, ModelConfigExporter, Lang, Theme, Currency } from "./types"
import { translations, LangContext } from "./i18n"
import { ThemeContext, CurrencyContext } from "./contexts"
import { bn, getProvider } from "./utils"
import { StatCard } from "./components/StatCard"
import { ModelCard } from "./components/ModelCard"
import { FilterBar } from "./components/FilterBar"
import { PricingChart, BenchmarkScatter, ContextChart, ProviderPie } from "./components/charts"
import {
  Grid3X3,
  BarChart3,
  ExternalLink,
  Sun,
  Moon,
  Globe,
  DollarSign,
  ChevronDown,
  Cpu,
  Layers,
  Brain,
  Sparkles,
  Activity,
  Search,
  Download,
  Eye,
  Copy,
  Check,
  X
} from "lucide-react"

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

  // Currency state
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem("currency") as Currency | null
    return saved === "CNY" ? "CNY" : "USD"
  })
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = localStorage.getItem("exchangeRate")
    return saved ? parseFloat(saved) : 7.25
  })
  const [customRate, setCustomRate] = useState<string>(() => {
    const saved = localStorage.getItem("customRate")
    return saved ?? ""
  })
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false)
  const [rateStatus, setRateStatus] = useState<"idle" | "fetching" | "success" | "error">("idle")

  const handleSetCurrency = (c: Currency) => {
    setCurrency(c)
    localStorage.setItem("currency", c)
  }

  const handleSetExchangeRate = (r: number) => {
    setExchangeRate(r)
    localStorage.setItem("exchangeRate", r.toString())
  }

  const handleSetCustomRate = (r: string) => {
    setCustomRate(r)
    localStorage.setItem("customRate", r)
  }

  const fetchExchangeRate = async () => {
    setRateStatus("fetching")
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      if (data.rates?.CNY) {
        handleSetExchangeRate(data.rates.CNY)
        handleSetCustomRate(data.rates.CNY.toString())
        setRateStatus("success")
      } else {
        throw new Error("CNY rate not found")
      }
    } catch {
      setRateStatus("error")
    }
    setTimeout(() => setRateStatus("idle"), 2000)
  }

  const handleApplyCustomRate = () => {
    const rate = parseFloat(customRate)
    if (!isNaN(rate) && rate > 0) {
      handleSetExchangeRate(rate)
      setShowCustomInput(false)
    }
  }
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [previewPayload, setPreviewPayload] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<"models" | "charts">("models")

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

  useEffect(() => {
    const controller = new AbortController()
    const API_URL = "https://inference-api.nousresearch.com/v1/models"
    fetch(API_URL, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setModels(d.data ?? [])
        setLoading(false)
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

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
    setShowExportMenu(false)
  }

  const closeExportPreview = () => {
    setPreviewPayload(null)
    setCopied(false)
  }

  const handleCopyExport = async () => {
    if (!previewPayload) return
    try {
      await navigator.clipboard.writeText(previewPayload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable (e.g. permissions denied)
    }
  }

  const handleExportDownload = () => {
    if (!activeExporter || !previewPayload) return
    const blob = new Blob([previewPayload], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = activeExporter.fileName
    anchor.click()
    URL.revokeObjectURL(url)
    closeExportPreview()
  }

  const stats = useMemo(
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
        <CurrencyContext.Provider
          value={{
            currency,
            setCurrency: handleSetCurrency,
            exchangeRate,
            setExchangeRate: handleSetExchangeRate,
            customRate,
            setCustomRate: handleSetCustomRate,
            showCustomInput,
            setShowCustomInput
          }}
        >
          <div className="min-h-screen overflow-x-hidden">
            {/* Header */}
            <header
              className={`sticky top-0 z-50 backdrop-blur-xl border-b ${theme === "dark" ? "bg-gray-950/80 border-white/5" : "bg-white/80 border-gray-200"}`}
            >
              <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                      <Cpu size={16} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <h1
                        className={`text-sm sm:text-base font-bold truncate ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                      >
                        {t.title}
                      </h1>
                      <p
                        className={`text-[10px] truncate ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                      >
                        {t.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="header-controls flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <button
                      onClick={() => setTab("models")}
                      className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        tab === "models"
                          ? theme === "dark"
                            ? "bg-brand-500/20 text-brand-300"
                            : "bg-brand-100 text-brand-700"
                          : theme === "dark"
                            ? "text-gray-400 hover:text-gray-200"
                            : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <Grid3X3 size={12} className="inline sm:mr-1" />{" "}
                      <span className="hidden sm:inline">{t.models}</span>
                    </button>
                    <button
                      onClick={() => setTab("charts")}
                      className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        tab === "charts"
                          ? theme === "dark"
                            ? "bg-brand-500/20 text-brand-300"
                            : "bg-brand-100 text-brand-700"
                          : theme === "dark"
                            ? "text-gray-400 hover:text-gray-200"
                            : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <BarChart3 size={12} className="inline sm:mr-1" />{" "}
                      <span className="hidden sm:inline">{t.analytics}</span>
                    </button>
                    <a
                      href="https://inference-api.nousresearch.com/v1/models"
                      target="_blank"
                      rel="noopener"
                      className={`hidden sm:flex px-3 py-1.5 rounded-lg text-xs items-center gap-1 ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      API <ExternalLink size={10} />
                    </a>
                    <button
                      onClick={toggleTheme}
                      className={`p-2 rounded-lg transition-colors ${theme === "dark" ? "text-gray-400 hover:text-yellow-300 hover:bg-yellow-500/10" : "text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"}`}
                      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    >
                      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <button
                      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                      className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${theme === "dark" ? "bg-gray-800/50 text-gray-300 hover:text-white hover:bg-gray-700/50" : "bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200"}`}
                    >
                      <Globe size={12} />
                      {lang === "zh" ? "EN" : "中"}
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${theme === "dark" ? "bg-gray-800/50 text-gray-300 hover:text-white hover:bg-gray-700/50" : "bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200"}`}
                      >
                        <DollarSign size={12} />
                        <span className="hidden sm:inline">
                          {currency === "USD" ? "USD" : `CNY ¥${exchangeRate.toFixed(2)}`}
                        </span>
                        <span className="sm:hidden">{currency === "USD" ? "$" : "¥"}</span>
                        <ChevronDown size={10} />
                      </button>
                      {showCustomInput && (
                        <div
                          className={`absolute right-0 top-full mt-1 rounded-xl shadow-xl border z-50 ${theme === "dark" ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
                        >
                          <div className="p-3 space-y-3">
                            <div>
                              <div
                                className={`text-[10px] mb-2 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                              >
                                {t.currency}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSetCurrency("USD")}
                                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    currency === "USD"
                                      ? theme === "dark"
                                        ? "bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/30"
                                        : "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                                      : theme === "dark"
                                        ? "bg-gray-800 text-gray-400 hover:text-gray-200"
                                        : "bg-gray-100 text-gray-600 hover:text-gray-800"
                                  }`}
                                >
                                  USD
                                </button>
                                <button
                                  onClick={() => handleSetCurrency("CNY")}
                                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    currency === "CNY"
                                      ? theme === "dark"
                                        ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30"
                                        : "bg-rose-100 text-rose-700 ring-1 ring-rose-300"
                                      : theme === "dark"
                                        ? "bg-gray-800 text-gray-400 hover:text-gray-200"
                                        : "bg-gray-100 text-gray-600 hover:text-gray-800"
                                  }`}
                                >
                                  CNY
                                </button>
                              </div>
                            </div>
                            {currency === "CNY" && (
                              <>
                                <div>
                                  <div
                                    className={`text-[10px] mb-1.5 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                                  >
                                    {t.exchangeRate}: 1 USD = ¥{exchangeRate.toFixed(4)}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={fetchExchangeRate}
                                      disabled={rateStatus === "fetching"}
                                      className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                                        rateStatus === "success"
                                          ? "bg-green-500/20 text-green-400"
                                          : rateStatus === "error"
                                            ? "bg-red-500/20 text-red-400"
                                            : theme === "dark"
                                              ? "bg-gray-800 text-gray-400 hover:text-gray-200"
                                              : "bg-gray-100 text-gray-600 hover:text-gray-800"
                                      }`}
                                    >
                                      {rateStatus === "fetching"
                                        ? "..."
                                        : rateStatus === "success"
                                          ? t.rateFetched
                                          : t.fetchRate}
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <div
                                    className={`text-[10px] mb-1.5 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                                  >
                                    {t.customRate}
                                  </div>
                                  <div className="flex gap-2">
                                    <input
                                      type="number"
                                      value={customRate}
                                      onChange={(e) => handleSetCustomRate(e.target.value)}
                                      placeholder={t.enterRate}
                                      step="0.01"
                                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/50 border ${
                                        theme === "dark"
                                          ? "bg-gray-800 text-gray-300 placeholder-gray-600 border-white/10"
                                          : "bg-gray-50 text-gray-700 placeholder-gray-400 border-gray-200"
                                      }`}
                                    />
                                    <button
                                      onClick={handleApplyCustomRate}
                                      className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 transition-colors"
                                    >
                                      {t.apply}
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                <StatCard icon={<Layers size={18} />} label={t.totalModels} value={stats.total} />
                <StatCard icon={<Globe size={18} />} label={t.providers} value={stats.providers} />
                <StatCard
                  icon={<Brain size={18} />}
                  label={t.reasoningModels}
                  value={stats.reasoning}
                />
                <StatCard icon={<Sparkles size={18} />} label={t.freeModels} value={stats.free} />
                <StatCard
                  icon={<Activity size={18} />}
                  label={t.avgIntelligence}
                  value={stats.avgIntelligence}
                />
              </div>

              {tab === "models" ? (
                <>
                  {/* Filters */}
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

                  {/* Selection and export toolbar */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2 ${theme === "dark" ? "border-white/10 bg-gray-900/40" : "border-gray-200 bg-white"}`}
                  >
                    <div
                      className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      {selectedModels.length} {t.selected}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set(filtered.map((model) => model.id)))}
                        className={`px-2 py-1.5 rounded-lg text-[10px] ${theme === "dark" ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {t.selectVisible}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className={`px-2 py-1.5 rounded-lg text-[10px] ${theme === "dark" ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"}`}
                      >
                        {t.clearSelection}
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          disabled={!selectedModels.length}
                          onClick={() => setShowExportMenu(!showExportMenu)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] bg-brand-500/20 text-brand-300 disabled:opacity-40"
                        >
                          <Download size={12} /> {t.export}
                        </button>
                        {showExportMenu && (
                          <div
                            className={`absolute right-0 top-full mt-1 z-20 w-64 rounded-xl border p-2 shadow-xl ${theme === "dark" ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
                          >
                            <div
                              className={`text-[10px] mb-2 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                            >
                              {t.configurationFormat}
                            </div>
                            <select
                              value={exporterId}
                              onChange={(event) => setExporterId(event.target.value)}
                              className={`w-full rounded-lg border px-2 py-1.5 text-xs mb-2 ${theme === "dark" ? "bg-gray-800 border-white/10 text-gray-200" : "bg-gray-50 border-gray-200 text-gray-700"}`}
                            >
                              {exporters.map((exporter) => (
                                <option key={exporter.id} value={exporter.id}>
                                  {exporter.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={openExportPreview}
                              className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${theme === "dark" ? "bg-brand-500/20 border-brand-500/30 text-brand-300 hover:bg-brand-500/30" : "bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100"}`}
                            >
                              <Eye size={12} /> {t.preview}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Results count */}
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

                  {/* Model Grid */}
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
                /* Charts Tab */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <PricingChart models={models} />
                  <BenchmarkScatter models={models} />
                  <ContextChart models={models} />
                  <ProviderPie models={models} />
                </div>
              )}
            </main>

            {/* Export preview modal */}
            {previewPayload && activeExporter && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
                onClick={closeExportPreview}
              >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div
                  className={`relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${theme === "dark" ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}
                  >
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-bold truncate ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                      >
                        {t.exportPreview} · {activeExporter.fileName}
                      </h3>
                      <p
                        className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                      >
                        {selectedModels.length} {t.selected}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeExportPreview}
                      title={t.close}
                      className={`p-1.5 rounded-lg transition-colors ${theme === "dark" ? "text-gray-400 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div
                    className={`flex-1 overflow-auto p-4 min-h-0 ${theme === "dark" ? "bg-gray-950" : "bg-gray-50"}`}
                  >
                    <pre
                      className={`text-[11px] leading-relaxed font-mono whitespace-pre ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                    >
                      {previewPayload}
                    </pre>
                  </div>
                  <div
                    className={`flex items-center justify-end gap-2 px-4 py-3 border-t ${theme === "dark" ? "border-white/10" : "border-gray-200"}`}
                  >
                    <button
                      type="button"
                      onClick={handleCopyExport}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === "dark" ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}{" "}
                      {copied ? t.copied : t.copy}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 transition-colors"
                    >
                      <Download size={12} /> {t.download} {activeExporter.fileName}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <footer
              className={`border-t mt-8 ${theme === "dark" ? "border-white/5" : "border-gray-200"}`}
            >
              <div
                className={`max-w-[1600px] mx-auto px-3 sm:px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`}
              >
                <span>{t.dataFrom}</span>
                <span>{t.builtWith}</span>
              </div>
            </footer>
          </div>
        </CurrencyContext.Provider>
      </LangContext.Provider>
    </ThemeContext.Provider>
  )
}
