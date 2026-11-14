import { afterEach, describe, expect, it } from 'vitest'
import { applyPriceBook, defaultLaborRate, defaultMaterialPrice, MATERIAL_LABELS } from './priceBook'
import { PRICE } from './pricing'
import { detectRegion, REGION_CODES, REGIONS } from './regions'

afterEach(() => applyPriceBook({}, 'IT'))

describe('listini per paese', () => {
  it('ogni paese ha una tariffa e un prezzo valido per tutte le voci', () => {
    for (const code of REGION_CODES) {
      applyPriceBook({}, code)
      for (const key of Object.keys(MATERIAL_LABELS)) {
        const value = defaultMaterialPrice(key)
        expect(Number.isFinite(value) && value > 0, `${code} ${key}`).toBe(true)
      }
      for (const trade of Object.keys(PRICE.laborRate)) {
        const rate = defaultLaborRate(trade)
        expect(rate >= 15 && rate <= 120, `${code} ${trade}=${rate}`).toBe(true)
      }
    }
  })
  it('cambiando paese cambiano i prezzi dei calcoli e i prezzi personali restano sopra al listino del paese', () => {
    applyPriceBook({}, 'IT')
    const it = PRICE.laborRate.idraulica
    applyPriceBook({}, 'DE')
    expect(PRICE.laborRate.idraulica).toBeGreaterThan(it)
    applyPriceBook({}, 'ES')
    expect(PRICE.laborRate.idraulica).toBeLessThan(it)
    applyPriceBook({ 'labor.idraulica': 99 }, 'ES')
    expect(PRICE.laborRate.idraulica).toBe(99)
    expect(defaultLaborRate('idraulica')).toBeLessThan(it) // il segnaposto mostra il listino del paese, non il prezzo personale
  })
  it('Italia è il listino di partenza e i paesi hanno IVA e fonti dichiarate', () => {
    applyPriceBook({}, 'IT')
    expect(defaultMaterialPrice('paintPerL')).toBe(9.9)
    for (const region of REGIONS) {
      expect(region.vat).toBeGreaterThan(0)
      expect(region.sources.length).toBeGreaterThan(0)
    }
  })
  it('rileva il paese dalla lingua del dispositivo', () => {
    expect(detectRegion('nl-BE')).toBe('BE')
    expect(detectRegion('nl-NL')).toBe('NL')
    expect(detectRegion('de-AT')).toBe('DE')
    expect(detectRegion('es-MX')).toBe('ES')
    expect(detectRegion('en-US')).toBe('IT')
    expect(detectRegion('it')).toBe('IT')
  })
})
