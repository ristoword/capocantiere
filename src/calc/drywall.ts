export const BOARD_AREA_M2 = 1.2 * 2

export function boardCount(areaM2: number, layers: number, boardAreaM2: number, wasteFraction: number): number {
  if (areaM2 <= 0 || layers <= 0 || boardAreaM2 <= 0) return 0
  const waste = wasteFraction > 0 ? wasteFraction : 0
  return Math.ceil((areaM2 * layers * (1 + waste)) / boardAreaM2 - 1e-9)
}

export function wallLengthM(areaM2: number, heightM: number): number {
  if (areaM2 <= 0 || heightM <= 0) return 0
  return areaM2 / heightM
}

/** Montanti: uno ogni `spacingM`, più il chiusura in testata. */
export function studCount(lengthM: number, spacingM = 0.6): number {
  if (lengthM <= 0 || spacingM <= 0) return 0
  return Math.ceil(lengthM / spacingM) + 1
}

export function trackPieces(lengthM: number, pieceLenM = 3): number {
  if (lengthM <= 0 || pieceLenM <= 0) return 0
  return Math.ceil((lengthM * 2) / pieceLenM - 1e-9)
}

/** Orditura controsoffitto, metri lineari di profili. Regola pratica ~3,2 ml/m². */
export function ceilingMetalMeters(areaM2: number): number {
  if (areaM2 <= 0) return 0
  return areaM2 * 3.2
}

export function profilePieces(meters: number, pieceLenM = 3): number {
  if (meters <= 0 || pieceLenM <= 0) return 0
  return Math.ceil(meters / pieceLenM - 1e-9)
}

export function hangerCount(areaM2: number): number {
  if (areaM2 <= 0) return 0
  return Math.ceil(areaM2 / 0.8 - 1e-9)
}

export function screwCount(areaM2: number, layers: number): number {
  if (areaM2 <= 0 || layers <= 0) return 0
  return Math.ceil(areaM2 * layers * 22)
}

export function screwBoxes(screws: number, perBox = 1000): number {
  if (screws <= 0) return 0
  return Math.max(1, Math.ceil(screws / perBox))
}

/** Stucco per giunti, ordine di grandezza 0,4–0,5 kg/m² per strato. */
export const JOINT_COMPOUND_KG_PER_M2 = 0.45

export function jointCompoundKg(areaM2: number, layers: number): number {
  if (areaM2 <= 0 || layers <= 0) return 0
  return areaM2 * layers * JOINT_COMPOUND_KG_PER_M2
}

export function drywallLaborHours(areaM2: number, layers: number, ceiling: boolean): number {
  if (areaM2 <= 0 || layers <= 0) return 0
  const base = ceiling ? 0.75 : 0.55
  const layerFactor = layers === 1 ? 1 : 1.55
  return areaM2 * base * layerFactor
}
