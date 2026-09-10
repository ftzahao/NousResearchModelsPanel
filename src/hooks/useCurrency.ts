import { useState } from "react"
import type { Currency } from "../types"
import type { RateStatus } from "../contexts"

export function useCurrencyState() {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem("currency") as Currency | null
    return saved === "CNY" ? "CNY" : "USD"
  })
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = localStorage.getItem("exchangeRate")
    return saved ? parseFloat(saved) : 7.25
  })
  const [customRate, setCustomRateState] = useState<string>(() => {
    const saved = localStorage.getItem("customRate")
    return saved ?? ""
  })
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false)
  const [rateStatus, setRateStatus] = useState<RateStatus>("idle")

  const setCurrency = (c: Currency) => {
    setCurrencyState(c)
    localStorage.setItem("currency", c)
  }
  const handleSetExchangeRate = (r: number) => {
    setExchangeRate(r)
    localStorage.setItem("exchangeRate", r.toString())
  }
  const setCustomRate = (r: string) => {
    setCustomRateState(r)
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
        setCustomRate(data.rates.CNY.toString())
        setRateStatus("success")
      } else {
        throw new Error("CNY rate not found")
      }
    } catch {
      setRateStatus("error")
    }
    setTimeout(() => setRateStatus("idle"), 2000)
  }

  return {
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate: handleSetExchangeRate,
    customRate,
    setCustomRate,
    showCustomInput,
    setShowCustomInput,
    rateStatus,
    fetchExchangeRate
  }
}
