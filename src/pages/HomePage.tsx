import { useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PhotoDrop } from '../components/PhotoDrop'
import { TradeGrid } from '../components/TradeGrid'
import { useStore } from '../context/Store'
import { tradeById, tradeStyle } from '../domain/trades'
import { DIFFICULTY_LABEL, euro, when } from '../lib/format'
import { inSite, siteNames, siteOf, STATUS_ICON, STATUS_LABEL, STATUSES, statusOf, summarizeByStatus } from '../lib/jobs'
import type { QuoteStatus } from '../domain/types'

export function HomePage() {
  const navigate = useNavigate()
  const { ready, projects, removeProject } = useStore()
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'tutti'>('tutti')
  const [siteFilter, setSiteFilter] = useState('')

  async function onDelete(id: string, title: string) {
    if (!window.confirm(`Eliminare «${title}» e le sue foto dal tuo account? Non si può annullare.`)) return
    await removeProject(id)
  }

  const phasesTotal = projects.reduce((sum, project) => sum + project.phases.length, 0)
  const phasesDone = projects.reduce((sum, project) => sum + project.phases.filter((phase) => phase.done).length, 0)
  const progress = phasesTotal ? Math.round((phasesDone / phasesTotal) * 100) : 0
  const total = projects.reduce((sum, project) => sum + project.quote.totalEuro, 0)
  const active = projects.filter((project) => project.phases.some((phase) => !phase.done))
  const summary = summarizeByStatus(projects)
  const sites = siteNames(projects)
  const visible = projects.filter(
    (project) => (statusFilter === 'tutti' || statusOf(project) === statusFilter) && (!siteFilter || inSite(project, siteFilter)),
  )
  const next = active[0]
  const nextPhase = next?.phases.find((phase) => !phase.done)

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <p className="kicker" style={{ color: 'rgba(255,255,255,.85)' }}>
              Ciao! Cosa sistemiamo oggi?
            </p>
            <h1>Una foto, e ti dico cosa fare, con cosa e quanto costa.</h1>
            <p className="lede">
              Carica la foto del lavoro: l’assistente riconosce il mestiere, calcola materiali e preventivo e ti guida
              passo passo fino alla fine.
            </p>
            <ol className="how">
              <li>
                <b>1</b> Carichi la foto
              </li>
              <li>
                <b>2</b> L’AI capisce e calcola
              </li>
              <li>
                <b>3</b> Segui la guida
              </li>
            </ol>
          </div>
          <PhotoDrop
            title="Trascina qui la foto o tocca per scegliere"
            hint="Poi l’assistente la analizza e prepara il lavoro"
            onFiles={(files) => navigate('/nuovo', { state: { files, auto: true } })}
          >
            <span className="btn" style={{ marginTop: '0.6rem', background: '#fff', color: '#5b4bff' }}>
              📷 Scegli una foto
            </span>
          </PhotoDrop>
        </div>
      </section>

      {nextPhase && next ? (
        <div className="next-card">
          <div>
            <p className="kicker">Riprendi da qui</p>
            <h3>
              {next.title} · {nextPhase.title}
            </h3>
            <p className="help">Prossimo passo del lavoro in corso.</p>
          </div>
          <Link className="btn solid" to={`/progetto/${next.id}?tab=passi`}>
            Continua il lavoro →
          </Link>
        </div>
      ) : null}

      <div className="kpis">
        <div className="kpi" style={{ '--c': '#5b4bff' } as CSSProperties}>
          <span>Lavori</span>
          <strong>{projects.length}</strong>
        </div>
        <div className="kpi" style={{ '--c': '#ff6b35' } as CSSProperties}>
          <span>Preventivi totali</span>
          <strong>{euro(total)}</strong>
        </div>
        <div className="kpi" style={{ '--c': '#0ea5e9' } as CSSProperties}>
          <span>Accettati</span>
          <strong>{euro(summary.accettato.total)}</strong>
        </div>
        <div className="kpi" style={{ '--c': '#10b981' } as CSSProperties}>
          <span>Avanzamento</span>
          <strong>{progress}%</strong>
        </div>
        <div className="kpi" style={{ '--c': '#ec4899' } as CSSProperties}>
          <span>In corso</span>
          <strong>{active.length}</strong>
        </div>
      </div>

      <div className="section-head">
        <div>
          <h2>Scegli il tipo di lavoro</h2>
          <p className="help">Tocca una card: si apre la pagina dove inserisci misure e descrizione.</p>
        </div>
      </div>
      <TradeGrid link />

      <div className="section-head">
        <h2>I tuoi lavori</h2>
        <Link className="btn sm" to="/nuovo">
          ➕ Nuovo lavoro
        </Link>
      </div>
      {projects.length > 0 ? (
        <div className="filters no-print">
          <div className="chips" role="group" aria-label="Filtra per stato">
            <button type="button" className={statusFilter === 'tutti' ? 'chip on' : 'chip'} onClick={() => setStatusFilter('tutti')}>
              Tutti ({projects.length})
            </button>
            {STATUSES.map((status) => (
              <button key={status} type="button" className={statusFilter === status ? 'chip on' : 'chip'} onClick={() => setStatusFilter(status)}>
                {STATUS_ICON[status]} {STATUS_LABEL[status]} ({summary[status].count})
              </button>
            ))}
          </div>
          {sites.length > 0 ? (
            <div className="chips" role="group" aria-label="Filtra per cantiere">
              <button type="button" className={siteFilter === '' ? 'chip on' : 'chip'} onClick={() => setSiteFilter('')}>
                Tutti i cantieri
              </button>
              {sites.map((name) => (
                <button key={name} type="button" className={siteFilter === name ? 'chip on' : 'chip'} onClick={() => setSiteFilter(name)}>
                  🏗 {name}
                </button>
              ))}
              {siteFilter ? (
                <Link className="btn sm solid" to={`/cantiere/${encodeURIComponent(siteFilter)}`}>
                  🧾 Preventivo unico del cantiere
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!ready ? <p>Apro l’archivio…</p> : null}
      {ready && projects.length === 0 ? (
        <div className="empty">
          <p style={{ fontSize: '2rem', margin: 0 }}>🧰</p>
          <p>
            <strong>Ancora nessun lavoro.</strong>
          </p>
          <p>Carica una foto qui sopra oppure scegli un mestiere: in due minuti hai materiali e preventivo.</p>
        </div>
      ) : null}
      <div className="job-list">
        {visible.map((project) => {
          const trade = tradeById(project.trade)
          const style = tradeStyle(project.trade)
          const done = project.phases.filter((phase) => phase.done).length
          const pct = project.phases.length ? Math.round((done / project.phases.length) * 100) : 0
          const difficulty = project.modelDiagnosis?.difficulty ?? project.difficulty
          return (
            <article key={project.id} className="job-card" style={{ '--c': style.color } as CSSProperties}>
              <Link to={`/progetto/${project.id}`}>
                <div className="job-top">
                  <span className="trade-ico">{style.icon}</span>
                  <div>
                    <strong>{project.title}</strong>
                    <em>
                      {trade.name} · difficoltà {DIFFICULTY_LABEL[difficulty].toLowerCase()}
                    </em>
                    <em>
                      {STATUS_ICON[statusOf(project)]} {STATUS_LABEL[statusOf(project)]}
                      {siteOf(project) ? ` · 🏗 ${siteOf(project)}` : ''}
                    </em>
                  </div>
                </div>
                <div className="job-meta">
                  <b>{euro(project.quote.totalEuro)}</b>
                  <small className="help">
                    {done}/{project.phases.length} fasi
                  </small>
                </div>
                <div className="progress" aria-label={`Avanzamento ${pct}%`}>
                  <i style={{ width: `${pct}%` }} />
                </div>
              </Link>
              <div className="job-foot">
                <small className="help">{when(project.updatedAt)}</small>
                <button type="button" className="btn ghost sm danger" onClick={() => void onDelete(project.id, project.title)}>
                  🗑 Elimina
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
