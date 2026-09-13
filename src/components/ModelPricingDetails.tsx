import { Clock, Layers, DollarSign } from "lucide-react"
import type { Model } from "../types"
import { useLang } from "../i18n"
import { useTheme, useCurrency } from "../contexts"
import { DetailBox } from "./DetailBox"
import { bn, formatPrice, formatCtx, stripZeros, currencyUnit } from "../utils"

type PricingOverride = NonNullable<Model["pricing"]["overrides"]>[number]

function OverridePrices({ override }: { override: PricingOverride }) {
  const { lang, t } = useLang()
  const { theme } = useTheme()
  const { currency, exchangeRate } = useCurrency()
  const isDark = theme === "dark"
  const price = (label: string, val: string, darkColor: string, lightColor: string) => (
    <span className={isDark ? darkColor : lightColor}>
      {label}: {formatPrice(val, lang, currency, exchangeRate)}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {override.prompt && price(t.prompt, override.prompt, "text-emerald-400", "text-emerald-600")}
      {override.completion &&
        price(t.completion, override.completion, "text-sky-400", "text-sky-600")}
      {override.input_cache_read &&
        price(t.cacheRead, override.input_cache_read, "text-violet-400", "text-violet-600")}
    </div>
  )
}

export function ModelPricingDetails({ model }: { model: Model }) {
  const { lang, t } = useLang()
  const { theme } = useTheme()
  const { currency, exchangeRate } = useCurrency()
  const isDark = theme === "dark"

  const pricingItems: Array<{
    key: string
    label: string
    colorDark: string
    colorLight: string
    per1k?: boolean
  }> = [
    {
      key: "prompt",
      label: t.prompt,
      colorDark: "text-emerald-400",
      colorLight: "text-emerald-600"
    },
    {
      key: "completion",
      label: t.completion,
      colorDark: "text-sky-400",
      colorLight: "text-sky-600"
    },
    {
      key: "input_cache_read",
      label: t.cacheRead,
      colorDark: "text-violet-400",
      colorLight: "text-violet-600"
    },
    {
      key: "input_cache_write",
      label: t.cacheWrite,
      colorDark: "text-violet-400",
      colorLight: "text-violet-600"
    },
    {
      key: "input_cache_write_1h",
      label: t.cacheWrite1h,
      colorDark: "text-purple-400",
      colorLight: "text-purple-600"
    },
    {
      key: "web_search",
      label: t.webSearch,
      colorDark: "text-amber-400",
      colorLight: "text-amber-600",
      per1k: true
    },
    {
      key: "image",
      label: t.image,
      colorDark: "text-purple-400",
      colorLight: "text-purple-600"
    },
    {
      key: "audio",
      label: t.audio,
      colorDark: "text-orange-400",
      colorLight: "text-orange-600"
    },
    {
      key: "internal_reasoning",
      label: t.reasoningPrice,
      colorDark: "text-rose-400",
      colorLight: "text-rose-600"
    }
  ]
  const p = model.pricing as unknown as Record<string, string | undefined>
  const orig = model.pricing.original as unknown as Record<string, string | undefined> | undefined
  const active = pricingItems.filter((item) => p[item.key])

  const formatPer1k = (val: string) =>
    currency === "CNY"
      ? `¥${stripZeros(bn(val).times(1000).times(exchangeRate).toFixed(4))}/1K`
      : `$${stripZeros(bn(val).times(1000).toFixed(4))}/1K`
  const priceFor = (val: string | undefined, per1k?: boolean) =>
    val == null ? null : per1k ? formatPer1k(val) : formatPrice(val, lang, currency, exchangeRate)

  const timeOverrides = (model.pricing.overrides ?? []).filter((o) => o.utc_days)
  const tokenOverrides = (model.pricing.overrides ?? []).filter((o) => o.min_prompt_tokens != null)

  return (
    <div>
      <h4
        className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDark ? "text-gray-300" : "text-gray-600"}`}
      >
        <DollarSign size={12} /> {t.pricingDetails}
        <span className={`text-[10px] font-normal ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          ({currencyUnit(lang, currency)})
        </span>
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {active.map((item) => {
          const current = priceFor(p[item.key], item.per1k)
          const original = orig?.[item.key] ? priceFor(orig[item.key], item.per1k) : null
          return (
            <DetailBox key={item.key}>
              <div className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                {item.label}
              </div>
              <div className={`text-xs font-medium ${isDark ? item.colorDark : item.colorLight}`}>
                {current}
              </div>
              {original && (
                <div
                  className={`text-[10px] line-through ${isDark ? "text-gray-500" : "text-gray-400"}`}
                >
                  {original}
                </div>
              )}
            </DetailBox>
          )
        })}
      </div>

      {model.pricing.overrides && model.pricing.overrides.length > 0 && (
        <div className="mt-2 space-y-2">
          {timeOverrides.length > 0 && (
            <div>
              <div
                className={`text-[10px] mb-1.5 flex items-center gap-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
              >
                <Clock size={10} /> {t.peakPricing}
              </div>
              <div className="space-y-1.5">
                {timeOverrides.map((o, i) => {
                  const days =
                    o.utc_days
                      ?.map((d) =>
                        lang === "zh"
                          ? ({
                              monday: "周一",
                              tuesday: "周二",
                              wednesday: "周三",
                              thursday: "周四",
                              friday: "周五",
                              saturday: "周六",
                              sunday: "周日"
                            }[d] ?? d)
                          : d.slice(0, 3)
                      )
                      .join(", ") ?? ""
                  const timeRange =
                    o.utc_start != null && o.utc_end != null
                      ? `${String(o.utc_start).padStart(2, "0")}:00–${String(o.utc_end).padStart(2, "0")}:00 UTC`
                      : ""
                  const isWeekend = o.utc_days?.every((d) => d === "saturday" || d === "sunday")
                  return (
                    <DetailBox key={i} className="text-[11px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] ${isWeekend ? (isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700") : isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-700"}`}
                        >
                          {isWeekend ? t.weekend : t.weekday}
                        </span>
                        <span className={isDark ? "text-gray-400" : "text-gray-500"}>{days}</span>
                        {timeRange && (
                          <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                            {timeRange}
                          </span>
                        )}
                      </div>
                      <OverridePrices override={o} />
                    </DetailBox>
                  )
                })}
              </div>
            </div>
          )}
          {tokenOverrides.length > 0 && (
            <div>
              <div
                className={`text-[10px] mb-1.5 flex items-center gap-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
              >
                <Layers size={10} /> {t.tieredPricing}
              </div>
              <div className="space-y-1.5">
                {tokenOverrides.map((o, i) => (
                  <DetailBox key={i} className="text-[11px]">
                    <div className="mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] ${isDark ? "bg-teal-500/20 text-teal-300" : "bg-teal-100 text-teal-700"}`}
                      >
                        ≥{formatCtx(o.min_prompt_tokens!)} {t.aboveTokens}
                      </span>
                    </div>
                    <OverridePrices override={o} />
                  </DetailBox>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
