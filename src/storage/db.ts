import type { Project, StoredPhoto } from '../domain/types'
import { api, ApiError } from '../lib/http'

/** Archivio persistente sul server (SQLite), legato all'account dell'utente. */
export async function listProjects(): Promise<Project[]> {
  const { projects } = await api<{ projects: Project[] }>('/api/data/projects')
  return projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function putProject(project: Project): Promise<void> {
  await api(`/api/data/projects/${encodeURIComponent(project.id)}`, { method: 'PUT', body: project })
}

export async function deleteProjectCascade(id: string): Promise<void> {
  await api(`/api/data/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function putPhoto(photo: StoredPhoto): Promise<void> {
  const meta = encodeURIComponent(
    JSON.stringify({ projectId: photo.projectId, phaseId: photo.phaseId, name: photo.name, createdAt: photo.createdAt }),
  )
  await api(`/api/data/photos/${encodeURIComponent(photo.id)}`, {
    method: 'PUT',
    raw: photo.blob,
    headers: { 'Content-Type': photo.blob.type || 'image/jpeg', 'x-photo-meta': meta },
  })
}

interface PhotoMeta {
  id: string
  projectId: string
  phaseId: string | null
  name: string
  createdAt: string
}

export async function listPhotos(projectId: string): Promise<StoredPhoto[]> {
  const { photos } = await api<{ photos: PhotoMeta[] }>(`/api/data/projects/${encodeURIComponent(projectId)}/photos`)
  const rows = await Promise.all(
    photos.map(async (meta) => {
      const response = await fetch(`/api/data/photos/${encodeURIComponent(meta.id)}`, { credentials: 'same-origin' })
      if (!response.ok) throw new ApiError('Foto non disponibile', response.status)
      return { ...meta, blob: await response.blob() } satisfies StoredPhoto
    }),
  )
  return rows
}
