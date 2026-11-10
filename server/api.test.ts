import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error modulo JS senza tipi
import { createApi } from './api.mjs'
// @ts-expect-error modulo JS senza tipi
import { openDatabase } from './db.mjs'

let server: http.Server
let base = ''

async function call(method: string, path: string, body?: unknown, cookie = '', extra: Record<string, string> = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'capocantiere',
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* binario */
  }
  const setCookie = response.headers.get('set-cookie')?.split(';')[0] ?? ''
  return { status: response.status, json, cookie: setCookie }
}

beforeAll(async () => {
  const api = createApi({ INVITE_CODE: 'segreto', AI_DAILY_LIMIT: '2', OPENAI_API_KEY: '' }, { db: openDatabase(':memory:') })
  server = http.createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('x') }))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterAll(() => server.close())

describe('accesso', () => {
  it('rifiuta registrazione senza codice invito', async () => {
    const r = await call('POST', '/api/auth/register', { email: 'a@b.it', password: 'password123' })
    expect(r.status).toBe(403)
  })
  it('rifiuta password corta e email errata', async () => {
    expect((await call('POST', '/api/auth/register', { email: 'a@b.it', password: 'corta', invite: 'segreto' })).status).toBe(400)
    expect((await call('POST', '/api/auth/register', { email: 'no', password: 'password123', invite: 'segreto' })).status).toBe(400)
  })
  it('senza accesso le API dati e AI sono negate', async () => {
    expect((await call('GET', '/api/data/projects')).status).toBe(401)
    expect((await call('POST', '/api/ai/chat', { messages: [] })).status).toBe(401)
    expect((await call('GET', '/api/yt/search?q=x')).status).toBe(401)
  })
  it('blocca scritture senza intestazione anti-CSRF', async () => {
    const response = await fetch(base + '/api/auth/login', { method: 'POST', body: '{}' })
    expect(response.status).toBe(403)
  })
})

describe('utente, dati e limiti', () => {
  let cookie = ''
  it('registra, entra e vede il proprio profilo', async () => {
    const r = await call('POST', '/api/auth/register', { email: 'Mario@Test.it', password: 'password123', name: 'Mario', invite: 'segreto' })
    expect(r.status).toBe(201)
    cookie = r.cookie
    const me = await call('GET', '/api/auth/me', undefined, cookie)
    expect(me.json.user.email).toBe('mario@test.it')
    expect(me.json.user.isAdmin).toBe(true)
  })
  it('login con password errata fallisce, con quella giusta riesce', async () => {
    expect((await call('POST', '/api/auth/login', { email: 'mario@test.it', password: 'sbagliata1' })).status).toBe(401)
    expect((await call('POST', '/api/auth/login', { email: 'mario@test.it', password: 'password123' })).status).toBe(200)
  })
  it('salva, rilegge ed elimina un fascicolo con le foto', async () => {
    const project = { id: 'p1', title: 'Bagno', updatedAt: '2026-01-01T00:00:00Z' }
    expect((await call('PUT', '/api/data/projects/p1', project, cookie)).status).toBe(200)
    const list = await call('GET', '/api/data/projects', undefined, cookie)
    expect(list.json.projects).toHaveLength(1)
    const meta = encodeURIComponent(JSON.stringify({ projectId: 'p1', phaseId: null, name: 'f.jpg', createdAt: '2026-01-01T00:00:00Z' }))
    const up = await fetch(base + '/api/data/photos/ph1', {
      method: 'PUT',
      headers: { 'X-Requested-With': 'capocantiere', Cookie: cookie, 'Content-Type': 'image/jpeg', 'x-photo-meta': meta },
      body: new Uint8Array([1, 2, 3, 4]),
    })
    expect(up.status).toBe(200)
    expect((await call('GET', '/api/data/projects/p1/photos', undefined, cookie)).json.photos).toHaveLength(1)
    const got = await fetch(base + '/api/data/photos/ph1', { headers: { Cookie: cookie } })
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]))
    expect((await call('DELETE', '/api/data/projects/p1', undefined, cookie)).status).toBe(200)
    expect((await call('GET', '/api/data/projects/p1/photos', undefined, cookie)).json.photos).toHaveLength(0)
  })
  it('un altro utente non vede i dati altrui', async () => {
    await call('PUT', '/api/data/projects/p2', { id: 'p2', updatedAt: '2026-01-02T00:00:00Z' }, cookie)
    const other = await call('POST', '/api/auth/register', { email: 'altro@test.it', password: 'password123', invite: 'segreto' })
    const list = await call('GET', '/api/data/projects', undefined, other.cookie)
    expect(list.json.projects).toHaveLength(0)
    expect((await call('GET', '/api/auth/me', undefined, other.cookie)).json.user.isAdmin).toBe(false)
  })
  it('esporta e reimporta il backup', async () => {
    const backup = await call('GET', '/api/data/export', undefined, cookie)
    expect(backup.json.projects.map((p: { id: string }) => p.id)).toContain('p2')
    const imported = await call('POST', '/api/data/import', backup.json, cookie)
    expect(imported.json.projects).toBe(1)
    expect((await call('POST', '/api/data/import', { nope: true }, cookie)).status).toBe(400)
  })
  it('applica il limite giornaliero dell’AI', async () => {
    const first = await call('POST', '/api/ai/chat', { messages: [] }, cookie)
    const second = await call('POST', '/api/ai/chat', { messages: [] }, cookie)
    const third = await call('POST', '/api/ai/chat', { messages: [] }, cookie)
    expect([first.status, second.status]).not.toContain(429)
    expect(third.status).toBe(429)
  })
  it('cambia password ed elimina l’account con tutti i dati', async () => {
    expect((await call('POST', '/api/account/password', { current: 'x', next: 'nuovapassword1' }, cookie)).status).toBe(403)
    const changed = await call('POST', '/api/account/password', { current: 'password123', next: 'nuovapassword1' }, cookie)
    expect(changed.status).toBe(200)
    cookie = changed.cookie
    // L'unico amministratore non può sparire finché esistono altri utenti.
    expect((await call('POST', '/api/account/delete', { password: 'nuovapassword1' }, cookie)).status).toBe(409)
    const other = await call('POST', '/api/auth/login', { email: 'altro@test.it', password: 'password123' })
    expect((await call('POST', '/api/account/delete', { password: 'password123' }, other.cookie)).status).toBe(200)
    expect((await call('POST', '/api/account/delete', { password: 'nuovapassword1' }, cookie)).status).toBe(200)
    expect((await call('GET', '/api/data/projects', undefined, cookie)).status).toBe(401)
    expect((await call('POST', '/api/auth/login', { email: 'mario@test.it', password: 'nuovapassword1' })).status).toBe(401)
  })
})
