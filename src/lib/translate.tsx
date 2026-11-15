import { useSyncExternalStore } from 'react'
import { api } from './http'
import { getLang, useLang, type Lang } from './i18n'

/**
 * Traduzione dei testi fissi e generati dal motore (mestieri, campi, guide, materiali, preventivi) dall'italiano.
 * Il server traduce una volta sola e conserva il risultato per tutti; qui c'è una copia sul dispositivo.
 * Finché la traduzione non arriva (o senza rete) si mostra l'italiano: mai un testo vuoto o inventato.
 */
type Target = Exclude<Lang, 'it'>

const STORE = 'capocantiere-tx-v1-'
const MAX_ENTRIES = 4000
const MAX_CHARS = 1200
const memory: Record<Target, Map<string, string>> = { en: new Map(), es: new Map() }
const queue: Record<Target, Set<string>> = { en: new Set(), es: new Set() }
const retryAt = new Map<string, number>()
const loaded: Record<Target, boolean> = { en: false, es: false }
const listeners = new Set<() => void>()
let version = 0
let timer: ReturnType<typeof setTimeout> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

function loadFromDevice(lang: Target): void {
  if (loaded[lang]) return
  loaded[lang] = true
  try {
    const raw = JSON.parse(localStorage.getItem(STORE + lang) ?? '{}') as Record<string, string>
    for (const [source, out] of Object.entries(raw)) if (typeof out === 'string') memory[lang].set(source, out)
  } catch {
    /* nessuna copia sul dispositivo */
  }
}

function saveToDevice(lang: Target): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const entries = [...memory[lang].entries()].slice(-MAX_ENTRIES)
      localStorage.setItem(STORE + lang, JSON.stringify(Object.fromEntries(entries)))
    } catch {
      /* spazio esaurito: si lavora solo in memoria */
    }
  }, 500)
}

const notify = () => {
  version += 1
  listeners.forEach((listener) => listener())
}

async function flush(): Promise<void> {
  timer = null
  for (const lang of ['en', 'es'] as const) {
    const texts = [...queue[lang]].slice(0, 60)
    if (!texts.length) continue
    texts.forEach((text) => queue[lang].delete(text))
    try {
      const { translations } = await api<{ translations: Record<string, string> }>('/api/translate', { method: 'POST', body: { lang, texts } })
      for (const text of texts) {
        const out = translations[text]
        if (typeof out === 'string' && out.trim()) memory[lang].set(text, out)
        else retryAt.set(`${lang}|${text}`, Date.now() + 10 * 60_000) // l'AI non l'ha restituita: si riprova più tardi
      }
      saveToDevice(lang)
    } catch {
      // Rete o servizio AI non disponibili: si resta in italiano e si riprova dopo un po'.
      for (const text of texts) retryAt.set(`${lang}|${text}`, Date.now() + 60_000)
    }
    notify()
  }
  if (queue.en.size || queue.es.size) schedule()
}

function schedule(): void {
  if (timer || typeof window === 'undefined') return
  timer = setTimeout(() => void flush(), 80)
}

/** Traduce un testo italiano nella lingua scelta. Subito: copia già nota oppure l'originale (e la richiesta parte in coda). */
export function tx(text: string, lang: Lang = getLang()): string {
  if (lang === 'it' || !text || !/\p{L}/u.test(text)) return text
  loadFromDevice(lang)
  const hit = memory[lang].get(text)
  if (hit !== undefined) return hit
  if (text.length > MAX_CHARS) return text
  const wait = retryAt.get(`${lang}|${text}`)
  if (wait && wait > Date.now()) return text
  queue[lang].add(text)
  schedule()
  return text
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Hook: ritorna `tx` e fa ridisegnare il componente quando arrivano nuove traduzioni o cambia la lingua. */
export function useTx(): (text: string) => string {
  useLang()
  useSyncExternalStore(subscribe, () => version, () => version)
  return (text) => tx(text)
}

/** Testo da tradurre in JSX: `<Tx>Materiali e costi</Tx>`. Non aggiunge elementi alla pagina. */
export function Tx({ children }: { children: string }) {
  const t = useTx()
  return <>{t(children)}</>
}

/** Solo per i test: svuota le copie in memoria. */
export function resetTranslationsForTests(): void {
  for (const lang of ['en', 'es'] as const) {
    memory[lang].clear()
    queue[lang].clear()
    loaded[lang] = false
  }
  retryAt.clear()
}
