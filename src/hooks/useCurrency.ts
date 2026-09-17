import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Currency } from "../types"
import type { RateStatus } from "../contexts"

export function useCurrencyState() {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem("currency")
    return saved === "CNY" ? "CNY" : "USD"
  })
  const [exchangeRate, setExchangeRateState] = useState<number>(() => {
    const saved = localStorage.getItem("exchangeRate")
    const parsed = saved ? Number.parseFloat(saved) : Number.NaN
    // a corrupt or non-positive stored rate would render every price as NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 7.25
  })
  const [customRate, setCustomRateState] = useState<string>(() => {
    const saved = localStorage.getItem("customRate")
    return saved ?? ""
  })
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false)
  const [rateStatus, setRateStatus] = useState<RateStatus>("idle")
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current)
    },
    []
  )

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c)
    localStorage.setItem("currency", c)
  }, [])
  const setExchangeRate = useCallback((r: number) => {
    setExchangeRateState(r)
    localStorage.setItem("exchangeRate", r.toString())
  }, [])
  const setCustomRate = useCallback((r: string) => {
    setCustomRateState(r)
    localStorage.setItem("customRate", r)
  }, [])

  const fetchExchangeRate = useCallback(async () => {
    setRateStatus("fetching")
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      if (data.rates?.CNY) {
        setExchangeRate(data.rates.CNY)
        setCustomRate(data.rates.CNY.toString())
        setRateStatus("success")
      } else {
        throw new Error("CNY rate not found")
      }
    } catch {
      setRateStatus("error")
    }
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setRateStatus("idle"), 2000)
  }, [setExchangeRate, setCustomRate])

  return useMemo(
    () => ({
      currency,
      setCurrency,
      exchangeRate,
      setExchangeRate,
      customRate,
      setCustomRate,
      showCustomInput,
      setShowCustomInput,
      rateStatus,
      fetchExchangeRate
    }),
    [
      currency,
      setCurrency,
      exchangeRate,
      setExchangeRate,
      customRate,
      setCustomRate,
      showCustomInput,
      rateStatus,
      fetchExchangeRate
    ]
  )
}
