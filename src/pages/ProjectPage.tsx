import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Assistant, GuideButton, QuoteReviewBox } from '../components/project/AiPanels'
import { PhaseGuideView } from '../components/project/PhaseGuideView'
import { VideoShelf } from '../components/project/VideoShelf'
import { RiskNotice } from '../components/RiskNotice'
import { STATUS_ICON, STATUSES, siteNames } from '../lib/jobs'
import type { QuoteStatus } from '../domain/types'
import { PhotoDrop } from '../components/PhotoDrop'
import { CalcList, MaterialsTable, Notes, QuoteBox, SlopeCard } from '../components/project/Readout'
import { useProjectPhotos } from '../components/project/usePhotos'
import { VisualCheck } from '../components/project/VisualCheck'
import { useStore } from '../context/Store'
import { tradeById, tradeStyle } from '../domain/trades'
import type { Phase, Project } from '../domain/types'
import { reprice } from '../engine/reprice'
import { blobToDataUrl, diagnoseJob } from '../lib/api'
import { euro, numIt, when } from '../lib/format'
import { useT } from '../lib/i18n'
import { shrink } from '../lib/image'
import { copyText, quoteText } from '../lib/share'
import { loadSettings } from '../storage/settings'
import { Tx, useTx } from '../lib/translate'

const TABS = [
  { id: 'panoramica', label: 'Panoramica', ico: '🔎' },
  { id: 'costi', label: 'Materiali e costi', ico: '💶' },
  { id: 'passi', label: 'Passo dopo passo', ico: '🪜' },
  { id: 'assistente', label: 'Assistente', ico: '💬' },
] as const
type TabId = (typeof TABS)[number]['id']

export function ProjectPage() {
  const { id = '' } = useParams()
  const t = useT()
  const tx = useTx()
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
    setToast(ids.length === 1 ? tx('Foto aggiunta') : `${ids.length} ${tx('foto aggiunte')}`)
  }

  async function enrich(current: Project) {
    setAiBusy(true)
    setMessage(null)
    try {
      const images: string[] = []
      for (const photo of photos.slice(0, 6)) images.push(await blobToDataUrl(await shrink(photo.blob)))
      const reading = await diagnoseJob(loadSettings(), current, images)
      await persist({ ...current, modelDiagnosis: reading, diagnosisError: '' })
      setToast(tx('Diagnosi aggiornata'))
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : tx('Diagnosi del modello non riuscita.')
      setMessage(text)
      await persist({ ...current, diagnosisError: text })
    } finally {
      setAiBusy(false)
    }
  }

  if (!ready) return <p className="page"><Tx>Apro il fascicolo…</Tx></p>
  if (!project) {
    return (
      <div className="page">
        <div className="empty">
          <p style={{ fontSize: '2rem', margin: 0 }}>🔍</p>
          <h2><Tx>Fascicolo non trovato</Tx></h2>
          <Link className="btn solid" to="/">
            <Tx>Torna alla dashboard</Tx>
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
    setToast((await copyText(quoteText(project as Project))) ? tx('Preventivo copiato: incollalo dove vuoi') : tx('Copia non riuscita'))
  }

  async function remove() {
    if (!window.confirm(t('home.deleteAsk', { title: project?.title ?? '' }))) return
    await removeProject(id)
    navigate('/')
  }

  return (
    <article className="page" style={{ '--c': style.color } as CSSProperties}>
      <div className="crumbs no-print">
        <Link to="/"><Tx>Dashboard</Tx></Link> <span>›</span> <span><Tx>{trade.name}</Tx></span>
      </div>
      <header className="proj-head">
        <div className="proj-band">
          <span className="trade-ico">{style.icon}</span>
          <div style={{ flex: 1, minWidth: '14rem' }}>
            <p className="kicker">
              <Tx>{trade.name}</Tx> <Tx>· aggiornato</Tx> {when(project.updatedAt)}
            </p>
            <h1>{project.title}</h1>
          </div>
          <span className={`badge badge-${difficulty}`}>{t('diff.label')} {t(`diff.${difficulty}`)}</span>
        </div>
        <div className="proj-kpis">
          <div>
            <span><Tx>Totale preventivo</Tx></span>
            <strong>{euro(project.quote.totalEuro)}</strong>
          </div>
          <div>
            <span><Tx>Materiali</Tx></span>
            <strong>{euro(project.quote.materialsEuro)}</strong>
          </div>
          <div>
            <span><Tx>Manodopera</Tx></span>
            <strong>
              {euro(project.quote.laborEuro)} · {numIt(project.quote.laborHours, 1)} <Tx>h</Tx>
            </strong>
          </div>
          <div>
            <span><Tx>Avanzamento</Tx></span>
            <strong>
              {done}/{project.phases.length} <Tx>fasi</Tx>
            </strong>
            <div className="progress">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="proj-meta no-print">
          <label className="field">
            <span className="field-label"><Tx>Stato del preventivo</Tx></span>
            <select
              value={project.status ?? 'bozza'}
              onChange={(event) => void saveProject({ ...project, status: event.target.value as QuoteStatus, updatedAt: new Date().toISOString() })}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_ICON[status]} {t(`status.${status}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label"><Tx>Cantiere / cliente</Tx></span>
            <input
              key={project.siteName ?? ''}
              list="site-names"
              defaultValue={project.siteName ?? ''}
              placeholder={tx('es. Casa Rossi (raggruppa più lavori)')}
              maxLength={80}
              onBlur={(event) => {
                const value = event.target.value.trim()
                if (value !== (project.siteName ?? '')) void saveProject({ ...project, siteName: value, updatedAt: new Date().toISOString() })
              }}
            />
            <datalist id="site-names">
              {siteNames(projects).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
        </div>
        <RiskNotice trade={project.trade} />
        <div className="proj-actions no-print">
          <Link className="btn sm" to={`/mestiere/${project.trade}?fascicolo=${project.id}`}>
            <Tx>✏️ Modifica misure</Tx>
          </Link>
          <button type="button" className="btn sm" onClick={() => void copyQuote()}>
            <Tx>📋 Copia preventivo</Tx>
          </button>
          <Link className="btn sm solid" to={`/progetto/${project.id}/preventivo`}>
            <Tx>🧾 Preventivo cliente</Tx>
          </Link>
          <Link className="btn sm" to={`/progetto/${project.id}/report`}>
            <Tx>📄 Report / PDF</Tx>
          </Link>
          <button type="button" className="btn sm ghost danger" onClick={() => void remove()}>
            <Tx>🗑 Elimina</Tx>
          </button>
        </div>
      </header>

      <nav className="tabs no-print" aria-label="Sezioni del fascicolo">
        {TABS.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'on' : ''} onClick={() => goTab(item.id)}>
            <span>{item.ico}</span> <Tx>{item.label}</Tx>
          </button>
        ))}
      </nav>

      {message ? <p className="banner err no-print">{message}</p> : null}

      {tab === 'panoramica' ? (
        <>
          {nextPhase ? (
            <div className="next-card no-print">
              <div>
                <p className="kicker"><Tx>Prossimo passo</Tx></p>
                <h3><Tx>{nextPhase.title}</Tx></h3>
                <p className="help"><Tx>Ti spiego come farlo e controllo il risultato dalla foto.</Tx></p>
              </div>
              <div className="actions">
                <button type="button" className="btn solid" onClick={() => goTab('passi')}>
                  <Tx>Vai al passo →</Tx>
                </button>
                <button type="button" className="btn" onClick={() => goTab('assistente')}>
                  <Tx>💬 Chiedi aiuto</Tx>
                </button>
              </div>
            </div>
          ) : (
            <p className="banner"><Tx>🎉 Tutte le fasi sono completate. Controlla la checklist finale e genera il report.</Tx></p>
          )}

          <section className="card">
            <h2><Tx>📷 Foto del lavoro</Tx></h2>
            {sitePhotos.length === 0 ? (
              <p className="banner warn"><Tx>Manca una foto di inquadramento: aggiungila per una diagnosi più precisa.</Tx></p>
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
            <h2><Tx>🩺 Diagnosi</Tx></h2>
            <p className="quote-line">«{project.description}»</p>
            {reading ? (
              <div className="ai-note">
                <span className="source">
                  <Tx>{reading.photosSent ? 'Letto dall’AI sulle foto e sui dati' : 'Letto dall’AI sui dati (nessuna foto)'}</Tx>
                </span>
                <p>
                  <strong>{reading.problem}</strong>
                </p>
                <h3><Tx>Punti critici</Tx></h3>
                <ul className="plain-list">
                  {reading.criticalPoints.map((point) => (
                    <li key={point}><Tx>{point}</Tx></li>
                  ))}
                </ul>
                <h3><Tx>Sicurezza</Tx></h3>
                <ul className="plain-list">
                  {reading.safety.map((item) => (
                    <li key={item}><Tx>{item}</Tx></li>
                  ))}
                </ul>
                <h3><Tx>Come procedere</Tx></h3>
                <p className="detail">{reading.procedureNotes}</p>
              </div>
            ) : (
              <p className="banner warn">
                {project.diagnosisError ||
                  'L’AI non ha ancora fatto la diagnosi. Intanto quantità, materiali e preventivo sono già pronti.'}
              </p>
            )}
            {reading && project.diagnosisError ? (
              <p className="banner warn"><Tx>Ultimo tentativo non riuscito:</Tx> {project.diagnosisError}</p>
            ) : null}
            <p><Tx>{project.currentState}</Tx></p>
            <button type="button" className="btn no-print" disabled={aiBusy} onClick={() => void enrich(project)}>
              <Tx>{aiBusy ? '🔍 Ci penso…' : reading ? '🔄 Rifai la diagnosi' : '✨ Chiedi la diagnosi all’AI'}</Tx>
            </button>
          </section>

          <div className="split-notes">
            <section className="card">
              <h2><Tx>👀 Punti da controllare</Tx></h2>
              <ul className="plain-list">
                {project.criticalPoints.map((point) => (
                  <li key={point}><Tx>{point}</Tx></li>
                ))}
              </ul>
              <h3><Tx>Attrezzi</Tx></h3>
              <ul className="tools">
                {project.tools.map((tool) => (
                  <li key={tool}><Tx>{tool}</Tx></li>
                ))}
              </ul>
            </section>
            <section className="card safety">
              <h2><Tx>🦺 Sicurezza</Tx></h2>
              <ul className="plain-list">
                {project.safety.map((item) => (
                  <li key={item}><Tx>{item}</Tx></li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card">
            <h2><Tx>📚 Note tecniche</Tx></h2>
            <Notes notes={project.notes} />
          </section>
        </>
      ) : null}

      {tab === 'costi' ? (
        <>
          {project.slope ? <SlopeCard slope={project.slope} /> : null}
          <section className="card">
            <h2><Tx>🧮 Come ho calcolato le quantità</Tx></h2>
            <CalcList steps={project.calcSteps} />
          </section>
          <section className="card">
            <h2><Tx>🧱 Materiali da comprare</Tx></h2>
            <p className="help"><Tx>Cambia quantità o prezzo con i prezzi del tuo negozio: il totale si aggiorna da solo.</Tx></p>
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
            <h2><Tx>💶 Preventivo</Tx></h2>
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
                <Tx>📋 Copia il preventivo</Tx>
              </button>
              <Link className="btn" to={`/progetto/${project.id}/report`}>
                <Tx>📄 Apri il report</Tx>
              </Link>
            </div>
          </section>
        </>
      ) : null}

      {tab === 'passi' ? (
        <>
          <section className="card">
            <h2><Tx>🪜 Segui i passi</Tx></h2>
            <p className="help">
              <Tx>Per ogni passo: leggi cosa fare, chiedi la spiegazione dettagliata, cerca un tutorial video, poi manda una
              foto per farti controllare il risultato.</Tx>
            </p>
            <ol className="phases">
              {project.phases.map((item, index) => {
                const phasePhotos = photos.filter((photo) => photo.phaseId === item.id)
                const current = nextPhase?.id === item.id
                return (
                  <li key={item.id} className={item.done ? 'phase done' : current ? 'phase current' : 'phase'}>
                    <span className="phase-index">{item.done ? '✓' : index + 1}</span>
                    <div>
                      <h3><Tx>{item.title}</Tx></h3>
                      <p className="detail"><Tx>{item.detail}</Tx></p>
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
                      {item.visualNote ? <p className="help"><Tx>Nota:</Tx> {item.visualNote}</p> : null}
                      {item.photoConsistent === true ? <p><Tx>✅ L’AI ritiene la foto coerente con questo passo.</Tx></p> : null}
                      {item.photoConsistent === false ? <p><Tx>⚠️ L’AI non ritiene la foto coerente con questo passo.</Tx></p> : null}
                      {item.aiText ? (
                        <div className="ai-note">
                          <span className="source"><Tx>Verifica dell’AI</Tx></span>
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
                          <Tx>Fatto</Tx>
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
                          <Tx>📷 Foto</Tx>
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
                          <Tx>🔎 Controlla con l’AI</Tx>
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="card">
            <h2><Tx>✅ Checklist finale</Tx></h2>
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
                    <Tx>{item.text}</Tx>
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
          <Tx>💬 Chiedi all’assistente</Tx>
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
