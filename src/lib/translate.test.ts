import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('traduzione sul dispositivo', () => {
  beforeEach(() => {
    vi.resetModules()
    const store = new Map<string, string>()
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('in italiano non cambia nulla e non chiama il server', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { tx } = await import('./translate')
    expect(tx('Materiali', 'it')).toBe('Materiali')
    await wait(150)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mostra subito l’italiano, poi la traduzione arrivata dal server (raggruppando le richieste)', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const texts: string[] = JSON.parse(String(init?.body)).texts
      return json({ translations: Object.fromEntries(texts.map((text) => [text, `EN:${text}`])) })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { tx } = await import('./translate')
    expect(tx('Pittura', 'en')).toBe('Pittura')
    expect(tx('Tetti', 'en')).toBe('Tetti')
    expect(tx('12,5', 'en')).toBe('12,5') // senza lettere non si traduce
    await wait(250)
    expect(fetchMock).toHaveBeenCalledTimes(1) // una sola richiesta per le due voci
    expect(tx('Pittura', 'en')).toBe('EN:Pittura')
    expect(tx('Tetti', 'en')).toBe('EN:Tetti')
  })

  it('se il server non risponde resta in italiano e non martella la rete', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('rete assente')
    })
    vi.stubGlobal('fetch', fetchMock)
    const { tx } = await import('./translate')
    tx('Muratura', 'es')
    await wait(250)
    expect(tx('Muratura', 'es')).toBe('Muratura')
    await wait(250)
    expect(fetchMock).toHaveBeenCalledTimes(1) // nessun nuovo tentativo immediato
  })
})
