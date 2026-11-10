import { describe, expect, it } from 'vitest'
import type { Project } from '../domain/types'
import { inSite, siteNames, siteTotal, statusOf, summarizeByStatus } from './jobs'

const p = (total: number, extra: Partial<Project> = {}) => ({ quote: { totalEuro: total }, ...extra }) as unknown as Project

describe('stati e cantieri', () => {
  it('senza stato un lavoro è una bozza', () => {
    expect(statusOf(p(10))).toBe('bozza')
  })
  it('somma importi e conteggi per stato', () => {
    const summary = summarizeByStatus([p(100, { status: 'accettato' }), p(50.5, { status: 'accettato' }), p(20), p(5, { status: 'rifiutato' })])
    expect(summary.accettato).toEqual({ count: 2, total: 150.5 })
    expect(summary.bozza).toEqual({ count: 1, total: 20 })
    expect(summary.inviato.count).toBe(0)
  })
  it('raggruppa i cantieri ignorando maiuscole e spazi', () => {
    const list = [p(10, { siteName: 'Casa Rossi' }), p(20, { siteName: ' casa rossi ' }), p(5, { siteName: 'Bagno Verdi' }), p(1)]
    expect(siteNames(list)).toEqual(['Bagno Verdi', 'Casa Rossi'])
    expect(siteTotal(list, 'Casa Rossi')).toEqual({ net: 30, jobs: 2 })
    expect(inSite(list[1], 'CASA ROSSI')).toBe(true)
  })
})
