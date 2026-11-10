import { useState } from 'react'
import type { VideoHit } from '../../domain/types'
import { findVideos } from '../../lib/videos'

/** Elenco di video con riproduzione dentro l'app (youtube-nocookie) e link per aprirli su YouTube. */
export function VideoList({ videos, query }: { videos: VideoHit[]; query: string }) {
  const [playing, setPlaying] = useState<string | null>(videos.length === 1 ? videos[0].id : null)
  if (videos.length === 0) {
    return (
      <p className="help">
        Nessun video trovato per «{query}».{' '}
        <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer">
          Cerca su YouTube
        </a>
      </p>
    )
  }
  return (
    <div className="videos">
      <ul className="video-grid">
        {videos.map((video) => (
          <li key={video.id} className="video-card">
            {playing === video.id ? (
              <div className="video-frame">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
                  title={video.title}
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : (
              <button type="button" className="video-thumb" onClick={() => setPlaying(video.id)} aria-label={`Guarda: ${video.title}`}>
                <img src={video.thumb} alt="" loading="lazy" />
                <span className="play">▶</span>
                {video.duration ? <span className="dur">{video.duration}</span> : null}
              </button>
            )}
            <div className="video-info">
              <strong>{video.title}</strong>
              <small>{video.channel}</small>
              <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">
                Apri su YouTube ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="help">
        Video trovati su YouTube per «{query}»: sono di terzi, verifica che il metodo valga per il tuo caso.
      </p>
    </div>
  )
}

/** Pulsante che cerca i video per una query e li mostra sotto. */
export function VideoShelf({ query, label = '📺 Guarda i video tutorial' }: { query: string; label?: string }) {
  const [videos, setVideos] = useState<VideoHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            setVideos(await findVideos(query))
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Ricerca video non riuscita.')
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? '📺 Cerco i video…' : videos ? '📺 Aggiorna i video' : label}
      </button>
      {error ? <p className="banner err">{error}</p> : null}
      {videos ? <VideoList videos={videos} query={query} /> : null}
    </>
  )
}
