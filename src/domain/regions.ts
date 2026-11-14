import type { TradeId } from './types'

export type RegionCode = 'IT' | 'NL' | 'DE' | 'ES' | 'BE'
export type PriceMap = Record<string, number>

export interface Region {
  code: RegionCode
  names: { it: string; en: string; es: string }
  /** IVA / BTW / MwSt ordinaria. */
  vat: number
  flag: string
  /** Fonti consultate per le tariffe orarie (indagini di mercato, non listini ufficiali). */
  sources: string[]
  updated: string
}

export const REGIONS: Region[] = [
  {
    code: 'IT', names: { it: 'Italia', en: 'Italy', es: 'Italia' }, vat: 22, flag: '🇮🇹', updated: '2026-11',
    sources: ['Cronoshare / ProntoPro (tariffe artigiani 2024–2026)', 'CGIA Mestre (differenze territoriali)'],
  },
  {
    code: 'NL', names: { it: 'Paesi Bassi', en: 'Netherlands', es: 'Países Bajos' }, vat: 21, flag: '🇳🇱', updated: '2026-11',
    sources: ['Knab – uurtarieven zzp in de bouw 2026 (indagine su oltre 20.000 autonomi)', 'Homedeal prijsgidsen'],
  },
  {
    code: 'DE', names: { it: 'Germania', en: 'Germany', es: 'Alemania' }, vat: 19, flag: '🇩🇪', updated: '2026-11',
    sources: ['clean-invoice.com – Handwerker Stundenlohn 2026', 'my-hammer.de / sanier.de – Handwerkerpreise'],
  },
  {
    code: 'ES', names: { it: 'Spagna', en: 'Spain', es: 'España' }, vat: 21, flag: '🇪🇸', updated: '2026-11',
    sources: ['Trustlocal / Habitissimo / Cronoshare – precios por hora 2026'],
  },
  {
    code: 'BE', names: { it: 'Belgio', en: 'Belgium', es: 'Bélgica' }, vat: 21, flag: '🇧🇪', updated: '2026-11',
    sources: ['Trustup.be – tariffe orarie elettricista, pittore, idraulico 2026 (HTVA)'],
  },
]

export const REGION_CODES = REGIONS.map((region) => region.code)
export const regionOf = (code: string): Region => REGIONS.find((region) => region.code === code) ?? REGIONS[0]

/** Tariffe orarie medie di un artigiano/piccola impresa, IVA esclusa, in euro. Punto medio delle fasce trovate nelle fonti. */
const LABOR: Record<RegionCode, Record<TradeId, number>> = {
  IT: { idraulica: 40, elettrica: 40, muratura: 30, cartongesso: 32, pittura: 28, pavimentazione: 33, impermeabilizzazione: 35, tetti: 38, giardino: 25, climatizzazione: 45, falegnameria: 32, manutenzione: 30 },
  NL: { idraulica: 57, elettrica: 56, muratura: 55, cartongesso: 52, pittura: 45, pavimentazione: 52, impermeabilizzazione: 55, tetti: 58, giardino: 40, climatizzazione: 62, falegnameria: 52, manutenzione: 50 },
  DE: { idraulica: 75, elettrica: 70, muratura: 58, cartongesso: 55, pittura: 50, pavimentazione: 62, impermeabilizzazione: 62, tetti: 65, giardino: 45, climatizzazione: 80, falegnameria: 60, manutenzione: 55 },
  ES: { idraulica: 32, elettrica: 30, muratura: 25, cartongesso: 26, pittura: 22, pavimentazione: 26, impermeabilizzazione: 28, tetti: 30, giardino: 20, climatizzazione: 38, falegnameria: 26, manutenzione: 24 },
  BE: { idraulica: 55, elettrica: 50, muratura: 48, cartongesso: 45, pittura: 42, pavimentazione: 46, impermeabilizzazione: 48, tetti: 52, giardino: 38, climatizzazione: 58, falegnameria: 46, manutenzione: 44 },
}

/**
 * Materiali: parte dal listino al dettaglio italiano (base) e applica il livello medio di prezzo del paese
 * (grande distribuzione fai-da-te: Leroy Merlin / Brico, Gamma / Praxis, Hornbach / Bauhaus), con correzioni per le voci
 * che si discostano. Sono medie indicative: per prezzi precisi usa il listino del tuo fornitore.
 */
const LEVEL: Record<RegionCode, number> = { IT: 1, NL: 1.12, DE: 1.06, ES: 0.9, BE: 1.1 }
const MATERIAL_OVERRIDES: Record<RegionCode, PriceMap> = {
  IT: {},
  NL: { tilePerM2: 29, board: 11.5, soilPerM3: 58, adhesivePerKg: 0.55, tileRoof: 2.2, gutterPerM: 14 },
  DE: { tilePerM2: 26, board: 8.9, adhesivePerKg: 0.5, paintPerL: 8.9, soilPerM3: 52, jointCompoundPerKg: 0.95 },
  ES: { tilePerM2: 17, board: 7.5, adhesivePerKg: 0.36, paintPerL: 7.2, soilPerM3: 38, tileRoof: 1.3, mortarPerKg: 0.24 },
  BE: { tilePerM2: 28, board: 11, soilPerM3: 56, adhesivePerKg: 0.54, gutterPerM: 14, paintPerL: 11.5 },
}

const round = (value: number) => Math.round(value * 100) / 100

/** Listino predefinito del paese: tutte le chiavi dei materiali più le tariffe `labor.*`. */
export function regionBook(code: RegionCode, baseMaterials: PriceMap, baseLabor: PriceMap): PriceMap {
  const out: PriceMap = {}
  for (const [key, value] of Object.entries(baseMaterials)) {
    out[key] = MATERIAL_OVERRIDES[code][key] ?? round(value * LEVEL[code])
  }
  for (const trade of Object.keys(baseLabor)) out[`labor.${trade}`] = LABOR[code][trade as TradeId] ?? baseLabor[trade]
  return out
}

/** Paese suggerito dalla lingua/area del dispositivo (es. "nl-BE" → Belgio); Italia se sconosciuto. */
export function detectRegion(locale = typeof navigator !== 'undefined' ? navigator.language : 'it'): RegionCode {
  const [lang, area = ''] = locale.toUpperCase().split(/[-_]/)
  if ((REGION_CODES as string[]).includes(area)) return area as RegionCode
  if (lang === 'NL') return 'NL'
  if (lang === 'DE') return 'DE'
  if (lang === 'ES') return 'ES'
  return 'IT'
}
