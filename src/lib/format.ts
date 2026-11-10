import type { Difficulty } from '../domain/types'

const euroFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

export function euro(value: number): string {
  return euroFmt.format(Number.isFinite(value) ? value : 0)
}

export function numIt(value: number, digits = 2): string {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0)
}

export function qty(value: number): string {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  )
}

export function when(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  bassa: 'Bassa',
  media: 'Media',
  alta: 'Alta',
  critica: 'Critica',
}
