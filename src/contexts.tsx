import { createContext, useContext } from "react"
import type { Theme, Currency } from "./types"

export const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {}
})

export function useTheme() {
  return useContext(ThemeContext)
}

export type RateStatus = "idle" | "fetching" | "success" | "error"

export const CurrencyContext = createContext<{
  currency: Currency
  setCurrency: (c: Currency) => void
  exchangeRate: number
  setExchangeRate: (r: number) => void
  customRate: string
  setCustomRate: (r: string) => void
  showCustomInput: boolean
  setShowCustomInput: (v: boolean) => void
  rateStatus: RateStatus
  fetchExchangeRate: () => Promise<void>
}>({
  currency: "USD",
  setCurrency: () => {},
  exchangeRate: 7.25,
  setExchangeRate: () => {},
  customRate: "",
  setCustomRate: () => {},
  showCustomInput: false,
  setShowCustomInput: () => {},
  rateStatus: "idle",
  fetchExchangeRate: async () => {}
})

export function useCurrency() {
  return useContext(CurrencyContext)
}
