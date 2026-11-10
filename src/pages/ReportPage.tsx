import { Link, useParams } from 'react-router-dom'
import { CalcList, MaterialsTable, Notes, QuoteBox, SlopeCard } from '../components/project/Readout'
import { useProjectPhotos } from '../components/project/usePhotos'
import { useStore } from '../context/Store'
import { tradeById } from '../domain/trades'
import { DIFFICULTY_LABEL, when } from '../lib/format'

export function ReportPage() {
  const { id = '' } = useParams()
  const { ready, projects } = useStore()
  const project = projects.find((item) => item.id === id)
  const photos = useProjectPhotos(id, 0)

  if (!ready) return <p className="page">Preparo il report…</p>
  if (!project) {
    return (
      <div className="page">
        <h1>Fascicolo non trovato</h1>
        <Link className="btn solid" to="/">
          Torna alla dashboard
        </Link>
      </div>
    )
  }

  const trade = tradeById(project.trade)
  const reading = project.modelDiagnosis ?? null
  const difficulty = reading?.difficulty ?? project.difficulty
  const done = project.checklist.filter((item) => item.checked).length

  return (
    <article className="page sheet">
      <div className="actions no-print">
        <Link className="btn" to={`/progetto/${project.id}`}>
          ← Torna al fascicolo
        </Link>
        <button type="button" className="btn solid" onClick={() => window.print()}>
          🖨 Stampa o salva PDF
        </button>
      </div>
      <header className="docket-head">
        <p className="kicker">Report finale · {project.id.slice(0, 8).toUpperCase()}</p>
        <p className="trade-name">
          {trade.order} {trade.name}
        </p>
        <h1>{project.title}</h1>
        <p>
          {when(project.updatedAt)} · Difficoltà {DIFFICULTY_LABEL[difficulty]}
          {reading ? ' (dal modello)' : ' (stimata dalle misure)'} · Checklist {done}/
          {project.checklist.length}
        </p>
        <p className="quote-line">«{project.description}»</p>
      </header>

      <section>
        <h2>Diagnosi del modello</h2>
        {reading ? (
          <>
            <p className="help">
              {reading.photosSent
                ? 'Il modello ha ricevuto le foto allegate.'
                : 'Il modello non ha ricevuto foto: questa lettura non riguarda immagini.'}
            </p>
            <p>{reading.problem}</p>
            <h3>Punti critici dal modello</h3>
            <ul>
              {reading.criticalPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <h3>Sicurezza dal modello</h3>
            <ul>
              {reading.safety.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>Note di procedura dal modello</h3>
            <p className="detail">{reading.procedureNotes}</p>
          </>
        ) : (
          <p className="banner warn">
            {project.diagnosisError || 'Nessuna diagnosi del modello in questo fascicolo.'}
          </p>
        )}
        {reading && project.diagnosisError ? (
          <p className="banner warn">Ultimo tentativo non riuscito: {project.diagnosisError}</p>
        ) : null}
        <h3>Rilievo dalle misure</h3>
        <p>{project.currentState}</p>
        <h3>Punti della scheda mestiere</h3>
        <ul>
          {project.criticalPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <h3>Attrezzi</h3>
        <p>{project.tools.join(' · ')}</p>
      </section>

      {photos.length > 0 ? (
        <section>
          <h2>Foto</h2>
          <div className="photo-row">
            {photos.map((photo) => (
              <figure key={photo.id}>
                <img src={photo.url} alt={photo.name || 'Foto di cantiere'} />
                <figcaption>
                  {photo.phaseId ? project.phases.find((phase) => phase.id === photo.phaseId)?.title : 'Rilievo'} · {photo.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {project.slope ? <SlopeCard slope={project.slope} /> : null}

      <section>
        <h2>Quantità</h2>
        <CalcList steps={project.calcSteps} />
      </section>

      <section>
        <h2>Materiali</h2>
        <MaterialsTable lines={project.materials} />
      </section>

      <section>
        <h2>Preventivo</h2>
        <QuoteBox quote={project.quote} areaM2={project.areaM2} />
      </section>

      <section>
        <h2>Sicurezza — promemoria del mestiere</h2>
        <ul>
          {project.safety.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Procedura</h2>
        <ol className="phases">
          {project.phases.map((phase, index) => (
            <li key={phase.id} className={phase.done ? 'phase done' : 'phase'}>
              <span className="phase-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>
                  {phase.title}
                  {phase.done ? ' — fatta' : ''}
                </h3>
                <p className="detail">{phase.detail}</p>
                <p>Cerca tutorial: {phase.videoQuery}</p>
                {phase.visualNote ? <p>Nota di cantiere: {phase.visualNote}</p> : null}
                {phase.photoConsistent === true ? <p>Il modello ritiene la foto coerente con questa fase.</p> : null}
                {phase.photoConsistent === false ? <p>Il modello non ritiene la foto coerente con questa fase.</p> : null}
                {phase.aiText ? <p>Nota del modello: {phase.aiText}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Checklist</h2>
        <ul className="checks">
          {project.checklist.map((item) => (
            <li key={item.id}>
              {item.checked ? '☑' : '☐'} {item.text}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Note tecniche</h2>
        <Notes notes={project.notes} />
        <p className="help">
          Consumo di riferimento — verificare sulla scheda tecnica del prodotto scelto. I prezzi sono indicativi e
          modificabili.
        </p>
      </section>
    </article>
  )
}
