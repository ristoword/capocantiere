import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeJob } from '../engine/compute'
import { analyzeSite, chatTurn, parseGuide, parseQuoteReview, parseSiteAnalysis, sanitizeInputs } from './assistant'

const job = computeJob({
  trade: 'pittura',
  title: 'Tinteggiatura',
  description: 'Cucina',
  inputs: { wallM2: 100, ceilingIncluded: true, ceilingM2: 20, coats: 2, primer: true, wastePercent: 10 },
})
const noKey = { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
const reply = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] }), {
    status: 200,
  })

afterEach(() => vi.unstubAllGlobals())

describe('sanitizeInputs', () => {
  it('scarta chiavi inventate, forza limiti e tipi, tiene i predefiniti', () => {
    const out = sanitizeInputs('pittura', { wallM2: '55,5', coats: 99, primer: 'no', inventata: 1, wastePercent: 'boh' })
    expect(out.wallM2).toBe(55.5)
    expect(out.coats).toBe(5)
    expect(out.primer).toBe(false)
    expect(out.wastePercent).toBe(10)
    expect('inventata' in out).toBe(false)
  })
  it('rifiuta valori select fuori elenco', () => {
    expect(sanitizeInputs('idraulica', { leakPoint: 'luna' }).leakPoint).toBe('sifone')
  })
})

describe('parser', () => {
  it('analisi: mestiere sconosciuto è un errore', () => {
    expect(() => parseSiteAnalysis({ trade: 'astronomia', title: 'a', description: 'b' })).toThrow(/mestiere/)
  })
  it('guida senza passi è un errore', () => {
    expect(() => parseGuide({ steps: [] })).toThrow(/passi/)
  })
  it('revisione costi: giudizio non valido è un errore', () => {
    expect(() => parseQuoteReview({ verdict: 'boh', summary: 'x' })).toThrow(/giudizio/)
  })
})

describe('proxy senza chiave nel browser', () => {
  it('analyzeSite chiama /api/ai/chat senza header Authorization e precompila', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('/api/ai/chat')
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined()
      return reply({
        trade: 'pittura',
        title: 'Imbiancatura cucina',
        description: 'Pareti da ritinteggiare.',
        whatISee: 'Muro con macchie.',
        confidence: 'media',
        inputs: { wallM2: 40, coats: 2 },
        assumptions: ['Altezza stimata 2,7 m'],
        questions: ['Quanto è lunga la parete?'],
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await analyzeSite(noKey, { description: 'cucina', tradeHint: null, images: ['data:image/png;base64,a'] })
    expect(result.inputs.wallM2).toBe(40)
    expect(result.questions).toHaveLength(1)
  })

  it('chatTurn restituisce testo libero con il contesto del fascicolo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))
        expect(body.messages[0].content).toContain('CONTESTO DEL FASCICOLO')
        expect(body.response_format).toBeUndefined()
        return reply('Passo 1: proteggi il pavimento.')
      }),
    )
    expect(await chatTurn(noKey, job, [], 'Da dove parto?', [])).toContain('proteggi')
  })

  it('errore 503 del proxy arriva all’utente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Il server non ha la chiave AI' } }), { status: 503 })),
    )
    await expect(chatTurn(noKey, job, [], 'ciao', [])).rejects.toThrow(/chiave AI/)
  })
})

describe('matchTrade', () => {
  it('accetta id, nome, maiuscole e accenti', async () => {
    const { matchTrade } = await import('./assistant')
    expect(matchTrade('Pittura')).toBe('pittura')
    expect(matchTrade('Manutenzione casa')).toBe('manutenzione')
    expect(matchTrade('impermeabilizzazione terrazze')).toBe('impermeabilizzazione')
    expect(matchTrade('astronomia')).toBeUndefined()
  })
})
