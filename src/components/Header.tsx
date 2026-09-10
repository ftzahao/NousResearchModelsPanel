import {
  Grid3X3,
  BarChart3,
  ExternalLink,
  Sun,
  Moon,
  Globe,
  DollarSign,
  ChevronDown,
  Cpu
} from "lucide-react"
import { useTheme, useCurrency } from "../contexts"
import { useLang } from "../i18n"

export type Tab = "models" | "charts"

export function Header({ tab, onTabChange }: { tab: Tab; onTabChange: (tab: Tab) => void }) {
  const { theme, toggleTheme } = useTheme()
  const { lang, t, setLang } = useLang()
  const {
    currency,
    setCurrency,
    exchangeRate,
    customRate,
    setCustomRate,
    setExchangeRate,
    showCustomInput,
    setShowCustomInput,
    rateStatus,
    fetchExchangeRate
  } = useCurrency()

  const handleApplyCustomRate = () => {
    const rate = parseFloat(customRate)
    if (!isNaN(rate) && rate > 0) {
      setExchangeRate(rate)
      setShowCustomInput(false)
    }
  }

  return (
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
              onClick={() => onTabChange("models")}
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
              onClick={() => onTabChange("charts")}
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
                          onClick={() => setCurrency("USD")}
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
                          onClick={() => setCurrency("CNY")}
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
                              onChange={(e) => setCustomRate(e.target.value)}
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
  )
}
