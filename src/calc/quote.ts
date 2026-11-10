import { round2 } from './number'
import type { MaterialLine, Quote } from '../domain/types'

export function materialsTotal(lines: MaterialLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0))
}

export function laborTotal(hours: number, hourlyRate: number): number {
  return round2(Math.max(0, hours) * Math.max(0, hourlyRate))
}

export function quoteTotals(
  lines: MaterialLine[],
  hours: number,
  hourlyRate: number,
  laborNote: string,
  assumptions: string,
): Quote {
  const materialsEuro = materialsTotal(lines)
  const laborEuro = laborTotal(hours, hourlyRate)
  return {
    hourlyRate,
    laborHours: hours,
    laborNote,
    materialsEuro,
    laborEuro,
    totalEuro: round2(materialsEuro + laborEuro),
    assumptions,
  }
}
