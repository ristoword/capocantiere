import { describe, expect, it } from 'vitest'
import type { Project } from '../domain/types'
import { nextQuoteNumber, validUntil, withVat } from './quoteDoc'

const proj = (number?: string) => ({ quoteMeta: number ? { number } : undefined }) as unknown as Project

describe('preventivo formale', () => {
  it('calcola IVA e totale arrotondando ai centesimi', () => {
    expect(withVat(100, 22)).toEqual({ net: 100, vat: 22, gross: 122 })
    expect(withVat(33.33, 10)).toEqual({ net: 33.33, vat: 3.33, gross: 36.66 })
    expect(withVat(50, -5).vat).toBe(0)
  })
  it('numera i preventivi di anno in anno', () => {
    const now = new Date('2026-05-01')
    expect(nextQuoteNumber([], now)).toBe('2026-001')
    expect(nextQuoteNumber([proj('2026-004'), proj('2025-099'), proj()], now)).toBe('2026-005')
    expect(nextQuoteNumber([proj('2025-099')], now)).toBe('2026-001')
  })
  it('calcola la scadenza di validità', () => {
    expect(validUntil('2026-01-01T00:00:00Z', 30).toISOString().slice(0, 10)).toBe('2026-01-31')
  })
})
