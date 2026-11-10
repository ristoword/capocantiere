import type { Project, StoredPhoto } from '../domain/types'
import { api, ApiError } from '../lib/http'
import { deleteProjectCascade as localDelete, listPhotos as localPhotos, putPhoto as localPutPhoto } from './localdb'

/**
 * Archivio sul server (SQLite), legato all'account.
 * Se manca la rete, i dati letti restano in una copia locale e le modifiche vanno in coda:
 * si sincronizzano da sole appena torna la connessione, nello stesso ordine in cui sono state fatte.
 */

type Op = { opId: string; type: 'put'; project: Project } | { opId: string; type: 'delete'; id: string }

let owner = ''
let flushing: Promise<void> | null = null
let problem: string | null = null

export const SYNC_EVENT = 'capocantiere-sync'

const cacheKey = () => `capocantiere-cache-${owner}`
const queueKey = () => `capocantiere-queue-${owner}`
const photoQueueKey = () => `capocantiere-photoqueue-${owner}`

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** Scrittura della copia locale: se fallisce non si finge nulla, si segnala. */
function writeStrict(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error('Memoria del dispositivo piena: la modifica non è stata salvata offline. Libera spazio e riprova.')
  }
}

/** Scrittura della sola cache di lettura: se manca lo spazio si lavora senza copia. */
function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* nessuna copia locale */
  }
}

const notify = () => window.dispatchEvent(new Event(SYNC_EVENT))
const isOffline = (error: unknown) => error instanceof ApiError && error.status === 0
/** Errori definitivi del server (dati rifiutati): riprovare non servirebbe. 401, 408 e 429 si riprovano. */
const isPermanent = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status)

/** Indica a chi appartengono i dati in copia locale (si chiama all'accesso). */
export function configureStorage(userId: string): void {
  owner = userId
}

export function pendingChanges(): number {
  return read<Op[]>(queueKey(), []).length + read<string[]>(photoQueueKey(), []).length
}

/** Ultimo problema di sincronizzazione (es. modifica rifiutata dal server), da mostrare all'utente. */
export function syncProblem(): string | null {
  return problem
}

export function clearSyncProblem(): void {
  problem = null
  notify()
}

function applyOps(list: Project[], ops: Op[]): Project[] {
  let next = [...list]
  for (const op of ops) {
    if (op.type === 'put') next = [...next.filter((item) => item.id !== op.project.id), op.project]
    else next = next.filter((item) => item.id !== op.id)
  }
  return next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

function updateCache(mutate: (list: Project[]) => Project[]): void {
  writeCache(cacheKey(), mutate(read<Project[]>(cacheKey(), [])))
}

const idOf = (op: Op) => (op.type === 'put' ? op.project.id : op.id)

/** Aggiunge una modifica alla coda, tenendo per ogni fascicolo solo l'ultima (meno spazio, stesso risultato). */
function enqueue(op: Op): void {
  const queue = read<Op[]>(queueKey(), []).filter((item) => !(idOf(item) === idOf(op) && (item.type === 'put' || op.type === 'delete')))
  queue.push(op)
  writeStrict(queueKey(), queue)
  notify()
}

function dequeue(opId: string): void {
  const queue = read<Op[]>(queueKey(), []).filter((item) => item.opId !== opId) // si rilegge: nel frattempo può essere cambiata
  writeCache(queueKey(), queue)
  notify()
}

async function sendOp(op: Op): Promise<void> {
  if (op.type === 'put') await api(`/api/data/projects/${encodeURIComponent(op.project.id)}`, { method: 'PUT', body: op.project })
  else await api(`/api/data/projects/${encodeURIComponent(op.id)}`, { method: 'DELETE' })
}

async function uploadPhoto(photo: StoredPhoto): Promise<void> {
  const meta = encodeURIComponent(
    JSON.stringify({ projectId: photo.projectId, phaseId: photo.phaseId, name: photo.name, createdAt: photo.createdAt }),
  )
  await api(`/api/data/photos/${encodeURIComponent(photo.id)}`, {
    method: 'PUT',
    raw: photo.blob,
    headers: { 'Content-Type': photo.blob.type || 'image/jpeg', 'x-photo-meta': meta },
  })
}

/** Invia al server le modifiche fatte senza rete. Si ferma senza perdere nulla se manca la rete o la sessione. */
export function flushQueue(): Promise<void> {
  if (flushing) return flushing
  flushing = (async () => {
    try {
      for (;;) {
        const op = read<Op[]>(queueKey(), [])[0]
        if (!op) break
        try {
          await sendOp(op)
        } catch (error) {
          if (!isPermanent(error)) throw error
          problem = `Una modifica non è stata accettata dal server e non verrà inviata: ${(error as Error).message}`
        }
        dequeue(op.opId)
      }
      for (const entry of [...read<string[]>(photoQueueKey(), [])]) {
        const [projectId, photoId] = entry.split('|')
        const photo = (await localPhotos(projectId).catch(() => [])).find((item) => item.id === photoId)
        try {
          if (photo) await uploadPhoto(photo)
        } catch (error) {
          if (!isPermanent(error)) throw error
          problem = `Una foto non è stata accettata dal server: ${(error as Error).message}`
        }
        writeCache(photoQueueKey(), read<string[]>(photoQueueKey(), []).filter((item) => item !== entry))
        notify()
      }
    } catch (error) {
      if (!isOffline(error)) throw error
    } finally {
      flushing = null
      notify()
    }
  })()
  return flushing
}

export async function listProjects(): Promise<Project[]> {
  try {
    await flushQueue().catch(() => undefined)
    const { projects } = await api<{ projects: Project[] }>('/api/data/projects')
    const merged = applyOps(projects, read<Op[]>(queueKey(), []))
    writeCache(cacheKey(), merged)
    return merged
  } catch (error) {
    if (isOffline(error)) return applyOps(read<Project[]>(cacheKey(), []), read<Op[]>(queueKey(), []))
    throw error
  }
}

async function submit(op: Op): Promise<void> {
  // Con modifiche già in coda si accoda anche questa: l'ordine delle scritture deve restare quello dell'utente.
  if (read<Op[]>(queueKey(), []).length > 0) {
    enqueue(op)
    void flushQueue().catch(() => undefined)
    return
  }
  try {
    await sendOp(op)
  } catch (error) {
    if (!isOffline(error)) throw error
    enqueue(op)
  }
}

export async function putProject(project: Project): Promise<void> {
  updateCache((list) => applyOps(list, [{ opId: '', type: 'put', project }]))
  await submit({ opId: crypto.randomUUID(), type: 'put', project })
}

export async function deleteProjectCascade(id: string): Promise<void> {
  updateCache((list) => applyOps(list, [{ opId: '', type: 'delete', id }]))
  await submit({ opId: crypto.randomUUID(), type: 'delete', id })
  await localDelete(id).catch(() => undefined)
}

export async function putPhoto(photo: StoredPhoto): Promise<void> {
  try {
    await uploadPhoto(photo)
  } catch (error) {
    if (!isOffline(error)) throw error
    // Senza rete la foto resta in questo dispositivo e parte alla prima connessione.
    await localPutPhoto(photo)
    const queue = read<string[]>(photoQueueKey(), [])
    queue.push(`${photo.projectId}|${photo.id}`)
    writeStrict(photoQueueKey(), queue)
    notify()
  }
}

interface PhotoMeta {
  id: string
  projectId: string
  phaseId: string | null
  name: string
  createdAt: string
}

export async function listPhotos(projectId: string): Promise<StoredPhoto[]> {
  const queued = read<string[]>(photoQueueKey(), [])
  const waiting = (await localPhotos(projectId).catch(() => [])).filter((item) => queued.includes(`${projectId}|${item.id}`))
  try {
    const { photos } = await api<{ photos: PhotoMeta[] }>(`/api/data/projects/${encodeURIComponent(projectId)}/photos`)
    const known = new Set(waiting.map((item) => item.id))
    const remote = await Promise.all(
      photos
        .filter((meta) => !known.has(meta.id))
        .map(async (meta) => {
          const response = await fetch(`/api/data/photos/${encodeURIComponent(meta.id)}`, { credentials: 'same-origin' })
          if (!response.ok) throw new ApiError('Foto non disponibile', response.status)
          return { ...meta, blob: await response.blob() } satisfies StoredPhoto
        }),
    )
    return [...remote, ...waiting].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  } catch (error) {
    if (isOffline(error)) return waiting
    throw error
  }
}
