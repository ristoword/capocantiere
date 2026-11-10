import { useEffect, useState } from 'react'
import type { StoredPhoto } from '../../domain/types'
import { useStore } from '../../context/Store'

export interface ViewPhoto extends StoredPhoto {
  url: string
}

export function useProjectPhotos(projectId: string, version: number): ViewPhoto[] {
  const { photosFor } = useStore()
  const [photos, setPhotos] = useState<ViewPhoto[]>([])

  useEffect(() => {
    let cancelled = false
    const created: string[] = []
    photosFor(projectId)
      .then((list) => {
        if (cancelled) return
        setPhotos(
          list.map((photo) => {
            const url = URL.createObjectURL(photo.blob)
            created.push(url)
            return { ...photo, url }
          }),
        )
      })
      .catch(() => {
        if (!cancelled) setPhotos([])
      })
    return () => {
      cancelled = true
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [photosFor, projectId, version])

  return photos
}
