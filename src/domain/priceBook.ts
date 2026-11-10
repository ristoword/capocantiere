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
