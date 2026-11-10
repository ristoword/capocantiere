export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export function round1(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10) / 10
}

export function wasteFraction(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) return 0
  return percent / 100
}
