export function areaWithWaste(areaM2: number, wastePercent: number): number {
  if (areaM2 <= 0) return 0
  const waste = wastePercent > 0 ? wastePercent / 100 : 0
  return areaM2 * (1 + waste)
}

export function tileAreaM2(widthCm: number, heightCm: number): number {
  if (widthCm <= 0 || heightCm <= 0) return 0
  return (widthCm / 100) * (heightCm / 100)
}

export function tileCount(areaM2: number, widthCm: number, heightCm: number, wastePercent: number): number {
  const tile = tileAreaM2(widthCm, heightCm)
  if (tile <= 0) return 0
  const need = areaWithWaste(areaM2, wastePercent)
  return Math.ceil(need / tile - 1e-9)
}

/**
 * Regola pratica dello stucco cementizio:
 * kg/m² = ((A+B)/(A×B)) × C × D × 1,5
 * A e B lati piastrella in mm, C larghezza fuga in mm, D spessore piastrella in mm.
 */
export function groutKgPerM2(
  sideAmm: number,
  sideBmm: number,
  jointMm: number,
  thicknessMm: number,
  factor = 1.5,
): number {
  if (sideAmm <= 0 || sideBmm <= 0 || jointMm <= 0 || thicknessMm <= 0) return 0
  return ((sideAmm + sideBmm) / (sideAmm * sideBmm)) * jointMm * thicknessMm * factor
}

export function groutKg(
  areaM2: number,
  widthCm: number,
  heightCm: number,
  jointMm: number,
  thicknessMm: number,
  wasteFraction: number,
): number {
  const per = groutKgPerM2(widthCm * 10, heightCm * 10, jointMm, thicknessMm)
  const waste = wasteFraction > 0 ? wasteFraction : 0
  return per * Math.max(0, areaM2) * (1 + waste)
}

/** Collante cementizio C2, spatola da 10 mm: spesso circa 4–5 kg/m². */
export const ADHESIVE_KG_PER_M2 = 4.5

export function adhesiveKg(areaM2: number, kgPerM2: number, wasteFraction: number): number {
  if (areaM2 <= 0 || kgPerM2 <= 0) return 0
  const waste = wasteFraction > 0 ? wasteFraction : 0
  return areaM2 * kgPerM2 * (1 + waste)
}

export function flooringLaborHours(areaM2: number): number {
  if (areaM2 <= 0) return 0
  return areaM2 / 4 + 1.2
}
