import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error modulo JS senza tipi
import { createApi } from './api.mjs'
// @ts-expect-error modulo JS senza tipi
import { makeBackup } from './backup.mjs'
// @ts-expect-error modulo JS senza tipi
import { openDatabase } from './db.mjs'

async function boot(file: string) {
  const db = openDatabase(file)
  const api = createApi({ SIGNUP_OPEN: 'true', DATA_DIR: path.dirname(file) }, { db })
  const server = http.createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('{}') }))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const call = async (method: string, url: string, body?: unknown, cookie = '', headers: Record<string, string> = {}) => {
    const response = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'capocantiere', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' || body instanceof Uint8Array ? (body as BodyInit) : JSON.stringify(body),
    })
    const buffer = new Uint8Array(await response.arrayBuffer())
    let json: any = null
    try {
      json = JSON.parse(new TextDecoder().decode(buffer))
    } catch {
      /* binario */
    }
    return { status: response.status, json, buffer, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' }
  }
  const stop = () => new Promise<void>((resolve) => server.close(() => { db.close(); resolve() }))
  return { call, stop, db }
}

describe('persistenza dei dati', () => {
  it('dopo un riavvio del server restano utenti, sessioni, lavori, foto, listino e profilo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-persist-'))
    const file = path.join(dir, 'capocantiere.db')

    const first = await boot(file)
    const reg = await first.call('POST', '/api/auth/register', { email: 'p@test.it', password: 'password123', name: 'Paolo' })
    const cookie = reg.cookie
    await first.call('PUT', '/api/data/projects/job1', { id: 'job1', title: 'Bagno', updatedAt: '2026-03-01T10:00:00Z', status: 'accettato' }, cookie)
    const photo = new Uint8Array(Array.from({ length: 5000 }, (_, i) => i % 251))
    const meta = encodeURIComponent(JSON.stringify({ projectId: 'job1', phaseId: null, name: 'a.jpg', createdAt: '2026-03-01T10:01:00Z' }))
    expect((await first.call('PUT', '/api/data/photos/foto1', photo, cookie, { 'Content-Type': 'image/jpeg', 'x-photo-meta': meta })).status).toBe(200)
    await first.call('PUT', '/api/data/prices', { 'labor.elettrica': 61 }, cookie)
    await first.call('PUT', '/api/data/profile', { businessName: 'Rossi Srl' }, cookie)
    await first.stop()

    // Riavvio: stesso file, nuovo processo applicativo.
    const second = await boot(file)
    expect((await second.call('GET', '/api/auth/me', undefined, cookie)).json.user.email).toBe('p@test.it')
    const projects = (await second.call('GET', '/api/data/projects', undefined, cookie)).json.projects
    expect(projects).toEqual([{ id: 'job1', title: 'Bagno', updatedAt: '2026-03-01T10:00:00Z', status: 'accettato' }])
    expect((await second.call('GET', '/api/data/prices', undefined, cookie)).json.prices).toEqual({ 'labor.elettrica': 61 })
    expect((await second.call('GET', '/api/data/profile', undefined, cookie)).json.profile.businessName).toBe('Rossi Srl')
    const got = await second.call('GET', '/api/data/photos/foto1', undefined, cookie)
    expect(Array.from(got.buffer)).toEqual(Array.from(photo))
    expect((await second.call('POST', '/api/auth/login', { email: 'p@test.it', password: 'password123' })).status).toBe(200)

    // La copia di sicurezza è un database completo e leggibile.
    const copy = makeBackup(second.db, path.join(dir, 'backups'))
    await second.stop()
    const restored = await boot(copy)
    expect((await restored.call('POST', '/api/auth/login', { email: 'p@test.it', password: 'password123' })).status).toBe(200)
    await restored.stop()
  })

  it('il file del database è migrato senza perdere dati quando parte una versione più nuova', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-migrate-'))
    const file = path.join(dir, 'old.db')
    const db = openDatabase(file)
    db.prepare("INSERT INTO users (id, email, name, pass_hash, created_at) VALUES ('u', 'a@b.it', '', 'x', 'n')").run()
    db.exec('PRAGMA user_version = 1') // come un database creato dalla prima versione
    db.exec('DROP TABLE spend; DROP TABLE reset_tokens;')
    db.close()
    const upgraded = openDatabase(file)
    expect(Number(upgraded.prepare('PRAGMA user_version').get().user_version)).toBeGreaterThanOrEqual(2)
    expect(upgraded.prepare('SELECT email FROM users').get().email).toBe('a@b.it')
    expect(upgraded.prepare("SELECT name FROM sqlite_master WHERE name = 'spend'").get()).toBeTruthy()
    upgraded.close()
  })
})
