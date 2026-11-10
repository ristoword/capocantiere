import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error modulo JS senza tipi
import { createApi, estimateCost } from './api.mjs'
// @ts-expect-error modulo JS senza tipi
import { openDatabase } from './db.mjs'

let app: http.Server
let fake: http.Server
let base = ''
const sent: { to: string; text: string }[] = []

async function call(method: string, path: string, body?: unknown, cookie = '') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'capocantiere', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json: any = await response.json().catch(() => null)
  return { status: response.status, json, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' }
}

beforeAll(async () => {
  // Falso OpenAI che restituisce il consumo di token.
  fake = http.createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } }))
    })
  })
  await new Promise<void>((resolve) => fake.listen(0, resolve))
  const fakePort = (fake.address() as { port: number }).port
  const api = createApi(
    {
      OPENAI_API_KEY: 'sk-finta',
      OPENAI_MODEL: 'gpt-4o',
      OPENAI_BASE_URL: `http://127.0.0.1:${fakePort}/v1`,
      SIGNUP_OPEN: 'true',
      MONTHLY_BUDGET_USD: '0.02',
      APP_URL: 'https://esempio.test',
    },
    { db: openDatabase(':memory:'), sendMail: async (_env: unknown, mail: { to: string; text: string }) => void sent.push(mail) },
  )
  app = http.createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('{}') }))
  await new Promise<void>((resolve) => app.listen(0, resolve))
  base = `http://127.0.0.1:${(app.address() as { port: number }).port}`
})
afterAll(() => {
  app.close()
  fake.close()
})

describe('costi, budget e amministrazione', () => {
  let admin = ''
  let user = ''
  it('stima il costo dal modello e dai token', () => {
    expect(estimateCost({}, { kind: 'chat', model: 'gpt-4o', tokensIn: 1_000_000, tokensOut: 0 })).toBeCloseTo(2.5)
    expect(estimateCost({}, { kind: 'chat', model: 'gpt-4o-mini', tokensIn: 0, tokensOut: 1_000_000 })).toBeCloseTo(0.6)
    expect(estimateCost({ IMAGE_COST_USD: '0.05' }, { kind: 'image' })).toBe(0.05)
  })
  it('registra il consumo e blocca quando il budget mensile è finito', async () => {
    admin = (await call('POST', '/api/auth/register', { email: 'admin@test.it', password: 'password123' })).cookie
    user = (await call('POST', '/api/auth/register', { email: 'utente@test.it', password: 'password123' })).cookie
    const first = await call('POST', '/api/ai/chat', { messages: [{ role: 'user', content: 'ciao' }] }, user)
    expect(first.status).toBe(200) // 1000*2.5/1M + 500*10/1M = 0,0075 $
    const overview = await call('GET', '/api/admin/overview', undefined, admin)
    expect(overview.json.monthCost).toBeCloseTo(0.0075, 4)
    expect(overview.json.users.find((u: { email: string }) => u.email === 'utente@test.it').calls).toBe(1)
    await call('POST', '/api/ai/chat', { messages: [{ role: 'user', content: 'ciao' }] }, user)
    const third = await call('POST', '/api/ai/chat', { messages: [{ role: 'user', content: 'ciao' }] }, user)
    expect(third.status).toBe(200)
    const blocked = await call('POST', '/api/ai/chat', { messages: [{ role: 'user', content: 'ciao' }] }, user)
    expect(blocked.status).toBe(503)
    expect(blocked.json.error.message).toContain('budget')
  })
  it('il pannello amministratore è solo per l’amministratore', async () => {
    expect((await call('GET', '/api/admin/overview', undefined, user)).status).toBe(403)
    expect((await call('GET', '/api/admin/overview', undefined, admin)).status).toBe(200)
  })
  it('reimposta la password con un link generato dall’amministratore', async () => {
    const overview = await call('GET', '/api/admin/overview', undefined, admin)
    const target = overview.json.users.find((u: { email: string }) => u.email === 'utente@test.it')
    const link = await call('POST', '/api/admin/reset-link', { userId: target.id }, admin)
    const token = new URL(link.json.link).searchParams.get('token')
    expect(link.json.link.startsWith('https://esempio.test/reset?token=')).toBe(true)
    expect((await call('POST', '/api/auth/reset', { token, password: 'nuovapassword9' })).status).toBe(200)
    expect((await call('POST', '/api/auth/reset', { token, password: 'altrapassword9' })).status).toBe(400) // monouso
    expect((await call('POST', '/api/auth/login', { email: 'utente@test.it', password: 'password123' })).status).toBe(401)
    expect((await call('POST', '/api/auth/login', { email: 'utente@test.it', password: 'nuovapassword9' })).status).toBe(200)
    expect((await call('GET', '/api/data/projects', undefined, user)).status).toBe(401) // vecchia sessione chiusa
  })
  it('“password dimenticata” invia l’email senza rivelare se l’account esiste', async () => {
    const known = await call('POST', '/api/auth/forgot', { email: 'admin@test.it' })
    const unknown = await call('POST', '/api/auth/forgot', { email: 'nessuno@test.it' })
    expect(known.status).toBe(200)
    expect(unknown.json).toEqual(known.json)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe('admin@test.it')
    expect(sent[0].text).toContain('https://esempio.test/reset?token=')
  })
})
