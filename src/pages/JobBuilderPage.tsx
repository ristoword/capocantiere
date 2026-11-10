import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { InputsForm } from '../components/InputsForm'
import { RiskNotice } from '../components/RiskNotice'
import { PhotoDrop } from '../components/PhotoDrop'
import { TradeGrid } from '../components/TradeGrid'
import { useStore } from '../context/Store'
import { EXAMPLES, applyExample, defaultsFor, validateDraft } from '../domain/fields'
import { TRADES, tradeById, tradeStyle } from '../domain/trades'
import type { InputValue, TradeId } from '../domain/types'
import { computeJob } from '../engine/compute'
import { mergeProject } from '../engine/merge'
import { blobToDataUrl, diagnoseJob } from '../lib/api'
import { analyzeSite, type SiteAnalysis } from '../lib/assistant'
import { euro, numIt, qty } from '../lib/format'
import { shrink } from '../lib/image'
import { loadSettings } from '../storage/settings'

const isTrade = (value: string | undefined): value is TradeId => TRADES.some((trade) => trade.id === value)

function autoTitle(trade: TradeId): string {
  const day = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  return `${tradeById(trade).name} · ${day}`
}

/** Pagina unica per creare o ricalcolare un lavoro: foto → mestiere → misure → preventivo live. */
export function JobBuilderPage() {
  const { tradeId } = useParams()
  const [params] = useSearchParams()
  const fascicolo = params.get('fascicolo') ?? ''
  return <Builder key={`${tradeId ?? 'auto'}-${fascicolo}`} tradeId={isTrade(tradeId) ? tradeId : null} fascicolo={fascicolo} />
}

function Builder({ tradeId, fascicolo }: { tradeId: TradeId | null; fascicolo: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const routed = (location.state ?? {}) as { files?: File[]; auto?: boolean }
  const { projects, saveProject, addPhoto, photosFor } = useStore()
  const existing = fascicolo ? projects.find((item) => item.id === fascicolo) : undefined

  const [trade, setTrade] = useState<TradeId | null>(tradeId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState<Record<string, InputValue>>(tradeId ? defaultsFor(tradeId) : {})
  const [files, setFiles] = useState<File[]>(routed.files ?? [])
  const [previews, setPreviews] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<SiteAnalysis | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const booted = useRef(false)
  const autoRan = useRef(false)

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  useEffect(() => {
    if (!existing || booted.current) return
    booted.current = true
    setTrade(existing.trade)
    setTitle(existing.title)
    setDescription(existing.description)
    setInputs({ ...defaultsFor(existing.trade), ...existing.inputs })
  }, [existing])

  async function runAnalyze(list: File[], text: string, hint: TradeId | null) {
    if (list.length === 0 && text.trim().length < 5) {
      setMessage('Aggiungi almeno una foto oppure scrivi due righe su cosa vuoi fare.')
      return
    }
    setAnalyzing(true)
    setMessage(null)
    try {
      const images: string[] = []
      for (const file of list.slice(0, 6)) images.push(await blobToDataUrl(await shrink(file)))
      const result = await analyzeSite(loadSettings(), { description: text, tradeHint: hint, images })
      setAnalysis(result)
      setTrade(result.trade)
      setInputs(result.inputs)
      setTitle((current) => current.trim() || result.title)
      setDescription((current) => (current.trim().length >= 15 ? current : result.description))
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Analisi non riuscita.')
    } finally {
      setAnalyzing(false)
    }
  }

  useEffect(() => {
    if (autoRan.current || !routed.auto || !routed.files?.length) return
    autoRan.current = true
    void runAnalyze(routed.files, '', trade)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function chooseTrade(next: TradeId) {
    setTrade(next)
    setInputs(defaultsFor(next))
    setAnalysis(null)
    setMessage(null)
  }

  const draft = useMemo(
    () =>
      trade
        ? {
            trade,
            title: title.trim() || autoTitle(trade),
            description: description.trim() || 'Lavoro',
            inputs,
            hasPhotos: files.length > 0 || (existing?.photoIds.length ?? 0) > 0,
          }
        : null,
    [trade, title, description, inputs, files.length, existing],
  )
  const issue = draft ? validateDraft(draft) : 'Scegli il tipo di lavoro.'
  const preview = useMemo(() => (draft && !issue ? computeJob(draft) : null), [draft, issue])
  const style = trade ? tradeStyle(trade) : null
  const info = trade ? tradeById(trade) : null

  async function save() {
    if (!draft || issue) {
      setMessage(issue ?? 'Scegli il tipo di lavoro.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const now = new Date().toISOString()
      const body = computeJob(draft)
      const stored = existing ? await photosFor(existing.id) : []
      const images: string[] = []
      for (const blob of existing ? stored.map((photo) => photo.blob) : files) {
        if (images.length >= 6) break
        images.push(await blobToDataUrl(await shrink(blob)))
      }
      let modelDiagnosis = existing?.modelDiagnosis ?? null
      let diagnosisError = ''
      try {
        modelDiagnosis = await diagnoseJob(loadSettings(), body, images)
      } catch (reason) {
        diagnosisError = reason instanceof Error ? reason.message : 'Diagnosi del modello non riuscita.'
      }
      if (existing) {
        const merged = mergeProject(existing, body)
        await saveProject({ ...merged, modelDiagnosis, diagnosisError })
        navigate(`/progetto/${existing.id}`)
        return
      }
      const id = crypto.randomUUID()
      const photoIds: string[] = []
      for (const file of files) {
        const photoId = crypto.randomUUID()
        await addPhoto({ id: photoId, projectId: id, phaseId: null, name: file.name, createdAt: now, blob: file })
        photoIds.push(photoId)
      }
      await saveProject({ ...body, id, photoIds, modelDiagnosis, diagnosisError, createdAt: now, updatedAt: now })
      navigate(`/progetto/${id}`)
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Non sono riuscito a salvare il fascicolo.')
      setBusy(false)
    }
  }

  const examples = EXAMPLES.filter((example) => !trade || example.trade === trade)
  const css = { '--c': style?.color ?? '#5b4bff' } as CSSProperties

  return (
    <div className="page" style={css}>
      <div className="crumbs no-print">
        <Link to="/">Dashboard</Link> <span>›</span>
        <span>{existing ? 'Modifica misure' : info ? info.name : 'Nuovo lavoro'}</span>
      </div>
      <div className="builder-head">
        <span className="trade-ico">{style?.icon ?? '📷'}</span>
        <div>
          <h1>{existing ? `Ricalcola: ${existing.title}` : info ? info.name : 'Parti da una foto'}</h1>
          <p className="lede" style={{ margin: 0 }}>
            {info
              ? info.blurb
              : 'Carica una foto o descrivi il lavoro: l’assistente capisce di cosa si tratta e compila le misure per te.'}
          </p>
        </div>
      </div>

      <div className="workbench">
        <div className="stack">
          {existing ? (
            <p className="banner">
              Stai ricalcolando un fascicolo esistente: i prezzi che hai modificato restano, quantità e ore si
              aggiornano.
            </p>
          ) : (
            <section className="card">
              <h2>
                <span className="step-n">1</span> Mostrami il lavoro
              </h2>
              <PhotoDrop
                light
                onFiles={(added) => setFiles((current) => [...current, ...added].slice(0, 8))}
                onReject={setMessage}
                title="Carica le foto del lavoro"
                hint="Scatta o scegli dalla galleria. Più foto = analisi migliore."
              />
              {previews.length > 0 ? (
                <div className="thumbs">
                  {previews.map((url, index) => (
                    <div className="thumb" key={url}>
                      <img src={url} alt={`Foto ${index + 1}`} />
                      <button
                        type="button"
                        aria-label={`Rimuovi foto ${index + 1}`}
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <label className="field" style={{ marginTop: '0.9rem' }}>
                <span className="field-label">Racconta cosa c’è da fare</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={style?.placeholder ?? 'Es. Il muro della cucina ha una macchia e vorrei ridipingerlo'}
                />
              </label>
              <div className="ai-box">
                <strong>✨ Lascia fare all’assistente</strong>
                <p className="help" style={{ margin: 0 }}>
                  Guarda foto e testo, riconosce il mestiere, stima le misure e compila tutto. Tu controlli e correggi.
                </p>
                <button
                  type="button"
                  className="btn solid"
                  disabled={analyzing}
                  onClick={() => void runAnalyze(files, description, trade)}
                >
                  {analyzing ? '🔍 Sto guardando…' : '✨ Analizza e compila per me'}
                </button>
              </div>
              {analysis ? (
                <div className="ai-note">
                  <span className="source">
                    Analisi AI · {tradeById(analysis.trade).name} · affidabilità {analysis.confidence}
                  </span>
                  {analysis.whatISee ? <p>{analysis.whatISee}</p> : null}
                  {analysis.assumptions.length > 0 ? (
                    <>
                      <h3>Stime a occhio: controllale</h3>
                      <ul className="plain-list">
                        {analysis.assumptions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {analysis.questions.length > 0 ? (
                    <>
                      <h3>Per essere preciso mi serve sapere</h3>
                      <ul className="plain-list">
                        {analysis.questions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}

          {!trade ? (
            <section className="card">
              <h2>
                <span className="step-n">2</span> Che tipo di lavoro è?
              </h2>
              <p className="help">Se hai usato l’analisi lo trovi già scelto. Altrimenti tocca una card.</p>
              <TradeGrid compact value={trade} onChange={chooseTrade} />
            </section>
          ) : (
            <section className="card">
              <h2>
                <span className="step-n">{existing ? '1' : '2'}</span> Le misure
                {!existing ? (
                  <button type="button" className="btn ghost sm" onClick={() => setTrade(null)}>
                    Cambia mestiere
                  </button>
                ) : null}
              </h2>
              <p className="help">
                Compila quello che sai: il preventivo a destra si aggiorna mentre scrivi. Ogni campo ha un suggerimento
                su come misurare.
              </p>
              {examples.length > 0 && !existing ? (
                <div className="examples" style={{ marginBottom: '0.8rem' }}>
                  <span className="help">Prova con un esempio:</span>
                  {examples.map((example) => (
                    <button
                      key={example.id}
                      type="button"
                      className="chip"
                      onClick={() => {
                        const next = applyExample(example)
                        setTrade(next.trade)
                        setTitle(next.title)
                        setDescription(next.description)
                        setInputs(next.inputs)
                        setAnalysis(null)
                      }}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="field" style={{ marginBottom: '0.9rem' }}>
                <span className="field-label">Nome del lavoro (facoltativo)</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={trade ? autoTitle(trade) : ''}
                />
              </label>
              {existing ? (
                <label className="field" style={{ marginBottom: '0.9rem' }}>
                  <span className="field-label">Descrizione</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
                </label>
              ) : null}
              <RiskNotice trade={trade} />
              <InputsForm
                trade={trade}
                inputs={inputs}
                onChange={(key, value) => setInputs((current) => ({ ...current, [key]: value }))}
              />
            </section>
          )}
        </div>

        <aside className="preview-col">
          <div className="live">
            {preview ? (
              <>
                <div className="live-head">
                  <span>Preventivo in tempo reale</span>
                  <strong>{euro(preview.quote.totalEuro)}</strong>
                </div>
                <div className="live-body">
                  <div className="live-split">
                    <div>
                      <span>Materiali</span>
                      <b>{euro(preview.quote.materialsEuro)}</b>
                    </div>
                    <div>
                      <span>Manodopera · {numIt(preview.quote.laborHours, 1)} h</span>
                      <b>{euro(preview.quote.laborEuro)}</b>
                    </div>
                  </div>
                  <ul className="mini-list">
                    {preview.materials.slice(0, 7).map((line) => (
                      <li key={line.id}>
                        <span>
                          {line.name} · {qty(line.quantity)} {line.unit}
                        </span>
                        <b>{euro(line.quantity * line.unitPrice)}</b>
                      </li>
                    ))}
                    {preview.materials.length > 7 ? (
                      <li>
                        <span className="help">+ {preview.materials.length - 7} altre voci nel fascicolo</span>
                      </li>
                    ) : null}
                  </ul>
                  <p className="help">{preview.currentState}</p>
                </div>
              </>
            ) : (
              <div className="waiting">
                <p className="big-ico">🧮</p>
                <p>
                  <strong>Il preventivo appare qui</strong>
                </p>
                <p className="help">{issue}</p>
              </div>
            )}
          </div>
          {message ? <p className="banner err">{message}</p> : null}
          <div className="sticky-cta">
            <button type="button" className="btn solid big block" disabled={busy || !preview} onClick={() => void save()}>
              {busy
                ? '⏳ Preparo il fascicolo…'
                : existing
                  ? '💾 Aggiorna il fascicolo'
                  : '🚀 Crea il fascicolo e inizia'}
            </button>
            <p className="help" style={{ textAlign: 'center' }}>
              Materiali, passi guidati, checklist e assistente: tutto in un unico fascicolo.
            </p>
            {existing ? (
              <Link className="btn block" to={`/progetto/${existing.id}`}>
                ← Torna al fascicolo senza salvare
              </Link>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
