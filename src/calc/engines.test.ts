import { describe, expect, it } from 'vitest'
import { boardCount, BOARD_AREA_M2, studCount } from './drywall'
import { areaWithWaste, groutKgPerM2, tileCount } from './flooring'
import {
  PAINT_COVERAGE_M2_PER_L,
  PRIMER_COVERAGE_M2_PER_L,
  litersForCoats,
  paintableSurface,
  primerLiters,
} from './paint'
import { plumbingKit } from './plumbing'
import { slopeCmPerMeter, slopeTotalCm } from './slope'
import { MEMBRANE_KG_PER_M2_PER_MM, MEMBRANE_THICKNESS_MM, membraneKg } from './terrace'
import { defaultsFor } from '../domain/fields'
import { TRADES } from '../domain/trades'
import type { InputValue } from '../domain/types'
import { computeJob } from '../engine/compute'

describe('pittura', () => {
  it('somma il soffitto solo se è compreso', () => {
    expect(paintableSurface(100, 20, true)).toBe(120)
    expect(paintableSurface(100, 20, false)).toBe(100)
  })

  it('calcola i litri su 120 m², due mani, sfrido 10%', () => {
    expect(litersForCoats(120, 2, PAINT_COVERAGE_M2_PER_L, 0.1)).toBeCloseTo(24, 5)
    expect(primerLiters(120, PRIMER_COVERAGE_M2_PER_L, 0.1)).toBeCloseTo(11, 5)
  })
})

describe('pendenza', () => {
  it('tratta 1,5% come 1,5 cm al metro e 7,5 cm su 5 m', () => {
    expect(slopeCmPerMeter(1.5)).toBe(1.5)
    expect(slopeTotalCm(1.5, 5)).toBe(7.5)
  })
})

describe('membrana di terrazza', () => {
  it('usa 1,6 kg/m² per mm, 2 mm e lo sfrido', () => {
    expect(membraneKg(10, MEMBRANE_THICKNESS_MM, MEMBRANE_KG_PER_M2_PER_MM, 0.1)).toBeCloseTo(35.2, 5)
    expect(membraneKg(45, 2, 1.6, 0.1)).toBeCloseTo(158.4, 5)
  })
})

describe('piastrelle', () => {
  it('aumenta i metri quadri con lo sfrido e conta i pezzi', () => {
    expect(areaWithWaste(20, 10)).toBeCloseTo(22, 5)
    expect(tileCount(20, 60, 60, 10)).toBe(62)
  })

  it('stima lo stucco di una 60×60 con fuga 2 mm', () => {
    expect(groutKgPerM2(600, 600, 2, 8)).toBeCloseTo(0.08, 5)
  })
})

describe('altri conteggi', () => {
  it('conta montanti e lastre', () => {
    expect(studCount(3.7, 0.6)).toBe(8)
    expect(boardCount(10, 1, BOARD_AREA_M2, 0.1)).toBe(5)
  })

  it('prevede PTFE di scorta sul sifone', () => {
    expect(plumbingKit('sifone', 1).ptfeRolls).toBe(2)
    expect(plumbingKit('sifone', 1).gaskets).toBe(2)
    expect(plumbingKit('sifone', 1).traps).toBe(1)
  })
})

describe('fascicolo', () => {
  it('chiude la pittura d’esempio a 24 litri', () => {
    const job = computeJob({
      trade: 'pittura',
      title: 'Tinteggiatura',
      description: 'Devo imbiancare 120 m², due mani, soffitto compreso.',
      inputs: {
        wallM2: 100,
        ceilingIncluded: true,
        ceilingM2: 20,
        coats: 2,
        primer: true,
        wastePercent: 10,
      },
    })
    expect(job.areaM2).toBe(120)
    expect(job.materials.find((line) => line.id === 'mat:pittura:idropittura')?.quantity).toBeCloseTo(24, 5)
    expect(job.quote.materialsEuro).toBeGreaterThan(0)
    expect(job.quote.laborEuro).toBeGreaterThan(0)
    expect(job.quote.totalEuro).toBeCloseTo(job.quote.materialsEuro + job.quote.laborEuro, 5)
  })

  it('mostra 7,5 cm di dislivello e i kg di membrana sulla terrazza', () => {
    const job = computeJob({
      trade: 'impermeabilizzazione',
      title: 'Terrazza',
      description: 'Terrazza 45 m².',
      inputs: {
        areaM2: 45,
        perimeterM: 28,
        drains: 2,
        slopePercent: 1.5,
        lengthM: 5,
        withFlooring: false,
      },
    })
    expect(job.slope?.cmPerMeter).toBe(1.5)
    expect(job.slope?.totalCm).toBe(7.5)
    expect(job.materials.find((line) => line.id === 'mat:impermeabilizzazione:membrana')?.quantity).toBeCloseTo(158.4, 5)
    expect(job.phases.map((phase) => phase.title)).toEqual([
      'Sottofondo',
      'Pendenza',
      'Primer',
      'Impermeabilizzazione',
      'Trattamento angoli e scarichi',
      'Attesa e controllo tenuta',
    ])
  })

  it('genera tutti i mestieri con procedura, sicurezza e preventivo', () => {
    for (const trade of TRADES) {
      const inputs: Record<string, InputValue> = { ...defaultsFor(trade.id) }
      if ('areaM2' in inputs) inputs.areaM2 = 12
      if ('wallM2' in inputs) inputs.wallM2 = 30
      if ('ceilingM2' in inputs) inputs.ceilingM2 = 8
      if ('perimeterM' in inputs) inputs.perimeterM = 14
      if ('gutterM' in inputs) inputs.gutterM = 8
      if ('brokenTiles' in inputs) inputs.brokenTiles = 4
      if ('linearM' in inputs) inputs.linearM = 10
      if ('fixtures' in inputs) inputs.fixtures = 1
      if ('points' in inputs) inputs.points = 2
      if ('rooms' in inputs) inputs.rooms = 3
      if ('splits' in inputs) inputs.splits = 1
      if ('pieces' in inputs) inputs.pieces = 1
      const job = computeJob({
        trade: trade.id,
        title: `Prova ${trade.name}`,
        description: 'Descrizione di prova in cantiere.',
        inputs,
      })
      expect(job.phases.length, trade.id).toBeGreaterThan(2)
      expect(job.checklist.length, trade.id).toBeGreaterThan(3)
      expect(job.safety.length, trade.id).toBeGreaterThan(2)
      expect(job.tools.length, trade.id).toBeGreaterThan(2)
      expect(job.quote.totalEuro, trade.id).toBeGreaterThan(0)
      expect(job.quote.laborHours, trade.id).toBeGreaterThan(0)
      for (const phase of job.phases) {
        expect(phase.videoUrl.startsWith('https://www.youtube.com/results?search_query='), phase.id).toBe(true)
        expect(phase.questions.length, phase.id).toBeGreaterThan(0)
      }
    }
  })
})
