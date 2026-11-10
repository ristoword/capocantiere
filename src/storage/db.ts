import type { Project, StoredPhoto } from '../domain/types'

const DB_NAME = 'capocantiere'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('photos')) {
        const store = db.createObjectStore('photos', { keyPath: 'id' })
        store.createIndex('byProject', 'projectId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB non disponibile'))
  })
}

function finish(tx: IDBTransaction, fail: (error: unknown) => void, ok: () => void) {
  tx.oncomplete = () => ok()
  tx.onerror = () => fail(tx.error ?? new Error('Transazione non riuscita'))
  tx.onabort = () => fail(tx.error ?? new Error('Transazione annullata'))
}

export async function listProjects(): Promise<Project[]> {
  const db = await openDb()
  const rows = await new Promise<Project[]>((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly')
    finish(tx, reject, () => undefined)
    const request = tx.objectStore('projects').getAll()
    request.onsuccess = () => resolve(request.result as Project[])
    request.onerror = () => reject(request.error)
  })
  return rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function putProject(project: Project): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite')
    finish(tx, reject, resolve)
    tx.objectStore('projects').put(project)
  })
}

export async function deleteProjectCascade(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['projects', 'photos'], 'readwrite')
    finish(tx, reject, resolve)
    const photos = tx.objectStore('photos')
    const request = photos.index('byProject').getAll(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      for (const photo of request.result as StoredPhoto[]) photos.delete(photo.id)
      tx.objectStore('projects').delete(id)
    }
  })
}

export async function putPhoto(photo: StoredPhoto): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite')
    finish(tx, reject, resolve)
    tx.objectStore('photos').put(photo)
  })
}

export async function listPhotos(projectId: string): Promise<StoredPhoto[]> {
  const db = await openDb()
  const rows = await new Promise<StoredPhoto[]>((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly')
    finish(tx, reject, () => undefined)
    const request = tx.objectStore('photos').index('byProject').getAll(projectId)
    request.onsuccess = () => resolve(request.result as StoredPhoto[])
    request.onerror = () => reject(request.error)
  })
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
}
