import { useSyncExternalStore } from 'react'
import { MESSAGES, type MessageKey } from './messages'

export type Lang = 'it' | 'en' | 'es'
export const LANGS: { code: Lang; label: string; locale: string }[] = [
  { code: 'it', label: 'Italiano', locale: 'it-IT' },
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'es', label: 'Español', locale: 'es-ES' },
]

const KEY = 'capocantiere-lang'
const listeners = new Set<() => void>()

/** Lingua scelta, altrimenti quella del dispositivo (it/es, tutto il resto in inglese). */
export function detectLang(navigatorLang = typeof navigator !== 'undefined' ? navigator.language : 'it'): Lang {
  const base = navigatorLang.toLowerCase().slice(0, 2)
  return base === 'it' ? 'it' : base === 'es' ? 'es' : 'en'
}

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'it' || saved === 'en' || saved === 'es') return saved
  } catch {
    /* archivio non disponibile */
  }
  return detectLang()
}

let current: Lang = initial()
if (typeof document !== 'undefined') document.documentElement.lang = current

export const getLang = (): Lang => current
export const localeOf = (lang: Lang = current): string => LANGS.find((item) => item.code === lang)?.locale ?? 'it-IT'

export function setLang(lang: Lang): void {
  if (lang === current) return
  current = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* si usa solo per questa sessione */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Traduce una chiave: se manca nella lingua scelta ricade sull'italiano (mai una chiave grezza a schermo). */
export function translate(key: MessageKey, vars?: Record<string, string | number>, lang: Lang = current): string {
  const text = MESSAGES[lang][key] ?? MESSAGES.it[key] ?? String(key)
  return vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? '')) : text
}

/** Hook: si aggiorna da solo quando cambia la lingua. */
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const lang = useSyncExternalStore(subscribe, getLang, getLang)
  return (key, vars) => translate(key, vars, lang)
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}

/** Istruzione di lingua da aggiungere ai prompt dell'AI (vuota in italiano, che è la lingua dei prompt). */
export function aiLanguageRule(lang: Lang = current): string {
  if (lang === 'en') return 'LANGUAGE: write every human-readable text of your answer in English (keep the metric units as given). Keep JSON keys, ids and fixed values such as bassa|media|alta|critica|congruo|basso|alto|si|no|ns exactly as specified.'
  if (lang === 'es') return 'IDIOMA: escribe todos los textos legibles de tu respuesta en español (de España). Mantén exactamente las claves JSON, los identificadores y los valores fijos como bassa|media|alta|critica|congruo|basso|alto|si|no|ns.'
  return ''
}
