import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Assistant, GuideButton, QuoteReviewBox } from '../components/project/AiPanels'
import { PhaseGuideView } from '../components/project/PhaseGuideView'
import { VideoShelf } from '../components/project/VideoShelf'
import { PhotoDrop } from '../components/PhotoDrop'
import { CalcList, MaterialsTable, Notes, QuoteBox, SlopeCard } from '../components/project/Readout'
import { useProjectPhotos } from '../components/project/usePhotos'
import { VisualCheck } from '../components/project/VisualCheck'
import { useStore } from '../context/Store'
import { tradeById, tradeStyle } from '../domain/trades'
import type { Phase, Project } from '../domain/types'
import { reprice } from '../engine/reprice'
import { blobToDataUrl, diagnoseJob } from '../lib/api'
import { DIFFICULTY_LABEL, euro, numIt, when } from '../lib/format'
import { shrink } from '../lib/image'
import { copyText, quoteText } from '../lib/share'
import { loadSettings } from '../storage/settings'

const TABS = [
  { id: 'panoramica', label: 'Panoramica', ico: '🔎' },
  { id: 'costi', label: 'Materiali e costi', ico: '💶' },
  { id: 'passi', label: 'Passo dopo passo', ico: '🪜' },
  { id: 'assistente', label: 'Assistente', ico: '💬' },
] as const
type TabId = (typeof TABS)[number]['id']

export function ProjectPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { ready, projects, saveProject, addPhoto, removeProject } = useStore()
  const project = projects.find((item) => item.id === id)
  const [photoVersion, setPhotoVersion] = useState(0)
  const photos = useProjectPhotos(id, photoVersion)
  const [openPhase, setOpenPhase] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const latestProject = useRef<Project | undefined>(undefined)
  latestProject.current = project

  const requested = params.get('tab')
  const tab: TabId = TABS.some((item) => item.id === requested) ? (requested as TabId) : 'panoramica'
  const goTab = (next: TabId) => {
    setParams({ tab: next }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function persist(next: Project) {
    await saveProject({ ...next, updatedAt: new Date().toISOString() })
  }

  async function addFiles(files: File[], phaseId: string | null) {
    if (!project || files.length === 0) return
    const ids: string[] = []
    for (const file of files) {
      const photoId = crypto.randomUUID()
      await addPhoto({
        id: photoId,
        projectId: project.id,
        phaseId,
        name: file.name,
        createdAt: new Date().toISOString(),
        blob: file,
      })
      ids.push(photoId)
    }
    if (phaseId) {
      await persist({
        ...project,
        phases: project.phases.map((phase) =>
          phase.id === phaseId ? { ...phase, photoIds: [...phase.photoIds, ...ids] } : phase,
        ),
      })
    } else {
      await persist({ ...project, photoIds: [...project.photoIds, ...ids] })
    }
    setPhotoVersion((version) => version + 1)
    setToast(ids.length === 1 ? 'Foto aggiunta' : `${ids.length} foto aggiunte`)
  }

  async function enrich(current: Project) {
    setAiBusy(true)
    setMessage(null)
    try {
      const images: string[] = []
      for (const photo of photos.slice(0, 6)) images.push(await blobToDataUrl(await shrink(photo.blob)))
      const reading = await diagnoseJob(loadSettings(), current, images)
      await persist({ ...current, modelDiagnosis: reading, diagnosisError: '' })
      setToast('Diagnosi aggiornata')
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'Diagnosi del modello non riuscita.'
      setMessage(text)
      await persist({ ...current, diagnosisError: text })
    } finally {
      setAiBusy(false)
    }
  }

  if (!ready) return <p className="page">Apro il fascicolo…</p>
  if (!project) {
    return (
      <div className="page">
        <div className="empty">
          <p style={{ fontSize: '2rem', margin: 0 }}>🔍</p>
          <h2>Fascicolo non trovato</h2>
          <Link className="btn solid" to="/">
            Torna alla dashboard
          </Link>
        </div>
      </div>
    )
  }

  const trade = tradeById(project.trade)
  const style = tradeStyle(project.trade)
  const reading = project.modelDiagnosis ?? null
  const difficulty = reading?.difficulty ?? project.difficulty
  const done = project.phases.filter((item) => item.done).length
  const pct = project.phases.length ? Math.round((done / project.phases.length) * 100) : 0
  const nextPhase = project.phases.find((item) => !item.done)
  const phase = project.phases.find((item) => item.id === openPhase)
  const phasePhoto = phase ? photos.filter((item) => item.phaseId === phase.id).at(-1) : undefined
  const sitePhotos = photos.filter((item) => item.phaseId === null || project.photoIds.includes(item.id))

  async function copyQuote() {
    setToast((await copyText(quoteText(project as Project))) ? 'Preventivo copiato: incollalo dove vuoi' : 'Copia non riuscita')
  }

  async function remove() {
    if (!window.confirm(`Eliminare «${project?.title}» e le sue foto da questo browser? Non si può annullare.`)) return
    await removeProject(id)
    navigate('/')
  }

  return (
    <article className="page" style={{ '--c': style.color } as CSSProperties}>
      <div className="crumbs no-print">
        <Link to="/">Dashboard</Link> <span>›</span> <span>{trade.name}</span>
      </div>
      <header className="proj-head">
        <div className="proj-band">
          <span className="trade-ico">{style.icon}</span>
          <div style={{ flex: 1, minWidth: '14rem' }}>
            <p className="kicker">
              {trade.name} · aggiornato {when(project.updatedAt)}
            </p>
            <h1>{project.title}</h1>
          </div>
          <span className={`badge badge-${difficulty}`}>Difficoltà {DIFFICULTY_LABEL[difficulty].toLowerCase()}</span>
        </div>
        <div className="proj-kpis">
          <div>
            <span>Totale preventivo</span>
            <strong>{euro(project.quote.totalEuro)}</strong>
          </div>
          <div>
            <span>Materiali</span>
            <strong>{euro(project.quote.materialsEuro)}</strong>
          </div>
          <div>
            <span>Manodopera</span>
            <strong>
              {euro(project.quote.laborEuro)} · {numIt(project.quote.laborHours, 1)} h
            </strong>
          </div>
          <div>
            <span>Avanzamento</span>
            <strong>
              {done}/{project.phases.length} fasi
            </strong>
            <div className="progress">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="proj-actions no-print">
          <Link className="btn sm" to={`/mestiere/${project.trade}?fascicolo=${project.id}`}>
            ✏️ Modifica misure
          </Link>
          <button type="button" className="btn sm" onClick={() => void copyQuote()}>
            📋 Copia preventivo
          </button>
          <Link className="btn sm solid" to={`/progetto/${project.id}/report`}>
            📄 Report / PDF
          </Link>
          <button type="button" className="btn sm ghost danger" onClick={() => void remove()}>
            🗑 Elimina
          </button>
        </div>
      </header>

      <nav className="tabs no-print" aria-label="Sezioni del fascicolo">
        {TABS.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'on' : ''} onClick={() => goTab(item.id)}>
            <span>{item.ico}</span> {item.label}
          </button>
        ))}
      </nav>

      {message ? <p className="banner err no-print">{message}</p> : null}

      {tab === 'panoramica' ? (
        <>
          {nextPhase ? (
            <div className="next-card no-print">
              <div>
                <p className="kicker">Prossimo passo</p>
                <h3>{nextPhase.title}</h3>
                <p className="help">Ti spiego come farlo e controllo il risultato dalla foto.</p>
              </div>
              <div className="actions">
                <button type="button" className="btn solid" onClick={() => goTab('passi')}>
                  Vai al passo →
                </button>
                <button type="button" className="btn" onClick={() => goTab('assistente')}>
                  💬 Chiedi aiuto
                </button>
              </div>
            </div>
          ) : (
            <p className="banner">🎉 Tutte le fasi sono completate. Controlla la checklist finale e genera il report.</p>
          )}

          <section className="card">
            <h2>📷 Foto del lavoro</h2>
            {sitePhotos.length === 0 ? (
              <p className="banner warn">Manca una foto di inquadramento: aggiungila per una diagnosi più precisa.</p>
            ) : (
              <div className="photo-row">
                {sitePhotos.map((item) => (
                  <figure key={item.id}>
                    <img src={item.url} alt={item.name || 'Foto del lavoro'} />
                  </figure>
                ))}
              </div>
            )}
            <div className="no-print" style={{ marginTop: '0.8rem' }}>
              <PhotoDrop
                light
                title="Aggiungi foto"
                hint="Tocca o trascina: le foto restano solo in questo browser"
                onFiles={(files) => void addFiles(files, null)}
                onReject={setMessage}
              />
            </div>
          </section>

          <section className="card">
            <h2>🩺 Diagnosi</h2>
            <p className="quote-line">«{project.description}»</p>
            {reading ? (
              <div className="ai-note">
                <span className="source">
                  {reading.photosSent ? 'Letto dall’AI sulle foto e sui dati' : 'Letto dall’AI sui dati (nessuna foto)'}
                </span>
                <p>
                  <strong>{reading.problem}</strong>
                </p>
                <h3>Punti critici</h3>
                <ul className="plain-list">
                  {reading.criticalPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <h3>Sicurezza</h3>
                <ul className="plain-list">
                  {reading.safety.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <h3>Come procedere</h3>
                <p className="detail">{reading.procedureNotes}</p>
              </div>
            ) : (
              <p className="banner warn">
                {project.diagnosisError ||
                  'L’AI non ha ancora fatto la diagnosi. Intanto quantità, materiali e preventivo sono già pronti.'}
              </p>
            )}
            {reading && project.diagnosisError ? (
              <p className="banner warn">Ultimo tentativo non riuscito: {project.diagnosisError}</p>
            ) : null}
            <p>{project.currentState}</p>
            <button type="button" className="btn no-print" disabled={aiBusy} onClick={() => void enrich(project)}>
              {aiBusy ? '🔍 Ci penso…' : reading ? '🔄 Rifai la diagnosi' : '✨ Chiedi la diagnosi all’AI'}
            </button>
          </section>

          <div className="split-notes">
            <section className="card">
              <h2>👀 Punti da controllare</h2>
              <ul className="plain-list">
                {project.criticalPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <h3>Attrezzi</h3>
              <ul className="tools">
                {project.tools.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            </section>
            <section className="card safety">
              <h2>🦺 Sicurezza</h2>
              <ul className="plain-list">
                {project.safety.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card">
            <h2>📚 Note tecniche</h2>
            <Notes notes={project.notes} />
          </section>
        </>
      ) : null}

      {tab === 'costi' ? (
        <>
          {project.slope ? <SlopeCard slope={project.slope} /> : null}
          <section className="card">
            <h2>🧮 Come ho calcolato le quantità</h2>
            <CalcList steps={project.calcSteps} />
          </section>
          <section className="card">
            <h2>🧱 Materiali da comprare</h2>
            <p className="help">Cambia quantità o prezzo con i prezzi del tuo negozio: il totale si aggiorna da solo.</p>
            <MaterialsTable
              lines={project.materials}
              editable
              onQuantity={(lineId, quantity) => {
                const materials = project.materials.map((line) => (line.id === lineId ? { ...line, quantity } : line))
                void persist(reprice({ ...project, materials }))
              }}
              onPrice={(lineId, unitPrice) => {
                const materials = project.materials.map((line) => (line.id === lineId ? { ...line, unitPrice } : line))
                void persist(reprice({ ...project, materials }))
              }}
            />
          </section>
          <section className="card">
            <h2>💶 Preventivo</h2>
            <QuoteBox
              quote={project.quote}
              areaM2={project.areaM2}
              editable
              onHours={(laborHours) => void persist(reprice({ ...project, quote: { ...project.quote, laborHours } }))}
              onRate={(hourlyRate) => void persist(reprice({ ...project, quote: { ...project.quote, hourlyRate } }))}
            />
            <QuoteReviewBox
              project={project}
              onReview={(quoteReview) => void persist({ ...project, quoteReview })}
              onApplyHours={(laborHours) =>
                void persist(reprice({ ...project, quote: { ...project.quote, laborHours } }))
              }
            />
            <div className="actions no-print" style={{ marginTop: '0.8rem' }}>
              <button type="button" className="btn" onClick={() => void copyQuote()}>
                📋 Copia il preventivo
              </button>
              <Link className="btn" to={`/progetto/${project.id}/report`}>
                📄 Apri il report
              </Link>
            </div>
          </section>
        </>
      ) : null}

      {tab === 'passi' ? (
        <>
          <section className="card">
            <h2>🪜 Segui i passi</h2>
            <p className="help">
              Per ogni passo: leggi cosa fare, chiedi la spiegazione dettagliata, cerca un tutorial video, poi manda una
              foto per farti controllare il risultato.
            </p>
            <ol className="phases">
              {project.phases.map((item, index) => {
                const phasePhotos = photos.filter((photo) => photo.phaseId === item.id)
                const current = nextPhase?.id === item.id
                return (
                  <li key={item.id} className={item.done ? 'phase done' : current ? 'phase current' : 'phase'}>
                    <span className="phase-index">{item.done ? '✓' : index + 1}</span>
                    <div>
                      <h3>{item.title}</h3>
                      <p className="detail">{item.detail}</p>
                      <div className="no-print">
                        <VideoShelf query={item.videoQuery} />
                      </div>
                      {item.guide ? (
                        <PhaseGuideView
                          guide={item.guide}
                          trade={trade.name}
                          phaseTitle={item.title}
                          onChange={(guide) => {
                            const base = latestProject.current ?? project
                            void persist({
                              ...base,
                              phases: base.phases.map((entry) => (entry.id === item.id ? { ...entry, guide } : entry)),
                            })
                          }}
                        />
                      ) : null}
                      {phasePhotos.length > 0 ? (
                        <div className="photo-row small">
                          {phasePhotos.map((photo) => (
                            <img key={photo.id} src={photo.url} alt={`Avanzamento ${item.title}`} />
                          ))}
                        </div>
                      ) : null}
                      {item.visualNote ? <p className="help">Nota: {item.visualNote}</p> : null}
                      {item.photoConsistent === true ? <p>✅ L’AI ritiene la foto coerente con questo passo.</p> : null}
                      {item.photoConsistent === false ? <p>⚠️ L’AI non ritiene la foto coerente con questo passo.</p> : null}
                      {item.aiText ? (
                        <div className="ai-note">
                          <span className="source">Verifica dell’AI</span>
                          <p>{item.aiText}</p>
                        </div>
                      ) : null}
                      <div className="actions no-print">
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={(event) => {
                              const phases = project.phases.map((entry) =>
                                entry.id === item.id ? { ...entry, done: event.target.checked } : entry,
                              )
                              void persist({ ...project, phases })
                            }}
                          />
                          Fatto
                        </label>
                        <GuideButton
                          project={project}
                          phase={item}
                          onGuide={(guide) =>
                            void persist({
                              ...project,
                              phases: project.phases.map((entry) => (entry.id === item.id ? { ...entry, guide } : entry)),
                            })
                          }
                        />
                        <label className="btn">
                          📷 Foto
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            hidden
                            onChange={(event) => {
                              void addFiles(Array.from(event.target.files ?? []), item.id)
                              event.target.value = ''
                            }}
                          />
                        </label>
                        <button type="button" className="btn" onClick={() => setOpenPhase(item.id)}>
                          🔎 Controlla con l’AI
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="card">
            <h2>✅ Checklist finale</h2>
            <ul className="checks">
              {project.checklist.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(event) => {
                        const checklist = project.checklist.map((entry) =>
                          entry.id === item.id ? { ...entry, checked: event.target.checked } : entry,
                        )
                        void persist({ ...project, checklist })
                      }}
                    />
                    {item.text}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {tab === 'assistente' ? <Assistant project={project} onSave={(chat) => persist({ ...project, chat })} /> : null}

      {tab !== 'assistente' ? (
        <button type="button" className="btn solid big fab no-print" onClick={() => goTab('assistente')}>
          💬 Chiedi all’assistente
        </button>
      ) : null}

      {toast ? <div className="toast no-print">{toast}</div> : null}

      {phase ? (
        <VisualCheck
          phase={phase}
          project={project}
          photo={phasePhoto}
          onClose={() => setOpenPhase(null)}
          onSave={(next: Phase) => {
            const phases = project.phases.map((entry) => (entry.id === next.id ? next : entry))
            void persist({ ...project, phases })
            setOpenPhase(null)
          }}
        />
      ) : null}
    </article>
  )
}
