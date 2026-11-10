import { describe, expect, it } from 'vitest'
import { parsePriceCsv, priceCsvTemplate } from './priceBook'

describe('listino da CSV', () => {
  it('riconosce nomi, chiavi e tariffe con virgola decimale', () => {
    const csv = 'nome;prezzo\nPittura;12,50\npaintPerL;99\nTariffa Elettricista;55 €\nCosa strana;3\nSilicone;abc\n# commento\n'
    const result = parsePriceCsv(csv)
    expect(result.prices.paintPerL).toBe(99) // l'ultima riga vince
    expect(result.prices['labor.elettrica']).toBe(55)
    expect(result.unknown).toEqual(['Cosa strana'])
    expect(result.invalid).toEqual(['Silicone'])
  })
  it('il modello scaricato si rilegge senza perdite', () => {
    const back = parsePriceCsv(priceCsvTemplate({ paintPerL: 11.25 }))
    expect(back.prices.paintPerL).toBe(11.25)
    expect(back.unknown).toEqual([])
    expect(Object.keys(back.prices).length).toBeGreaterThan(50)
  })
})
