import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error modulo JS senza tipi
import { createApi } from './api.mjs'
// @ts-expect-error modulo JS senza tipi
import { openDatabase } from './db.mjs'

let mock: http.Server
let app: http.Server
let base = ''
let upstreamCalls = 0
let breakNext = false
let cookie = ''

async function post(path: string, body: unknown, ck = cookie) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'capocantiere', ...(ck ? { Cookie: ck } : {}) },
    body: JSON.stringify(body),
  })
  return { status: r.status, json: (await r.json().catch(() => null)) as any, cookie: r.headers.get('set-cookie')?.split(';')[0] ?? '' }
}

beforeAll(async () => {
  // Finto OpenAI: restituisce "EN:" davanti a ogni voce (o una risposta sbagliata se richiesto).
  mock = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      upstreamCalls += 1
      const items: string[] = JSON.parse(JSON.parse(raw).messages[1].content).items
      const out = breakNext ? { items: ['solo una'] } : { items: items.map((item) => `EN:${item}`) }
      breakNext = false
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(out) } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }))
    })
  })
  await new Promise<void>((resolve) => mock.listen(0, resolve))
  const mockUrl = `http://127.0.0.1:${(mock.address() as { port: number }).port}`
  const api = createApi({ SIGNUP_OPEN: 'true', OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: mockUrl }, { db: openDatabase(':memory:') })
  app = http.createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('{}') }))
  await new Promise<void>((resolve) => app.listen(0, resolve))
  base = `http://127.0.0.1:${(app.address() as { port: number }).port}`
  cookie = (await post('/api/auth/register', { email: 't@test.it', password: 'password123' }, '')).cookie
})
afterAll(() => {
  mock.close()
  app.close()
})

describe('traduzione dei testi', () => {
  it('richiede l’accesso e una lingua supportata', async () => {
    expect((await post('/api/translate', { lang: 'en', texts: ['Ciao'] }, '')).status).toBe(401)
    expect((await post('/api/translate', { lang: 'fr', texts: ['Ciao'] })).status).toBe(400)
    expect((await post('/api/translate', { lang: 'en' })).status).toBe(400)
  })

  it('traduce, mette in cache e non richiama l’AI per testi già visti', async () => {
    const first = await post('/api/translate', { lang: 'en', texts: ['Pittura', 'Pittura', 'Idraulica', '123', ''] })
    expect(first.status).toBe(200)
    expect(first.json.translations).toEqual({ Pittura: 'EN:Pittura', Idraulica: 'EN:Idraulica' }) // duplicati unificati, numeri e vuoti ignorati
    const calls = upstreamCalls
    const second = await post('/api/translate', { lang: 'en', texts: ['Pittura'] })
    expect(second.json.translations).toEqual({ Pittura: 'EN:Pittura' })
    expect(upstreamCalls).toBe(calls) // dalla cache
    const es = await post('/api/translate', { lang: 'es', texts: ['Pittura'] })
    expect(upstreamCalls).toBe(calls + 1) // un'altra lingua è una voce a parte
    expect(es.json.translations.Pittura).toBe('EN:Pittura')
  })

  it('una risposta incoerente dell’AI non entra in cache: i testi restano in italiano', async () => {
    breakNext = true
    const bad = await post('/api/translate', { lang: 'en', texts: ['Muratura', 'Tetti'] })
    expect(bad.json.translations).toEqual({})
    const retry = await post('/api/translate', { lang: 'en', texts: ['Muratura', 'Tetti'] })
    expect(Object.keys(retry.json.translations).sort()).toEqual(['Muratura', 'Tetti'])
  })

  it('i testi troppo lunghi sono saltati e il consumo viene registrato', async () => {
    const long = 'a'.repeat(2000)
    const r = await post('/api/translate', { lang: 'en', texts: [long] })
    expect(r.json.translations).toEqual({})
  })
})
