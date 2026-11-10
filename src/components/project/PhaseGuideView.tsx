import { useEffect, useRef, useState } from 'react'
import type { PhaseGuide } from '../../domain/types'
import { generateImage, stepPrompt } from '../../lib/illustrate'
import { loadSettings } from '../../storage/settings'

/** Guida a passi di una fase, con illustrazioni generate su richiesta (per passo o tutte insieme). */
export function PhaseGuideView({
  guide,
  trade,
  phaseTitle,
  onChange,
}: {
  guide: PhaseGuide
  trade: string
  phaseTitle: string
  onChange: (guide: PhaseGuide) => void
}) {
  const [current, setCurrent] = useState(guide)
  const [busy, setBusy] = useState<number | 'all' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(current)

  useEffect(() => {
    setCurrent(guide)
    latest.current = guide
  }, [guide])

  async function draw(indexes: number[]) {
    setError(null)
    for (const index of indexes) {
      setBusy(indexes.length > 1 ? 'all' : index)
      try {
        const step = latest.current.steps[index]
        const image = await generateImage(loadSettings(), stepPrompt(trade, phaseTitle, step))
        const next = {
          ...latest.current,
          steps: latest.current.steps.map((item, i) => (i === index ? { ...item, image } : item)),
        }
        latest.current = next
        setCurrent(next)
        onChange(next)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Illustrazione non riuscita.')
        break
      }
    }
    setBusy(null)
  }

  const missing = current.steps.map((step, index) => (step.image ? -1 : index)).filter((index) => index >= 0)

  return (
    <div className="guide">
      <span className="source">Guida passo-passo dell’AI{current.minutes ? ` · circa ${current.minutes} min` : ''}</span>
      {current.intro ? <p>{current.intro}</p> : null}
      {missing.length > 0 ? (
        <button type="button" className="btn sm no-print" disabled={busy !== null} onClick={() => void draw(missing)}>
          {busy === 'all'
            ? '🎨 Disegno i passi…'
            : `🎨 Illustra ${missing.length === current.steps.length ? 'tutti i passi' : 'i passi mancanti'}`}
        </button>
      ) : null}
      {error ? <p className="banner err">{error}</p> : null}
      <ol className="guide-steps">
        {current.steps.map((step, index) => (
          <li key={step.title}>
            <span className="guide-n">{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.how}</p>
              {step.tip ? <p className="tip">💡 {step.tip}</p> : null}
              {step.image ? (
                <figure className="step-fig">
                  <img src={step.image} alt={`Illustrazione: ${step.title}`} />
                </figure>
              ) : (
                <button
                  type="button"
                  className="btn sm ghost no-print"
                  disabled={busy !== null}
                  onClick={() => void draw([index])}
                >
                  {busy === index ? '🎨 Disegno…' : '🎨 Mostra illustrazione'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {current.tools.length > 0 ? (
        <p>
          <strong>Attrezzi:</strong> {current.tools.join(', ')}
        </p>
      ) : null}
      {current.mistakes.length > 0 ? (
        <div className="mistakes">
          <strong>Errori da evitare</strong>
          <ul>
            {current.mistakes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
