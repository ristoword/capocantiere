import crypto from 'node:crypto'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error modulo JS senza tipi
import { createApi } from './api.mjs'
// @ts-expect-error modulo JS senza tipi
import { interpretEvent, verifyWebhook } from './billing.mjs'
// @ts-expect-error modulo JS senza tipi
import { openDatabase } from './db.mjs'

const SECRET = 'whsec_test'
let server: http.Server
let base = ''
let db: any

async function call(method: string, path: string, body?: unknown, cookie = '', headers: Record<string, string> = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'capocantiere', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  const json: any = await response.json().catch(() => null)
  return { status: response.status, json, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' }
}

const sign = (raw: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${crypto.createHmac('sha256', SECRET).update(`${t}.${raw}`).digest('hex')}`

beforeAll(async () => {
  db = openDatabase(':memory:')
  const api = createApi({ SIGNUP_OPEN: 'true', STRIPE_WEBHOOK_SECRET: SECRET, OPENAI_API_KEY: '' }, { db })
  server = http.createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('{}') }))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterAll(() => server.close())

describe('prova gratuita e abbonamento', () => {
  let admin = ''
  let user = ''
  let userId = ''

  it('chi si registra ha 7 giorni di prova; il primo utente (amministratore) non è soggetto al blocco', async () => {
    admin = (await call('POST', '/api/auth/register', { email: 'admin@test.it', password: 'password123' })).cookie
    expect((await call('GET', '/api/auth/me', undefined, admin)).json.user.plan.status).toBe('unlimited')
    const reg = await call('POST', '/api/auth/register', { email: 'cliente@test.it', password: 'password123' })
    user = reg.cookie
    userId = reg.json.user.id
    expect(reg.json.user.plan.status).toBe('trial')
    const days = (reg.json.user.plan.until - Date.now()) / 86400000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThan(7.1)
    expect((await call('PUT', '/api/data/projects/a', { id: 'a', updatedAt: '2026-01-01' }, user)).status).toBe(200)
  })

  it('a prova scaduta si bloccano scrittura e AI (402), ma restano lettura ed esportazione dei propri dati', async () => {
    db.prepare('UPDATE users SET trial_ends = 1 WHERE id = ?').run(userId)
    expect((await call('GET', '/api/auth/me', undefined, user)).json.user.plan.status).toBe('expired')
    for (const [method, path, body] of [
      ['PUT', '/api/data/projects/b', { id: 'b', updatedAt: '2026-01-02' }],
      ['PUT', '/api/data/photos/f1', {}],
      ['POST', '/api/data/import', { app: 'capocantiere', projects: [] }],
      ['POST', '/api/ai/chat', { messages: [] }],
      ['GET', '/api/yt/search?q=x', undefined],
    ] as const) {
      const r = await call(method, path, body, user)
      expect(r.status, `${method} ${path}`).toBe(402)
      expect(r.json.error.code).toBe('subscription_required')
    }
    expect((await call('GET', '/api/data/projects', undefined, user)).json.projects).toHaveLength(1)
    expect((await call('GET', '/api/data/export', undefined, user)).status).toBe(200)
    expect((await call('DELETE', '/api/data/projects/a', undefined, user)).status).toBe(200)
  })

  it('senza chiavi Stripe il pagamento non è attivo e lo dice', async () => {
    expect((await call('POST', '/api/billing/checkout', {}, user)).status).toBe(409)
    expect((await call('GET', '/api/auth/me', undefined, user)).json.user.billing.enabled).toBe(false)
  })

  it('solo l’amministratore può concedere o revocare giorni di accesso', async () => {
    expect((await call('POST', '/api/admin/subscription', { userId, days: 30 }, user)).status).toBe(403)
    expect((await call('POST', '/api/admin/subscription', { userId, days: -1 }, admin)).status).toBe(400)
    const granted = await call('POST', '/api/admin/subscription', { userId, days: 30 }, admin)
    expect(granted.json.plan.status).toBe('active')
    expect((await call('PUT', '/api/data/projects/c', { id: 'c', updatedAt: '2026-01-03' }, user)).status).toBe(200)
    await call('POST', '/api/admin/subscription', { userId, days: 0 }, admin)
    expect((await call('GET', '/api/auth/me', undefined, user)).json.user.plan.status).toBe('expired')
  })

  it('il webhook accetta solo eventi firmati e applica la scadenza del periodo pagato', async () => {
    const end = Math.floor(Date.now() / 1000) + 30 * 86400
    const raw = JSON.stringify({ type: 'customer.subscription.updated', data: { object: { status: 'active', current_period_end: end, customer: 'cus_1', metadata: { user_id: userId } } } })
    expect((await call('POST', '/api/billing/webhook', raw, '', { 'Stripe-Signature': 't=1,v1=00' })).status).toBe(400)
    expect((await call('POST', '/api/billing/webhook', raw, '', { 'Stripe-Signature': sign(raw, Math.floor(Date.now() / 1000) - 3600) })).status).toBe(400) // vecchia
    expect((await call('POST', '/api/billing/webhook', raw, '', { 'Stripe-Signature': sign(raw) })).status).toBe(200)
    const me = (await call('GET', '/api/auth/me', undefined, user)).json.user
    expect(me.plan.status).toBe('active')
    expect(me.plan.until).toBe(end * 1000)
    // Disdetta definitiva: il cliente è riconosciuto dal customer anche senza metadata.
    const gone = JSON.stringify({ type: 'customer.subscription.deleted', data: { object: { status: 'canceled', current_period_end: end, customer: 'cus_1', metadata: {} } } })
    expect((await call('POST', '/api/billing/webhook', gone, '', { 'Stripe-Signature': sign(gone) })).status).toBe(200)
    expect((await call('GET', '/api/auth/me', undefined, user)).json.user.plan.status).toBe('expired')
  })
})

describe('funzioni di fatturazione', () => {
  it('verifyWebhook rifiuta firme mancanti, errate o con segreto vuoto', () => {
    const raw = '{"a":1}'
    expect(verifyWebhook(raw, sign(raw), SECRET)).toBe(true)
    expect(verifyWebhook(raw, sign('{"a":2}'), SECRET)).toBe(false)
    expect(verifyWebhook(raw, '', SECRET)).toBe(false)
    expect(verifyWebhook(raw, sign(raw), '')).toBe(false)
  })
  it('interpretEvent ignora gli eventi non pertinenti e legge il periodo anche nel formato nuovo', () => {
    expect(interpretEvent({ type: 'charge.succeeded', data: { object: {} } })).toBeNull()
    const r = interpretEvent({ type: 'customer.subscription.updated', data: { object: { status: 'trialing', items: { data: [{ current_period_end: 100 }] }, customer: 'c' } } })
    expect(r.until).toBe(100_000)
  })
})
