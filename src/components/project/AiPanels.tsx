import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, Phase, PhaseGuide, Project, QuoteReview } from '../../domain/types'
import { blobToDataUrl } from '../../lib/api'
import { chatTurn, currentPhase, explainPhase, reviewQuote } from '../../lib/assistant'
import { shrink } from '../../lib/image'
import { euro } from '../../lib/format'
import { findVideos, videoQueryFor, wantsVideo } from '../../lib/videos'
import { loadSettings } from '../../storage/settings'
import { VideoList } from './VideoShelf'

const errorText = (reason: unknown, fallback: string) => (reason instanceof Error ? reason.message : fallback)

/** Assistente in chat: sa dove sei nel lavoro e ti dice cosa fare ora. */
export function Assistant({ project, onSave }: { project: Project; onSave: (chat: ChatMessage[]) => Promise<void> }) {
  const chat = project.chat ?? []
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoBusy, setVideoBusy] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const phase = currentPhase(project)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [chat.length, busy])

  async function send(raw: string) {
    const question = raw.trim()
    if (!question || busy) return
    setBusy(true)
    setError(null)
    const user: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: question,
      createdAt: new Date().toISOString(),
      withPhoto: photo !== null,
    }
    const withUser = [...chat, user]
    await onSave(withUser)
    setText('')
    try {
      const images = photo ? [await blobToDataUrl(await shrink(photo))] : []
      setPhoto(null)
      const answer = await chatTurn(loadSettings(), project, chat, question, images)
      const reply: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', text: answer, createdAt: new Date().toISOString() }
      let all = [...withUser, reply]
      await onSave(all)
      if (wantsVideo(question)) all = await attachVideos(all, reply.id, question)
    } catch (reason) {
      setError(errorText(reason, 'L’assistente non ha risposto.'))
    } finally {
      setBusy(false)
    }
  }

  async function attachVideos(list: ChatMessage[], messageId: string, question: string): Promise<ChatMessage[]> {
    try {
      const query = await videoQueryFor(loadSettings(), project, question)
      const videos = await findVideos(query)
      const next = list.map((item) => (item.id === messageId ? { ...item, videos, videoQuery: query } : item))
      await onSave(next)
      return next
    } catch (reason) {
      setError(errorText(reason, 'Ricerca video non riuscita.'))
      return list
    }
  }

  async function videosFor(index: number) {
    const target = chat[index]
    const question = [...chat.slice(0, index)].reverse().find((item) => item.role === 'user')?.text ?? target.text
    setVideoBusy(target.id)
    setError(null)
    await attachVideos(chat, target.id, question)
    setVideoBusy(null)
  }

  const quick = [
    'Cosa devo fare adesso?',
    phase ? `Spiegami la fase «${phase.title}»` : 'Cosa manca per finire?',
    'Che errori devo evitare?',
    'Posso risparmiare sui materiali?',
    'Stima le misure dalla foto che allego (usa un oggetto di riferimento)',
  ]

  return (
    <section id="assistente" className="assistant no-print">
      <h2>Assistente — ti guida passo passo</h2>
      <p className="help">
        Conosce misure, materiali, costi e a che punto sei
        {phase ? ` (ora: «${phase.title}»)` : ''}. Puoi allegare una foto e chiedere «va bene così?».
      </p>
      <div className="chat">
        {chat.length === 0 ? <p className="empty">Chiedimi qualcosa, o parti da uno dei suggerimenti qui sotto.</p> : null}
        {chat.map((item, index) => (
          <div key={item.id} className={`bubble ${item.role}`}>
            <span className="who">{item.role === 'user' ? 'Tu' : 'Capocantiere AI'}</span>
            <p>
              {item.text}
              {item.withPhoto ? ' 📷' : ''}
            </p>
            {item.role === 'assistant' && item.videos ? <VideoList videos={item.videos} query={item.videoQuery ?? ''} /> : null}
            {item.role === 'assistant' && !item.videos ? (
              <button
                type="button"
                className="btn sm"
                disabled={videoBusy !== null || busy}
                onClick={() => void videosFor(index)}
              >
                {videoBusy === item.id ? '📺 Cerco…' : '📺 Mostra video su questo'}
              </button>
            ) : null}
          </div>
        ))}
        {busy ? <div className="bubble assistant">Ci penso…</div> : null}
        <div ref={endRef} />
      </div>
      {error ? <p className="banner warn">{error}</p> : null}
      <div className="examples">
        {quick.map((item) => (
          <button key={item} type="button" className="chip" disabled={busy} onClick={() => void send(item)}>
            {item}
          </button>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault()
          void send(text)
        }}
      >
        <textarea
          rows={2}
          value={text}
          placeholder="Scrivi la tua domanda…"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send(text)
            }
          }}
        />
        <label className="btn">
          {photo ? '📷 foto pronta' : '📷 Foto'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" className="btn solid" disabled={busy || !text.trim()}>
          Invia
        </button>
      </form>
      {chat.length > 0 ? (
        <button type="button" className="btn ghost" onClick={() => void onSave([])}>
          Svuota la conversazione
        </button>
      ) : null}
    </section>
  )
}

export function GuideButton({
  project,
  phase,
  onGuide,
}: {
  project: Project
  phase: Phase
  onGuide: (guide: PhaseGuide) => void
}) {
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
            onGuide(await explainPhase(loadSettings(), project, phase))
          } catch (reason) {
            setError(errorText(reason, 'Guida non riuscita.'))
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Preparo la guida…' : phase.guide ? 'Rigenera la guida' : 'Spiegami come si fa'}
      </button>
      {error ? <p className="banner warn">{error}</p> : null}
    </>
  )
}

const VERDICT: Record<QuoteReview['verdict'], string> = {
  congruo: 'Prezzo congruo',
  basso: 'Prezzo troppo basso: rischi di rimetterci',
  alto: 'Prezzo alto: puoi ottimizzare',
}

/** L'AI ragiona sui costi: giudizio, voci mancanti, risparmi. Non cambia i totali da sola. */
export function QuoteReviewBox({
  project,
  onReview,
  onApplyHours,
}: {
  project: Project
  onReview: (review: QuoteReview) => void
  onApplyHours: (hours: number) => void
}) {
  const review = project.quoteReview ?? null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="quote-review no-print">
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            onReview(await reviewQuote(loadSettings(), project))
          } catch (reason) {
            setError(errorText(reason, 'Revisione non riuscita.'))
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Ragiono sui costi…' : review ? 'Rivedi di nuovo il preventivo' : 'Fai ragionare l’AI sul preventivo'}
      </button>
      {error ? <p className="banner warn">{error}</p> : null}
      {review ? (
        <blockquote className={`ai-note verdict-${review.verdict}`}>
          <span className="source">Revisione AI — è un parere, i totali restano quelli sopra</span>
          <p>
            <strong>{VERDICT[review.verdict]}</strong>
          </p>
          <p>{review.summary}</p>
          {review.suggestedHours !== null && review.suggestedHours !== project.quote.laborHours ? (
            <p>
              Ore suggerite: <strong>{review.suggestedHours} h</strong> (ora {project.quote.laborHours} h →{' '}
              {euro(review.suggestedHours * project.quote.hourlyRate)} di manodopera){' '}
              <button type="button" className="btn" onClick={() => onApplyHours(review.suggestedHours as number)}>
                Applica queste ore
              </button>
            </p>
          ) : null}
          {review.missing.length > 0 ? (
            <>
              <h3>Voci che spesso mancano</h3>
              <ul>
                {review.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {review.savingTips.length > 0 ? (
            <>
              <h3>Dove risparmiare</h3>
              <ul>
                {review.savingTips.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {review.clientNote ? <p className="detail">Da dire al cliente: «{review.clientNote}»</p> : null}
        </blockquote>
      ) : null}
    </div>
  )
}
