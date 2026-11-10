import type { JobBody, Settings, VideoHit } from '../domain/types'
import { tradeById } from '../domain/trades'
import { completeJson, ModelError } from './api'

/** Cerca video reali su YouTube tramite il server locale. Mai titoli inventati. */
export async function findVideos(query: string): Promise<VideoHit[]> {
  let response: Response
  try {
    response = await fetch(`/api/yt/search?q=${encodeURIComponent(query)}`)
  } catch {
    throw new ModelError('Non riesco a cercare i video: controlla la rete e che l’app sia avviata con npm run dev.')
  }
  let data: { videos?: VideoHit[]; error?: { message?: string } }
  try {
    data = await response.json()
  } catch {
    throw new ModelError('La ricerca video non risponde. Avvia l’app con npm run dev (o npm start).')
  }
  if (!response.ok) throw new ModelError(data.error?.message || 'Ricerca video non riuscita.')
  return data.videos ?? []
}

export const wantsVideo = (text: string): boolean => /\b(video|tutorial|youtube|guardare|vedere come|mostrami)\b/i.test(text)

/** Fa scrivere all'AI una buona ricerca YouTube in base alla domanda; se fallisce usa mestiere + domanda. */
export async function videoQueryFor(settings: Settings, job: JobBody, question: string): Promise<string> {
  const trade = tradeById(job.trade).name
  const fallback = `${trade} ${question} tutorial`.slice(0, 120)
  try {
    const parsed = await completeJson(
      settings,
      'Scrivi UNA ricerca YouTube in italiano (massimo 8 parole) che trovi un tutorial pratico, da artigiano, su ciò che chiede l’utente. Rispondi solo con JSON {"query": "..."}.',
      `Mestiere: ${trade}. Lavoro: ${job.title}. Domanda dell’utente: ${question}`,
      [],
    )
    const query = (parsed as { query?: unknown })?.query
    return typeof query === 'string' && query.trim() ? query.trim().slice(0, 120) : fallback
  } catch {
    return fallback
  }
}
