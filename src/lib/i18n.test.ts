import { describe, expect, it } from 'vitest'
import { detectLang, translate } from './i18n'
import { MESSAGES, type MessageKey } from './messages'

describe('lingue', () => {
  it('inglese e spagnolo hanno tutte le voci dell’italiano, con gli stessi segnaposto', () => {
    const keys = Object.keys(MESSAGES.it) as MessageKey[]
    for (const lang of ['en', 'es'] as const) {
      for (const key of keys) {
        const text = MESSAGES[lang][key]
        expect(text, `${lang}:${key}`).toBeTruthy()
        const holes = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort().join()
        expect(holes(text), `${lang}:${key}`).toBe(holes(MESSAGES.it[key]))
      }
    }
  })
  it('sostituisce i segnaposto e riconosce la lingua del dispositivo', () => {
    expect(translate('plan.trialLeft', { days: 5 }, 'en')).toContain('5 days')
    expect(translate('home.phases', { done: 1, total: 4 }, 'es')).toBe('1/4 fases')
    expect(detectLang('it-IT')).toBe('it')
    expect(detectLang('es-AR')).toBe('es')
    expect(detectLang('nl-NL')).toBe('en')
  })
})
