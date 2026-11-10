/**
 * Membrane cementizie bicomponenti elastiche: ordine di grandezza spesso pubblicato
 * circa 1,5–1,8 kg/m² per mm. Usiamo 1,6. Due mani per circa 2 mm → circa 3,2 kg/m².
 */
export const MEMBRANE_KG_PER_M2_PER_MM = 1.6
export const MEMBRANE_THICKNESS_MM = 2

/** Primer per fondi cementizi, ordine di grandezza 0,1–0,3 kg/m². */
export const TERRACE_PRIMER_KG_PER_M2 = 0.15

export function membraneKg(
  areaM2: number,
  thicknessMm: number,
  kgPerM2PerMm: number,
  wasteFraction: number,
): number {
  if (areaM2 <= 0 || thicknessMm <= 0 || kgPerM2PerMm <= 0) return 0
  const waste = wasteFraction > 0 ? wasteFraction : 0
  return areaM2 * thicknessMm * kgPerM2PerMm * (1 + waste)
}

export function terracePrimerKg(areaM2: number, kgPerM2: number, wasteFraction: number): number {
  if (areaM2 <= 0 || kgPerM2 <= 0) return 0
  const waste = wasteFraction > 0 ? wasteFraction : 0
  return areaM2 * kgPerM2 * (1 + waste)
}

/** Perimetro maggiorato per sormonti, più un tratto per ogni scarico. */
export function cornerBandMeters(perimeterM: number, drains: number): number {
  const perimeter = Math.max(0, perimeterM)
  const n = Math.max(0, drains)
  return perimeter * 1.1 + n * 1.2
}

export function terraceLaborHours(areaM2: number, drains: number, withFloor: boolean): number {
  if (areaM2 <= 0) return Math.max(0, drains) * 0.4
  const prep = areaM2 / 6
  const slope = areaM2 / 5
  const membrane = areaM2 / 4
  const details = Math.max(0, drains) * 0.4 + 0.6
  const floor = withFloor ? areaM2 / 3.5 : 0
  return prep + slope + membrane + details + floor
}
