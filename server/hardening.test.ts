import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error modulo JS senza tipi
import { createApi } from './api.mjs'
// @ts-expect-error modulo JS senza tipi
import { openDatabase } from './db.mjs'
// @ts-expect-error modulo JS senza tipi
import { parseCookies } from './http.mjs'

let app: http.Server
let base = ''

async function call(method: string, path: string, body?: unknown, cookie = '', headers: Record<string, string> = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'capocantiere', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' || body instanceof Uint8Array ? (body as BodyInit) : JSON.stringify(body),
  })
  const json: any = await response.json().catch(() => null)
  return { status: response.status, json, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '', headers: response.headers }
}

beforeAll(async () => {
  const api = createApi({ SIGNUP_OPEN: 'true', STORAGE_LIMIT_MB: '1' }, { db: openDatabase(':memory:') })
  app = http.createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('{}') }))
  await new Promise<void>((resolve) => app.listen(0, resolve))
  base = `http://127.0.0.1:${(app.address() as { port: number }).port}`
})
afterAll(() => app.close())

describe('account senza limiti (UNLIMITED_EMAILS)', () => {
  it('salta quote giornaliere e spazio solo per le email indicate', async () => {
    const api = createApi(
      { SIGNUP_OPEN: 'true', AI_DAILY_LIMIT: '1', STORAGE_LIMIT_MB: '1', UNLIMITED_EMAILS: 'Vip@Test.it', OPENAI_API_KEY: '' },
      { db: openDatabase(':memory:') },
    )
    const srv = http.createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('{}') }))
    await new Promise<void>((resolve) => srv.listen(0, resolve))
    const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`
    const go = async (path: string, cookie: string, body?: BodyInit, headers: Record<string, string> = {}) =>
      fetch(url + path, { method: body ? 'PUT' : 'POST', headers: { 'X-Requested-With': 'capocantiere', Cookie: cookie, ...headers }, body: body ?? '{"messages":[]}' })
    const reg = async (email: string) => {
      const r = await fetch(url + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'capocantiere' }, body: JSON.stringify({ email, password: 'password123' }) })
      return r.headers.get('set-cookie')!.split(';')[0]
    }
    const normal = await reg('normale@test.it')
    const vip = await reg('vip@test.it')
    const meta = encodeURIComponent(JSON.stringify({ projectId: 'p', name: 'x', createdAt: '2026-01-01T00:00:00Z' }))
    const big = new Uint8Array(700_000)
    const photo = (id: string, cookie: string) => go(`/api/data/photos/${id}`, cookie, big, { 'Content-Type': 'image/jpeg', 'x-photo-meta': meta })
    for (const cookie of [normal, vip]) await go('/api/ai/chat', cookie)
    expect((await go('/api/ai/chat', normal)).status).toBe(429)
    expect((await go('/api/ai/chat', vip)).status).not.toBe(429)
    await photo('a', normal)
    await photo('a', vip)
    expect((await photo('b', normal)).status).toBe(413)
    expect((await photo('b', vip)).status).toBe(200)
    srv.close()
  })
})

describe('protezioni aggiuntive', () => {
  let cookie = ''

  it('ricaricare la pagina molte volte non blocca l’accesso (me non consuma il limite)', async () => {
    for (let i = 0; i < 40; i += 1) expect((await call('GET', '/api/auth/me')).status).toBe(200)
    const reg = await call('POST', '/api/auth/register', { email: 'h@test.it', password: 'password123' })
    expect(reg.status).toBe(201)
    cookie = reg.cookie
  })

  it('un cookie malformato di altri servizi non rompe la sessione', async () => {
    expect(parseCookies('a=%zz; cc_session=abc; b=ok')).toEqual({ cc_session: 'abc', b: 'ok' })
    const me = await call('GET', '/api/auth/me', undefined, `bad=%E0%A4%A; ${cookie}`)
    expect(me.json.user.email).toBe('h@test.it')
  })

  it('la password sbagliata negli endpoint account non risponde 401 (non sloggare l’interfaccia)', async () => {
    expect((await call('POST', '/api/account/password', { current: 'sbagliata', next: 'nuovapassword1' }, cookie)).status).toBe(403)
    expect((await call('POST', '/api/account/delete', { password: 'sbagliata' }, cookie)).status).toBe(403)
  })

  it('il logo del profilo deve essere un’immagine incorporata, non un indirizzo esterno', async () => {
    await call('PUT', '/api/data/profile', { businessName: 'A', logo: 'https://tracker.example/pixel.png' }, cookie)
    expect((await call('GET', '/api/data/profile', undefined, cookie)).json.profile.logo).toBe('')
    await call('PUT', '/api/data/profile', { logo: 'data:image/png;base64,AAAA' }, cookie)
    expect((await call('GET', '/api/data/profile', undefined, cookie)).json.profile.logo).toBe('data:image/png;base64,AAAA')
  })

  it('lo spazio comprende foto e fascicoli e si ferma al limite', async () => {
    const meta = encodeURIComponent(JSON.stringify({ projectId: 'p', name: 'x', createdAt: '2026-01-01T00:00:00Z' }))
    const big = new Uint8Array(700_000)
    const put = (id: string) => call('PUT', `/api/data/photos/${id}`, big, cookie, { 'Content-Type': 'image/jpeg', 'x-photo-meta': meta })
    expect((await put('f1')).status).toBe(200)
    expect((await put('f2')).status).toBe(413) // 1,4 MB > 1 MB di limite
  })

  it('gli identificativi non validi sono rifiutati e l’isolamento tra utenti regge', async () => {
    expect((await call('PUT', '/api/data/projects/..%2Fx', { id: '..%2Fx', updatedAt: 'a' }, cookie)).status).toBe(400)
    const other = await call('POST', '/api/auth/register', { email: 'k@test.it', password: 'password123' })
    expect((await call('GET', '/api/data/photos/f1', undefined, other.cookie)).status).toBe(404)
    expect((await call('GET', '/api/data/projects/p/photos', undefined, other.cookie)).json.photos).toEqual([])
  })

  it('senza APP_URL non si generano link di reset basati sull’intestazione Host', async () => {
    const overview = await call('GET', '/api/admin/overview', undefined, cookie)
    const link = await call('POST', '/api/admin/reset-link', { userId: overview.json.users[0].id }, cookie)
    expect(link.status).toBe(409)
  })

  it('metodi e percorsi imprevisti rispondono con errori puliti, non con eccezioni', async () => {
    for (const [method, path] of [['DELETE', '/api/data/export'], ['POST', '/api/data/projects'], ['GET', '/api/data/niente'], ['GET', '/api/admin/niente'], ['POST', '/api/auth/niente']] as const) {
      const r = await call(method, path, method === 'POST' ? {} : undefined, cookie)
      expect(r.status, `${method} ${path}`).toBeGreaterThanOrEqual(400)
      expect(r.status, `${method} ${path}`).toBeLessThan(500)
    }
  })
})
