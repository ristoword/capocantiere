import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '../domain/types'

const store = new Map<string, string>()
const project = (id: string, updatedAt = '2026-01-01T00:00:00Z') => ({ id, title: id, updatedAt }) as unknown as Project

function stubBrowser() {
  store.clear()
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
}

describe('archivio con coda offline', () => {
  beforeEach(() => {
    vi.resetModules()
    stubBrowser()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('senza rete mette le modifiche in coda e le invia al ritorno della connessione', async () => {
    const db = await import('./db')
    db.configureStorage('u1')
    const sent: string[] = []
    let online = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!online) throw new TypeError('rete assente')
        sent.push(`${init?.method ?? 'GET'} ${url}`)
        return new Response(JSON.stringify({ ok: true, projects: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }),
    )
    await db.putProject(project('a'))
    await db.putProject(project('b', '2026-02-01T00:00:00Z'))
    await db.deleteProjectCascade('a')
    expect(db.pendingChanges()).toBe(3)
    // Offline: la lista arriva dalla copia locale con le modifiche applicate.
    expect((await db.listProjects()).map((item) => item.id)).toEqual(['b'])

    online = true
    await db.flushQueue()
    expect(db.pendingChanges()).toBe(0)
    expect(sent).toEqual(['PUT /api/data/projects/a', 'PUT /api/data/projects/b', 'DELETE /api/data/projects/a'])
  })

  it('i dati di un utente non finiscono nella copia di un altro', async () => {
    const db = await import('./db')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('rete assente') }))
    db.configureStorage('u1')
    await db.putProject(project('mio'))
    db.configureStorage('u2')
    expect(await db.listProjects()).toEqual([])
    expect(db.pendingChanges()).toBe(0)
  })

  it('un errore del server non finisce in coda: viene mostrato', async () => {
    const db = await import('./db')
    db.configureStorage('u1')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Fascicolo non valido' } }), { status: 400, headers: { 'Content-Type': 'application/json' } })))
    await expect(db.putProject(project('x'))).rejects.toThrow('Fascicolo non valido')
    expect(db.pendingChanges()).toBe(0)
  })
})
