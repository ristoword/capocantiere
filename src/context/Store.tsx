import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Project, StoredPhoto } from '../domain/types'
import { clearSyncProblem, configureStorage, deleteProjectCascade, flushQueue, listPhotos, listProjects, pendingChanges, putPhoto, putProject, SYNC_EVENT, syncProblem } from '../storage/db'
import { listPhotos as localPhotos, listProjects as localProjects } from '../storage/localdb'
import { shrink } from '../lib/image'
import { useAuth } from './Auth'

/** Porta sul server i lavori salvati finora solo in questo browser (una volta per account). */
async function migrateLocal(userId: string, remote: Project[]): Promise<boolean> {
  const flag = `capocantiere-migrated-${userId}`
  try {
    if (localStorage.getItem(flag)) return false
    const local = await localProjects()
    const known = new Set(remote.map((item) => item.id))
    let moved = false
    for (const project of local) {
      if (known.has(project.id)) continue
      await putProject(project)
      for (const photo of await localPhotos(project.id)) await putPhoto(photo)
      moved = true
    }
    localStorage.setItem(flag, '1')
    return moved
  } catch {
    return false
  }
}

interface StoreValue {
  ready: boolean
  /** Modifiche fatte senza rete, in attesa di essere inviate. */
  pending: number
  online: boolean
  /** Modifica rifiutata dal server durante la sincronizzazione (da mostrare all'utente). */
  problem: string | null
  dismissProblem: () => void
  error: string | null
  projects: Project[]
  saveProject: (project: Project) => Promise<void>
  removeProject: (id: string) => Promise<void>
  addPhoto: (photo: StoredPhoto) => Promise<void>
  photosFor: (projectId: string) => Promise<StoredPhoto[]>
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuth()
  const userId = user?.id
  if (userId) configureStorage(userId)
  const [pending, setPending] = useState(() => (userId ? pendingChanges() : 0))
  const [online, setOnline] = useState(() => navigator.onLine)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => {
      setPending(pendingChanges())
      setProblem(syncProblem())
    }
    const up = () => {
      setOnline(true)
      void flushQueue()
        .then(() => listProjects())
        .then((rows) => setProjects(rows))
        .catch(() => undefined)
    }
    const down = () => setOnline(false)
    window.addEventListener(SYNC_EVENT, sync)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener(SYNC_EVENT, sync)
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    listProjects()
      .then(async (rows) => {
        const moved = await migrateLocal(userId, rows)
        const all = moved ? await listProjects() : rows
        if (alive) {
          setProjects(all)
          setReady(true)
        }
      })
      .catch((reason: unknown) => {
        if (!alive) return
        setError(reason instanceof Error ? reason.message : 'Archivio non raggiungibile.')
        setReady(true)
      })
    return () => {
      alive = false
    }
  }, [userId])

  const saveProject = useCallback(async (project: Project) => {
    await putProject(project)
    setProjects((current) => {
      const next = current.filter((item) => item.id !== project.id)
      next.push(project)
      return next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    })
  }, [])

  const removeProject = useCallback(async (id: string) => {
    await deleteProjectCascade(id)
    setProjects((current) => current.filter((item) => item.id !== id))
  }, [])

  const addPhoto = useCallback(async (photo: StoredPhoto) => {
    // Le foto del telefono pesano 4-12 MB: si salvano ridotte (1600 px, JPEG) per non riempire lo spazio.
    await putPhoto({ ...photo, blob: await shrink(photo.blob) })
  }, [])

  const photosFor = useCallback((projectId: string) => listPhotos(projectId), [])

  const value = useMemo(
    () => ({ ready, pending, online, problem, dismissProblem: clearSyncProblem, error, projects, saveProject, removeProject, addPhoto, photosFor }),
    [ready, pending, online, problem, error, projects, saveProject, removeProject, addPhoto, photosFor],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('Archivio non inizializzato')
  return value
}
