import { createContext, useContext } from "react"
import type { Lang } from "./types"
import { translations } from "./translations"

type Translations = typeof translations.zh

export const LangContext = createContext<{
  lang: Lang
  t: Translations
  setLang: (l: Lang) => void
}>({
  lang: "zh",
  t: translations.zh,
  setLang: () => {}
})

export function useLang() {
  return useContext(LangContext)
}
