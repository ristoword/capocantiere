import type { Difficulty } from '../domain/types'
import { localeOf } from './i18n'

// Formati secondo la lingua scelta (it-IT, en-GB, es-ES); la valuta è sempre l'euro (i cinque paesi dei listini lo usano).
const cache = new Map<string, Intl.NumberFormat>()
function fmt(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let found = cache.get(key)
  if (!found) {
    found = new Intl.NumberFormat(locale, options)
    cache.set(key, found)
  }
  return found
}

export function euro(value: number): string {
  return fmt(localeOf(), { style: 'currency', currency: 'EUR' }).format(Number.isFinite(value) ? value : 0)
}

export function numIt(value: number, digits = 2): string {
  return fmt(localeOf(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0)
}

export function qty(value: number): string {
  return fmt(localeOf(), { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0)
}

export function when(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(localeOf(), { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  bassa: 'Bassa',
  media: 'Media',
  alta: 'Alta',
  critica: 'Critica',
}
