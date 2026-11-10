import { useState } from 'react'
import type { Phase, Project } from '../../domain/types'
import { blobToDataUrl, verifyPhase } from '../../lib/api'
import { loadSettings } from '../../storage/settings'
import type { ViewPhoto } from './usePhotos'

export function VisualCheck({
  phase,
  project,
  photo,
  onClose,
  onSave,
}: {
  phase: Phase
  project: Project
  photo?: ViewPhoto
  onClose: () => void
  onSave: (phase: Phase) => void
}) {
  const [questions, setQuestions] = useState(phase.questions)
  const [visualNote, setVisualNote] = useState(phase.visualNote)
  const [aiText, setAiText] = useState(phase.aiText)
  const [photoConsistent, setPhotoConsistent] = useState<boolean | null>(phase.photoConsistent ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function ask() {
    setBusy(true)
    setError(null)
    try {
      const image = photo ? await blobToDataUrl(photo.blob) : ''
      const reading = await verifyPhase(loadSettings(), project, { ...phase, questions, visualNote }, image ? [image] : [])
      setAiText(reading.note)
      setPhotoConsistent(reading.consistent)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Verifica del modello non riuscita.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verifica-titolo"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h3 id="verifica-titolo">Verifica visiva — {phase.title}</h3>
          <button type="button" className="btn ghost" onClick={onClose}>
            Chiudi
          </button>
        </header>
        <p className="help">
          La checklist la compili tu. Il giudizio sulla foto compare solo dopo una risposta valida del modello. Se la
          chiamata fallisce, resta l’errore: non viene scritta una verifica finta.
        </p>
        {photo ? (
          <img className="check-photo" src={photo.url} alt={`Foto della fase ${phase.title}`} />
        ) : (
          <p>Nessuna foto di fase. Puoi compilare la checklist; senza foto il modello non può dire che l’immagine è coerente.</p>
        )}
        <ul className="questions">
          {questions.map((question) => (
            <li key={question.id}>
              <p>{question.text}</p>
              <div className="choices">
                {(
                  [
                    ['si', 'Sì'],
                    ['no', 'No'],
                    ['ns', 'Non verificabile'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name={question.id}
                      checked={question.answer === value}
                      onChange={() =>
                        setQuestions((current) =>
                          current.map((item) => (item.id === question.id ? { ...item, answer: value } : item)),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <label className="field">
          <span className="field-label">Nota di cantiere</span>
          <textarea value={visualNote} rows={3} onChange={(event) => setVisualNote(event.target.value)} />
        </label>
        <button type="button" className="btn" onClick={() => void ask()} disabled={busy}>
          {busy ? 'Chiedo al modello…' : 'Verifica la foto con il modello'}
        </button>
        {error ? <p className="banner warn">{error}</p> : null}
        {photoConsistent === true ? <p>Il modello ritiene la foto coerente con questa fase.</p> : null}
        {photoConsistent === false ? <p>Il modello non ritiene la foto coerente con questa fase.</p> : null}
        {aiText ? (
          <blockquote className="ai-note">
            <span className="source">Verifica del modello — non sostituisce il sopralluogo</span>
            <p>{aiText}</p>
          </blockquote>
        ) : null}
        <button
          type="button"
          className="btn solid"
          onClick={() => onSave({ ...phase, questions, visualNote, aiText, photoConsistent })}
        >
          Salva la verifica
        </button>
      </div>
    </div>
  )
}
