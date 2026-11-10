import { PRICE } from './pricing'

export type PriceMap = Record<string, number>

const DEFAULTS: PriceMap = {}
const DEFAULT_LABOR: PriceMap = {}
for (const [key, value] of Object.entries(PRICE)) if (typeof value === 'number') DEFAULTS[key] = value
for (const [key, value] of Object.entries(PRICE.laborRate)) DEFAULT_LABOR[key] = value

export const MATERIAL_LABELS: Record<string, [string, string]> = {
  paintPerL: ['Pittura', '€/L'], primerPerL: ['Fissativo / primer', '€/L'], roller: ['Rullo', '€/pz'], brush: ['Pennello', '€/pz'],
  tape: ['Nastro carta', '€/rotolo'], cloth: ['Telo coprente', '€/pz'], sandpaper: ['Carta abrasiva', '€/foglio'], fillerKg: ['Stucco', '€/kg'],
  membranePerKg: ['Guaina liquida', '€/kg'], terracePrimerPerKg: ['Primer terrazzo', '€/kg'], bandPerM: ['Banda sigillante', '€/m'], drainKit: ['Kit scarico', '€/kit'],
  tilePerM2: ['Piastrelle', '€/m²'], adhesivePerKg: ['Colla per piastrelle', '€/kg'], groutPerKg: ['Fugante', '€/kg'], spacerBag: ['Distanziatori', '€/busta'],
  silicone: ['Silicone', '€/cartuccia'], board: ['Lastra cartongesso', '€/lastra'], stud: ['Montante', '€/pz'], track: ['Guida', '€/pz'],
  hanger: ['Gancio / pendino', '€/pz'], screwsBox: ['Viti (scatola)', '€/scatola'], jointCompoundPerKg: ['Stucco per giunti', '€/kg'], jointTapePerM: ['Nastro giunti', '€/m'],
  ptfe: ['Teflon', '€/rotolo'], gasket: ['Guarnizione', '€/pz'], trap: ['Sifone', '€/pz'], hose: ['Flessibile', '€/pz'], faucetBody: ['Rubinetteria', '€/pz'],
  mortarPerKg: ['Malta', '€/kg'], tileRoof: ['Tegola', '€/pz'], gutterPerM: ['Grondaia', '€/m'], gutterHanger: ['Staffa grondaia', '€/pz'],
  seedPerKg: ['Semi prato', '€/kg'], soilPerM3: ['Terriccio', '€/m³'], dripPerM: ['Ala gocciolante', '€/m'], bracket: ['Staffa / mensola', '€/pz'],
  trunkingPerM: ['Canalina', '€/m'], hinge: ['Cerniera', '€/pz'], screwBoxSmall: ['Viti piccole', '€/scatola'], sheetSand: ['Foglio abrasivo', '€/pz'],
  lamp: ['Lampadina', '€/pz'], neutralSilicone: ['Silicone neutro', '€/cartuccia'],
}

export const LABOR_LABELS: Record<string, string> = {
  idraulica: 'Idraulico', elettrica: 'Elettricista', muratura: 'Muratore', cartongesso: 'Cartongessista', pittura: 'Imbianchino',
  pavimentazione: 'Posatore', impermeabilizzazione: 'Impermeabilizzazione', tetti: 'Tetti e coperture', giardino: 'Giardinaggio',
  climatizzazione: 'Climatizzazione', falegnameria: 'Falegname', manutenzione: 'Manutenzione',
}

export const defaultMaterialPrice = (key: string): number => DEFAULTS[key] ?? 0
export const defaultLaborRate = (key: string): number => DEFAULT_LABOR[key] ?? 0

/** Applica i prezzi personali al listino usato dai calcoli (riparte sempre dai valori predefiniti). */
export function applyPriceBook(overrides: PriceMap): void {
  const target = PRICE as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(DEFAULTS)) target[key] = value
  for (const [key, value] of Object.entries(DEFAULT_LABOR)) (PRICE.laborRate as Record<string, number>)[key] = value
  for (const [key, value] of Object.entries(overrides)) {
    if (!(Number.isFinite(value) && value >= 0 && value < 100000)) continue
    if (key.startsWith('labor.')) {
      const trade = key.slice(6)
      if (trade in DEFAULT_LABOR) (PRICE.laborRate as Record<string, number>)[trade] = value
    } else if (key in DEFAULTS) {
      target[key] = value
    }
  }
}

const norm = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim()

function lookupKey(name: string): string | null {
  const wanted = norm(name)
  if (!wanted) return null
  for (const key of Object.keys(DEFAULTS)) if (norm(key) === wanted) return key
  for (const trade of Object.keys(DEFAULT_LABOR)) if (norm(`labor.${trade}`) === wanted) return `labor.${trade}`
  for (const [key, [label]] of Object.entries(MATERIAL_LABELS)) if (norm(label) === wanted) return key
  for (const [trade, label] of Object.entries(LABOR_LABELS)) if (norm(label) === wanted || norm(`tariffa ${label}`) === wanted) return `labor.${trade}`
  return null
}

/** Legge un CSV "nome;prezzo" (o con virgola/tabulazione) con nomi di materiali o chiavi del listino. */
export function parsePriceCsv(text: string): { prices: PriceMap; unknown: string[]; invalid: string[] } {
  const prices: PriceMap = {}
  const unknown: string[] = []
  const invalid: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.includes(';') ? line.split(';') : line.includes('\t') ? line.split('\t') : line.split(/,(?=[^,]*$)/)
    if (parts.length < 2) continue
    const name = parts[0].replace(/^"|"$/g, '').trim()
    const price = Number(parts[1].replace(/[€\s"]/g, '').replace(',', '.'))
    if (norm(name) === 'nome' || norm(name) === 'chiave') continue // intestazione
    const key = lookupKey(name)
    if (!key) {
      unknown.push(name)
      continue
    }
    if (!Number.isFinite(price) || price < 0 || price >= 100000) {
      invalid.push(name)
      continue
    }
    prices[key] = price
  }
  return { prices, unknown, invalid }
}

/** Modello CSV da scaricare, precompilato con i prezzi in uso. */
export function priceCsvTemplate(current: PriceMap): string {
  const rows = ['nome;prezzo']
  for (const [trade, label] of Object.entries(LABOR_LABELS)) {
    rows.push(`Tariffa ${label};${String(current[`labor.${trade}`] ?? DEFAULT_LABOR[trade]).replace('.', ',')}`)
  }
  for (const [key, [label]] of Object.entries(MATERIAL_LABELS)) {
    rows.push(`${label};${String(current[key] ?? DEFAULTS[key]).replace('.', ',')}`)
  }
  return rows.join('\n')
}
