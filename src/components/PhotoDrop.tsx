import { useRef, useState, type ReactNode } from 'react'

/** Zona di caricamento foto: click, trascinamento o fotocamera. Restituisce solo immagini valide. */
export function PhotoDrop({
  onFiles,
  onReject,
  light,
  title = 'Carica o trascina qui le foto',
  hint = 'Scatta una foto o scegli dalla galleria. Va bene anche più di una.',
  children,
}: {
  onFiles: (files: File[]) => void
  onReject?: (message: string) => void
  light?: boolean
  title?: string
  hint?: string
  children?: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  function take(list: FileList | null) {
    if (!list) return
    const good: File[] = []
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('image/')) {
        onReject?.(`«${file.name}» non è un’immagine.`)
        continue
      }
      if (file.size > 12 * 1024 * 1024) {
        onReject?.(`«${file.name}» supera 12 MB.`)
        continue
      }
      good.push(file)
    }
    if (good.length) onFiles(good)
  }

  return (
    <div
      className={`drop${light ? ' light' : ''}${over ? ' over' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={() => input.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          input.current?.click()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        take(event.dataTransfer.files)
      }}
    >
      <span className="big-ico">📷</span>
      <strong>{title}</strong>
      <small>{hint}</small>
      {children}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          take(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
