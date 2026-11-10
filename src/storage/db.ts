import type { Project, StoredPhoto } from '../domain/types'
import { api, ApiError } from '../lib/http'
import { deleteProjectCascade as localDelete, listPhotos as localPhotos, putPhoto as localPutPhoto } from './localdb'

/**
 * Archivio sul server (SQLite), legato all'account.
 * Se manca la rete, i dati letti restano in una copia locale e le modifiche vanno in coda:
 * si sincronizzano da sole appena torna la connessione.
 */

type Op = { type: 'put'; project: Project } | { type: 'delete'; id: string }

let owner = ''
let flushing: Promise<void> | null = null

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

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* spazio finito o archivio bloccato: si lavora senza copia locale */
  }
}

const notify = () => window.dispatchEvent(new Event(SYNC_EVENT))
const isOffline = (error: unknown) => error instanceof ApiError && error.status === 0

/** Indica a chi appartengono i dati in copia locale (si chiama all'accesso). */
export function configureStorage(userId: string): void {
  owner = userId
}

export function pendingChanges(): number {
  return read<Op[]>(queueKey(), []).length + read<string[]>(photoQueueKey(), []).length
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
  write(cacheKey(), mutate(read<Project[]>(cacheKey(), [])))
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

/** Invia al server le modifiche fatte senza rete. Si ferma al primo errore di rete. */
export function flushQueue(): Promise<void> {
  if (flushing) return flushing
  flushing = (async () => {
    try {
      const ops = read<Op[]>(queueKey(), [])
      while (ops.length > 0) {
        await sendOp(ops[0])
        ops.shift()
        write(queueKey(), ops)
        notify()
      }
      const pendingPhotos = read<string[]>(photoQueueKey(), [])
      for (const id of [...pendingPhotos]) {
        const photo = (await localPhotos(id.split('|')[0])).find((item) => item.id === id.split('|')[1])
        if (photo) await uploadPhoto(photo)
        pendingPhotos.splice(pendingPhotos.indexOf(id), 1)
        write(photoQueueKey(), pendingPhotos)
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
  const ops = read<Op[]>(queueKey(), [])
  try {
    await flushQueue().catch(() => undefined)
    const { projects } = await api<{ projects: Project[] }>('/api/data/projects')
    const remaining = read<Op[]>(queueKey(), [])
    const merged = applyOps(projects, remaining)
    write(cacheKey(), merged)
    return merged
  } catch (error) {
    if (isOffline(error)) return applyOps(read<Project[]>(cacheKey(), []), ops)
    throw error
  }
}

export async function putProject(project: Project): Promise<void> {
  updateCache((list) => applyOps(list, [{ type: 'put', project }]))
  try {
    await sendOp({ type: 'put', project })
  } catch (error) {
    if (!isOffline(error)) throw error
    const ops = read<Op[]>(queueKey(), [])
    ops.push({ type: 'put', project })
    write(queueKey(), ops)
    notify()
  }
}

export async function deleteProjectCascade(id: string): Promise<void> {
  updateCache((list) => applyOps(list, [{ type: 'delete', id }]))
  try {
    await sendOp({ type: 'delete', id })
  } catch (error) {
    if (!isOffline(error)) throw error
    const ops = read<Op[]>(queueKey(), [])
    ops.push({ type: 'delete', id })
    write(queueKey(), ops)
    notify()
  }
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
    write(photoQueueKey(), queue)
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
  const waiting = (await localPhotos(projectId).catch(() => [])).filter((item) =>
    read<string[]>(photoQueueKey(), []).includes(`${projectId}|${item.id}`),
  )
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
