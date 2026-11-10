export type LeakPoint = 'sifone' | 'rubinetto' | 'flessibili' | 'scarico_lavabo' | 'non_so'

export interface PlumbingKit {
  ptfeRolls: number
  gaskets: number
  traps: number
  hoses: number
  faucetBodies: number
}

export function plumbingKit(point: string, fixtures: number): PlumbingKit {
  const n = Math.max(1, Math.round(Number.isFinite(fixtures) ? fixtures : 1))
  const traps = point === 'sifone' || point === 'scarico_lavabo' || point === 'non_so' ? n : 0
  const hoses = point === 'flessibili' || point === 'rubinetto' || point === 'non_so' ? n * 2 : 0
  const faucetBodies = point === 'rubinetto' ? n : 0
  return {
    ptfeRolls: n + 1,
    gaskets: n * 2,
    traps,
    hoses,
    faucetBodies,
  }
}

export function plumbingLaborHours(fixtures: number): number {
  const n = Math.max(1, Math.round(fixtures || 1))
  return 1.2 + (n - 1) * 0.6
}
