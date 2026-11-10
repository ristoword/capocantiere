import { describe, expect, it } from 'vitest'
import { defaultsFor, FIELDS, validateDraft } from '../domain/fields'
import { TRADES } from '../domain/trades'
import type { InputValue, TradeId } from '../domain/types'
import { computeJob } from './compute'

function numbers(value: unknown, path = '', out: { path: string; n: number }[] = []) {
  if (typeof value === 'number') out.push({ path, n: value })
  else if (Array.isArray(value)) value.forEach((item, index) => numbers(item, `${path}[${index}]`, out))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) numbers(item, `${path}.${key}`, out)
  return out
}

function check(trade: TradeId, inputs: Record<string, InputValue>, label: string) {
  const job = computeJob({ trade, title: 't', description: 'd', inputs })
  const bad = numbers(job).filter(({ n }) => !Number.isFinite(n))
  expect(bad, `${trade} ${label}: numeri non finiti ${JSON.stringify(bad.slice(0, 3))}`).toEqual([])
  for (const line of job.materials) {
    expect(line.quantity, `${trade} ${label}: quantità negativa in ${line.name}`).toBeGreaterThanOrEqual(0)
    expect(line.unitPrice, `${trade} ${label}: prezzo negativo in ${line.name}`).toBeGreaterThanOrEqual(0)
  }
  expect(job.quote.totalEuro, `${trade} ${label}: totale negativo`).toBeGreaterThanOrEqual(0)
  expect(job.quote.laborHours, `${trade} ${label}: ore negative`).toBeGreaterThanOrEqual(0)
  expect(job.phases.length, `${trade} ${label}: nessuna fase`).toBeGreaterThan(0)
  const ids = job.materials.map((line) => line.id)
  expect(new Set(ids).size, `${trade} ${label}: id materiali duplicati`).toBe(ids.length)
}

describe('robustezza dei calcoli per ogni mestiere', () => {
  it('tutti i 12 mestieri hanno campi e valori predefiniti', () => {
    expect(TRADES).toHaveLength(12)
    for (const trade of TRADES) {
      expect(FIELDS[trade.id].length, trade.id).toBeGreaterThan(0)
      check(trade.id, defaultsFor(trade.id), 'predefiniti')
    }
  })

  const hostile: [string, (field: (typeof FIELDS)[TradeId][number]) => InputValue | undefined][] = [
    ['zero', (f) => (f.type === 'number' ? 0 : undefined)],
    ['negativo', (f) => (f.type === 'number' ? -7 : undefined)],
    ['enorme', (f) => (f.type === 'number' ? 1e9 : undefined)],
    ['frazionario', (f) => (f.type === 'number' ? 0.0001 : undefined)],
    ['testo', (f) => (f.type === 'number' ? ('abc' as InputValue) : undefined)],
    ['virgola', (f) => (f.type === 'number' ? ('12,5' as InputValue) : undefined)],
    ['vero', (f) => (f.type === 'boolean' ? true : undefined)],
    ['falso', (f) => (f.type === 'boolean' ? false : undefined)],
  ]

  for (const trade of TRADES) {
    for (const [name, pick] of hostile) {
      it(`${trade.id}: valori ${name} non rompono il calcolo`, () => {
        const inputs = defaultsFor(trade.id)
        for (const field of FIELDS[trade.id]) {
          const value = pick(field)
          if (value !== undefined) inputs[field.key] = value
        }
        check(trade.id, inputs, name)
      })
    }

    it(`${trade.id}: ogni opzione dei menu produce un calcolo valido`, () => {
      for (const field of FIELDS[trade.id]) {
        for (const option of field.options ?? []) {
          check(trade.id, { ...defaultsFor(trade.id), [field.key]: option.value }, `${field.key}=${option.value}`)
        }
      }
    })

    it(`${trade.id}: la validazione non lancia eccezioni`, () => {
      expect(() => validateDraft({ trade: trade.id, title: '', description: '', inputs: {} })).not.toThrow()
      expect(() => validateDraft({ trade: trade.id, title: 'x', description: 'y', inputs: defaultsFor(trade.id) })).not.toThrow()
    })
  }

  it('un input mancante o un mestiere non valido viene gestito', () => {
    expect(() => computeJob({ trade: 'pittura', title: 'a', description: 'b', inputs: {} })).not.toThrow()
  })
})
