import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Project, StoredPhoto } from '../domain/types'
import { deleteProjectCascade, listPhotos, listProjects, putPhoto, putProject } from '../storage/db'
import { listPhotos as localPhotos, listProjects as localProjects } from '../storage/localdb'
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
    await putPhoto(photo)
  }, [])

  const photosFor = useCallback((projectId: string) => listPhotos(projectId), [])

  const value = useMemo(
    () => ({ ready, error, projects, saveProject, removeProject, addPhoto, photosFor }),
    [ready, error, projects, saveProject, removeProject, addPhoto, photosFor],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('Archivio non inizializzato')
  return value
}
