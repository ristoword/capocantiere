import { Link, useParams } from 'react-router-dom'
import { CalcList, MaterialsTable, Notes, QuoteBox, SlopeCard } from '../components/project/Readout'
import { useProjectPhotos } from '../components/project/usePhotos'
import { RiskNotice } from '../components/RiskNotice'
import { useStore } from '../context/Store'
import { tradeById } from '../domain/trades'
import { when } from '../lib/format'
import { useT } from '../lib/i18n'
import { Tx } from '../lib/translate'

export function ReportPage() {
  const { id = '' } = useParams()
  const t = useT()
  const { ready, projects } = useStore()
  const project = projects.find((item) => item.id === id)
  const photos = useProjectPhotos(id, 0)

  if (!ready) return <p className="page"><Tx>Preparo il report…</Tx></p>
  if (!project) {
    return (
      <div className="page">
        <h1><Tx>Fascicolo non trovato</Tx></h1>
        <Link className="btn solid" to="/">
          <Tx>Torna alla dashboard</Tx>
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
          <Tx>← Torna al fascicolo</Tx>
        </Link>
        <button type="button" className="btn solid" onClick={() => window.print()}>
          <Tx>🖨 Stampa o salva PDF</Tx>
        </button>
      </div>
      <header className="docket-head">
        <p className="kicker"><Tx>Report finale ·</Tx> {project.id.slice(0, 8).toUpperCase()}</p>
        <p className="trade-name">
          {trade.order} <Tx>{trade.name}</Tx>
        </p>
        <h1>{project.title}</h1>
        <p>
          {when(project.updatedAt)} · {t('diff.label')} {t(`diff.${difficulty}`)}
          <Tx>{reading ? ' (dal modello)' : ' (stimata dalle misure)'}</Tx> <Tx>· Checklist</Tx> {done}/
          {project.checklist.length}
        </p>
        <p className="quote-line">«{project.description}»</p>
      </header>

      <RiskNotice trade={project.trade} />

      <section>
        <h2><Tx>Diagnosi del modello</Tx></h2>
        {reading ? (
          <>
            <p className="help">
              <Tx>{reading.photosSent
                ? 'Il modello ha ricevuto le foto allegate.'
                : 'Il modello non ha ricevuto foto: questa lettura non riguarda immagini.'}</Tx>
            </p>
            <p>{reading.problem}</p>
            <h3><Tx>Punti critici dal modello</Tx></h3>
            <ul>
              {reading.criticalPoints.map((point) => (
                <li key={point}><Tx>{point}</Tx></li>
              ))}
            </ul>
            <h3><Tx>Sicurezza dal modello</Tx></h3>
            <ul>
              {reading.safety.map((item) => (
                <li key={item}><Tx>{item}</Tx></li>
              ))}
            </ul>
            <h3><Tx>Note di procedura dal modello</Tx></h3>
            <p className="detail">{reading.procedureNotes}</p>
          </>
        ) : (
          <p className="banner warn">
            {project.diagnosisError || 'Nessuna diagnosi del modello in questo fascicolo.'}
          </p>
        )}
        {reading && project.diagnosisError ? (
          <p className="banner warn"><Tx>Ultimo tentativo non riuscito:</Tx> {project.diagnosisError}</p>
        ) : null}
        <h3><Tx>Rilievo dalle misure</Tx></h3>
        <p><Tx>{project.currentState}</Tx></p>
        <h3><Tx>Punti della scheda mestiere</Tx></h3>
        <ul>
          {project.criticalPoints.map((point) => (
            <li key={point}><Tx>{point}</Tx></li>
          ))}
        </ul>
        <h3><Tx>Attrezzi</Tx></h3>
        <p>{project.tools.join(' · ')}</p>
      </section>

      {(() => {
        const before = photos.find((photo) => !photo.phaseId)
        const after = [...photos].reverse().find((photo) => photo.phaseId)
        if (!before || !after) return null
        return (
          <section>
            <h2><Tx>Prima e dopo</Tx></h2>
            <div className="photo-row before-after">
              <figure>
                <img src={before.url} alt="Prima" />
                <figcaption><Tx>Prima ·</Tx> {before.name}</figcaption>
              </figure>
              <figure>
                <img src={after.url} alt="Dopo" />
                <figcaption>
                  <Tx>Dopo ·</Tx> {project.phases.find((phase) => phase.id === after.phaseId)?.title ?? after.name}
                </figcaption>
              </figure>
            </div>
          </section>
        )
      })()}

      {photos.length > 0 ? (
        <section>
          <h2><Tx>Foto</Tx></h2>
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
        <h2><Tx>Quantità</Tx></h2>
        <CalcList steps={project.calcSteps} />
      </section>

      <section>
        <h2><Tx>Materiali</Tx></h2>
        <MaterialsTable lines={project.materials} />
      </section>

      <section>
        <h2><Tx>Preventivo</Tx></h2>
        <QuoteBox quote={project.quote} areaM2={project.areaM2} />
      </section>

      <section>
        <h2><Tx>Sicurezza — promemoria del mestiere</Tx></h2>
        <ul>
          {project.safety.map((item) => (
            <li key={item}><Tx>{item}</Tx></li>
          ))}
        </ul>
      </section>

      <section>
        <h2><Tx>Procedura</Tx></h2>
        <ol className="phases">
          {project.phases.map((phase, index) => (
            <li key={phase.id} className={phase.done ? 'phase done' : 'phase'}>
              <span className="phase-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>
                  <Tx>{phase.title}</Tx>
                  <Tx>{phase.done ? ' — fatta' : ''}</Tx>
                </h3>
                <p className="detail"><Tx>{phase.detail}</Tx></p>
                <p><Tx>Cerca tutorial:</Tx> {phase.videoQuery}</p>
                {phase.visualNote ? <p><Tx>Nota di cantiere:</Tx> {phase.visualNote}</p> : null}
                {phase.photoConsistent === true ? <p><Tx>Il modello ritiene la foto coerente con questa fase.</Tx></p> : null}
                {phase.photoConsistent === false ? <p><Tx>Il modello non ritiene la foto coerente con questa fase.</Tx></p> : null}
                {phase.aiText ? <p><Tx>Nota del modello:</Tx> {phase.aiText}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2><Tx>Checklist</Tx></h2>
        <ul className="checks">
          {project.checklist.map((item) => (
            <li key={item.id}>
              <Tx>{item.checked ? '☑' : '☐'}</Tx> <Tx>{item.text}</Tx>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2><Tx>Note tecniche</Tx></h2>
        <Notes notes={project.notes} />
        <p className="help">
          <Tx>Consumo di riferimento — verificare sulla scheda tecnica del prodotto scelto. I prezzi sono indicativi e
          modificabili.</Tx>
        </p>
      </section>
    </article>
  )
}
