import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '../domain/types'

const store = new Map<string, string>()
const project = (id: string, updatedAt = '2026-01-01T00:00:00Z') => ({ id, title: id, updatedAt }) as unknown as Project
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function stubBrowser(setItem?: (key: string, value: string) => void) {
  store.clear()
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      setItem?.(key, value)
      store.set(key, value)
    },
    removeItem: (key: string) => void store.delete(key),
  })
}

describe('archivio con coda offline', () => {
  beforeEach(() => {
    vi.resetModules()
    stubBrowser()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('senza rete mette le modifiche in coda (una per fascicolo) e le invia al ritorno della connessione', async () => {
    const db = await import('./db')
    db.configureStorage('u1')
    const sent: string[] = []
    let online = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!online) throw new TypeError('rete assente')
        sent.push(`${init?.method ?? 'GET'} ${url}`)
        return json({ ok: true, projects: [] })
      }),
    )
    await db.putProject(project('a'))
    await db.putProject(project('a', '2026-01-02T00:00:00Z')) // sostituisce la precedente
    await db.putProject(project('b', '2026-02-01T00:00:00Z'))
    await db.deleteProjectCascade('a')
    expect(db.pendingChanges()).toBe(2) // put b + delete a
    expect((await db.listProjects()).map((item) => item.id)).toEqual(['b']) // offline: dalla copia locale

    online = true
    await db.flushQueue()
    expect(db.pendingChanges()).toBe(0)
    expect(sent).toEqual(['PUT /api/data/projects/b', 'DELETE /api/data/projects/a'])
  })

  it('una modifica fatta mentre la coda si svuota non viene persa', async () => {
    const db = await import('./db')
    db.configureStorage('u1')
    let online = false
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const sent: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!online) throw new TypeError('rete assente')
        sent.push(`${init?.method} ${url}`)
        if (url.endsWith('/a')) await gate // il primo invio resta "in volo"
        return json({ ok: true })
      }),
    )
    await db.putProject(project('a'))
    online = true
    const flush = db.flushQueue()
    await new Promise((resolve) => setTimeout(resolve, 5))
    await db.putProject(project('c')) // arriva durante l'invio di "a": va accodata, in ordine
    release()
    await flush
    await db.flushQueue()
    expect(sent).toEqual(['PUT /api/data/projects/a', 'PUT /api/data/projects/c'])
    expect(db.pendingChanges()).toBe(0)
  })

  it('una modifica rifiutata dal server non blocca quelle successive e viene segnalata', async () => {
    const db = await import('./db')
    db.configureStorage('u1')
    let online = false
    const sent: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!online) throw new TypeError('rete assente')
        sent.push(`${init?.method} ${url}`)
        return url.endsWith('/bad') ? json({ error: { message: 'Fascicolo non valido' } }, 400) : json({ ok: true })
      }),
    )
    await db.putProject(project('bad'))
    await db.putProject(project('good'))
    await new Promise((resolve) => setTimeout(resolve, 10)) // lascia finire il tentativo offline in background
    online = true
    await db.flushQueue()
    expect(sent).toEqual(['PUT /api/data/projects/bad', 'PUT /api/data/projects/good'])
    expect(db.pendingChanges()).toBe(0)
    expect(db.syncProblem()).toContain('Fascicolo non valido')
  })

  it('a sessione scaduta (401) la coda resta intatta', async () => {
    const db = await import('./db')
    db.configureStorage('u1')
    let mode: 'off' | 'expired' = 'off'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (mode === 'off') throw new TypeError('rete assente')
        return json({ error: { message: 'Accedi per continuare.' } }, 401)
      }),
    )
    vi.stubGlobal('window', Object.assign(new EventTarget(), {}))
    await db.putProject(project('a'))
    mode = 'expired'
    await expect(db.flushQueue()).rejects.toThrow()
    expect(db.pendingChanges()).toBe(1)
    expect(db.syncProblem()).toBeNull()
  })

  it('con altre modifiche già in coda anche le nuove si accodano, per mantenere l’ordine', async () => {
    const db = await import('./db')
    db.configureStorage('u1')
    let online = false
    const sent: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!online) throw new TypeError('rete assente')
        sent.push(`${init?.method} ${url}`)
        return json({ ok: true })
      }),
    )
    await db.putProject(project('uno'))
    online = true
    await db.putProject(project('due')) // la rete è tornata, ma "uno" deve partire per primo
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(sent).toEqual(['PUT /api/data/projects/uno', 'PUT /api/data/projects/due'])
  })

  it('se la memoria del dispositivo è piena lo dice, invece di far credere che sia salvato', async () => {
    stubBrowser((key) => {
      if (key.startsWith('capocantiere-queue-')) throw new DOMException('piena', 'QuotaExceededError')
    })
    const db = await import('./db')
    db.configureStorage('u1')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('rete assente') }))
    await expect(db.putProject(project('x'))).rejects.toThrow('Memoria del dispositivo piena')
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

  it('un errore del server sul salvataggio diretto viene mostrato e non finisce in coda', async () => {
    const db = await import('./db')
    db.configureStorage('u1')
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { message: 'Fascicolo non valido' } }, 400)))
    await expect(db.putProject(project('x'))).rejects.toThrow('Fascicolo non valido')
    expect(db.pendingChanges()).toBe(0)
  })
})
