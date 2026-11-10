import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Project, StoredPhoto } from '../domain/types'
import { deleteProjectCascade, listPhotos, listProjects, putPhoto, putProject } from '../storage/db'

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

  useEffect(() => {
    listProjects()
      .then((rows) => {
        setProjects(rows)
        setReady(true)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Archivio del browser non disponibile.')
        setReady(true)
      })
  }, [])

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
