import { round2 } from './number'

/** Resa tipica idropittura traspirante per interni, per mano. Intervallo spesso pubblicato: 10–12 m²/L. */
export const PAINT_COVERAGE_M2_PER_L = 11

/** Resa tipica fissativo / primer acrilico per interni. Intervallo spesso pubblicato: circa 10–14 m²/L. */
export const PRIMER_COVERAGE_M2_PER_L = 12

export function paintableSurface(wallsM2: number, ceilingM2: number, ceilingIncluded: boolean): number {
  const walls = Math.max(0, wallsM2)
  const ceiling = ceilingIncluded ? Math.max(0, ceilingM2) : 0
  return round2(walls + ceiling)
}

/**
 * litri = superficie × mani / resa × (1 + sfrido)
 * Lo sfrido è una frazione (0.10 = 10%).
 */
export function litersForCoats(
  surfaceM2: number,
  coats: number,
  coverageM2PerL: number,
  wasteFraction: number,
): number {
  if (coverageM2PerL <= 0 || surfaceM2 <= 0 || coats <= 0) return 0
  const waste = wasteFraction > 0 ? wasteFraction : 0
  return (surfaceM2 * coats) / coverageM2PerL * (1 + waste)
}

export function primerLiters(surfaceM2: number, coverageM2PerL: number, wasteFraction: number): number {
  return litersForCoats(surfaceM2, 1, coverageM2PerL, wasteFraction)
}

export interface PaintConsumables {
  rollers: number
  brushes: number
  tapeRolls: number
  dropCloths: number
  sandpaperSheets: number
}

/** Quantità pratiche di cantiere, non rese di scheda. */
export function paintConsumables(surfaceM2: number): PaintConsumables {
  const surface = Math.max(0, surfaceM2)
  return {
    rollers: Math.max(1, Math.ceil(surface / 50)),
    brushes: surface > 40 ? 2 : 1,
    tapeRolls: Math.max(1, Math.ceil(surface / 30)),
    dropCloths: Math.max(1, Math.ceil(surface / 25)),
    sandpaperSheets: Math.max(3, Math.ceil(surface / 15)),
  }
}

/**
 * Ore di una persona a ritmo ordinario.
 * Preparazione 25 m²/h, primer 16 m²/h, pittura 12 m²/h per mano.
 */
export function paintLaborHours(surfaceM2: number, coats: number, primer: boolean): number {
  if (surfaceM2 <= 0 || coats <= 0) return 0
  const prep = surfaceM2 / 25
  const primerH = primer ? surfaceM2 / 16 : 0
  const paintH = (surfaceM2 * coats) / 12
  return prep + primerH + paintH
}
