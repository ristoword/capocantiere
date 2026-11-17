import crypto from 'node:crypto'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error modulo JS senza tipi
import { createApi } from './api.mjs'
// @ts-expect-error modulo JS senza tipi
import { openDatabase } from './db.mjs'
// @ts-expect-error modulo JS senza tipi
import { interpretSubscription } from './play.mjs'

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const account = JSON.stringify({ client_email: 'svc@test.iam', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })
const future = new Date(Date.now() + 30 * 86400000).toISOString()
const calls: string[] = []
let subscription: any = { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', lineItems: [{ productId: 'capocantiere_mensile', expiryTime: future }] }

const playFetch = async (url: string) => {
  calls.push(String(url))
  const body = String(url).includes('oauth2') ? { access_token: 'tok', expires_in: 3600 } : String(url).includes(':acknowledge') ? {} : subscription
  return new Response(JSON.stringify(body), { status: 200 })
}

let server: http.Server
let base = ''

async function call(method: string, path: string, body?: unknown, cookie = '') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'capocantiere', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, json: (await response.json().catch(() => null)) as any, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' }
}

beforeAll(async () => {
  const api = createApi(
    { SIGNUP_OPEN: 'true', OPENAI_API_KEY: '', ANDROID_PACKAGE: 'app.capocantiere.twa', PLAY_SERVICE_ACCOUNT_JSON: account },
    { db: openDatabase(':memory:'), playFetch },
  )
  server = http.createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('{}') }))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterAll(() => server.close())

describe('abbonamento Google Play', () => {
  const token = 'purchase-token-'.padEnd(40, 'x')

  it('interpreta lo stato della sottoscrizione', () => {
    expect(interpretSubscription(subscription, 'capocantiere_mensile').valid).toBe(true)
    expect(interpretSubscription({ ...subscription, subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }, 'capocantiere_mensile').valid).toBe(false)
    expect(interpretSubscription(subscription, 'altro').valid).toBe(false)
  })

  it('sblocca l’account, conferma l’acquisto e lega il token a un solo utente', async () => {
    await call('POST', '/api/auth/register', { email: 'admin@example.test', password: 'Password-lunga-0!', name: 'Admin' }) // il primo account è amministratore
    const first = await call('POST', '/api/auth/register', { email: 'a@example.test', password: 'Password-lunga-1!', name: 'A' })
    expect(first.json.user.billing.play).toBe(true)
    const ok = await call('POST', '/api/billing/play', { purchaseToken: token }, first.cookie)
    expect(ok.status).toBe(200)
    expect(ok.json.plan.status).toBe('active')
    expect(calls.some((url) => url.includes(':acknowledge'))).toBe(true)
    const second = await call('POST', '/api/auth/register', { email: 'b@example.test', password: 'Password-lunga-2!', name: 'B' })
    const stolen = await call('POST', '/api/billing/play', { purchaseToken: token }, second.cookie)
    expect(stolen.status).toBe(409)
  })

  it('rifiuta un abbonamento scaduto e un token troppo corto', async () => {
    const user = await call('POST', '/api/auth/register', { email: 'c@example.test', password: 'Password-lunga-3!', name: 'C' })
    expect((await call('POST', '/api/billing/play', { purchaseToken: 'corto' }, user.cookie)).status).toBe(400)
    subscription = { ...subscription, subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }
    const expired = await call('POST', '/api/billing/play', { purchaseToken: 'altro-token-'.padEnd(40, 'y') }, user.cookie)
    expect(expired.status).toBe(402)
  })
})
