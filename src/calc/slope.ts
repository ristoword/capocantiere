/**
 * La pendenza in percento coincide con i centimetri di dislivello per metro.
 * 1,5% = 1,5 cm/m. Su 5 m = 7,5 cm.
 */
export function slopeCmPerMeter(slopePercent: number): number {
  if (!Number.isFinite(slopePercent)) return 0
  return slopePercent
}

export function slopeTotalCm(slopePercent: number, lengthM: number): number {
  if (!Number.isFinite(slopePercent) || !Number.isFinite(lengthM) || lengthM < 0) return 0
  return slopePercent * lengthM
}

export const SLOPE_FORMULA = 'dislivello_cm = pendenza_% × lunghezza_m'
export const SLOPE_EXAMPLE = 'Esempio: 1,5% = 1,5 cm/m; su 5 m = 7,5 cm.'
