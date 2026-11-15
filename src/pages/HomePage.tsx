import { useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PhotoDrop } from '../components/PhotoDrop'
import { TradeGrid } from '../components/TradeGrid'
import { useStore } from '../context/Store'
import { tradeById, tradeStyle } from '../domain/trades'
import { euro, when } from '../lib/format'
import { useT } from '../lib/i18n'
import { Tx } from '../lib/translate'
import { inSite, siteNames, siteOf, STATUS_ICON, STATUSES, statusOf, summarizeByStatus } from '../lib/jobs'
import type { QuoteStatus } from '../domain/types'

export function HomePage() {
  const navigate = useNavigate()
  const t = useT()
  const { ready, projects, removeProject } = useStore()
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'tutti'>('tutti')
  const [siteFilter, setSiteFilter] = useState('')

  async function onDelete(id: string, title: string) {
    if (!window.confirm(t('home.deleteAsk', { title }))) return
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
              {t('home.hello')}
            </p>
            <h1>{t('home.title')}</h1>
            <p className="lede">{t('home.lede')}</p>
            <ol className="how">
              <li>
                <b>1</b> {t('home.step1')}
              </li>
              <li>
                <b>2</b> {t('home.step2')}
              </li>
              <li>
                <b>3</b> {t('home.step3')}
              </li>
            </ol>
          </div>
          <PhotoDrop
            title={t('home.drop')}
            hint={t('home.dropHint')}
            onFiles={(files) => navigate('/nuovo', { state: { files, auto: true } })}
          >
            <span className="btn" style={{ marginTop: '0.6rem', background: '#fff', color: '#5b4bff' }}>
              {t('home.pick')}
            </span>
          </PhotoDrop>
        </div>
      </section>

      {nextPhase && next ? (
        <div className="next-card">
          <div>
            <p className="kicker">{t('home.resume')}</p>
            <h3>
              {next.title} · {nextPhase.title}
            </h3>
            <p className="help">{t('home.resumeHelp')}</p>
          </div>
          <Link className="btn solid" to={`/progetto/${next.id}?tab=passi`}>
            {t('home.resumeBtn')}
          </Link>
        </div>
      ) : null}

      <div className="kpis">
        <div className="kpi" style={{ '--c': '#5b4bff' } as CSSProperties}>
          <span>{t('home.kpiJobs')}</span>
          <strong>{projects.length}</strong>
        </div>
        <div className="kpi" style={{ '--c': '#ff6b35' } as CSSProperties}>
          <span>{t('home.kpiQuotes')}</span>
          <strong>{euro(total)}</strong>
        </div>
        <div className="kpi" style={{ '--c': '#0ea5e9' } as CSSProperties}>
          <span>{t('home.kpiAccepted')}</span>
          <strong>{euro(summary.accettato.total)}</strong>
        </div>
        <div className="kpi" style={{ '--c': '#10b981' } as CSSProperties}>
          <span>{t('home.kpiProgress')}</span>
          <strong>{progress}%</strong>
        </div>
        <div className="kpi" style={{ '--c': '#ec4899' } as CSSProperties}>
          <span>{t('home.kpiActive')}</span>
          <strong>{active.length}</strong>
        </div>
      </div>

      <div className="section-head">
        <div>
          <h2>{t('home.chooseTrade')}</h2>
          <p className="help">{t('home.chooseTradeHelp')}</p>
        </div>
      </div>
      <TradeGrid link />

      <div className="section-head">
        <h2>{t('home.myJobs')}</h2>
        <div className="inline-actions">
          <Link className="btn sm ghost" to="/archivio">
            {t('arch.openAll')}
          </Link>
          <Link className="btn sm" to="/nuovo">
            {t('home.newJob')}
          </Link>
        </div>
      </div>
      {projects.length > 0 ? (
        <div className="filters no-print">
          <div className="chips" role="group" aria-label="Filtra per stato">
            <button type="button" className={statusFilter === 'tutti' ? 'chip on' : 'chip'} onClick={() => setStatusFilter('tutti')}>
              {t('home.all')} ({projects.length})
            </button>
            {STATUSES.map((status) => (
              <button key={status} type="button" className={statusFilter === status ? 'chip on' : 'chip'} onClick={() => setStatusFilter(status)}>
                {STATUS_ICON[status]} {t(`status.${status}`)} ({summary[status].count})
              </button>
            ))}
          </div>
          {sites.length > 0 ? (
            <div className="chips" role="group" aria-label="Filtra per cantiere">
              <button type="button" className={siteFilter === '' ? 'chip on' : 'chip'} onClick={() => setSiteFilter('')}>
                {t('home.allSites')}
              </button>
              {sites.map((name) => (
                <button key={name} type="button" className={siteFilter === name ? 'chip on' : 'chip'} onClick={() => setSiteFilter(name)}>
                  🏗 {name}
                </button>
              ))}
              {siteFilter ? (
                <Link className="btn sm solid" to={`/cantiere/${encodeURIComponent(siteFilter)}`}>
                  {t('home.siteQuote')}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!ready ? <p>{t('home.opening')}</p> : null}
      {ready && projects.length === 0 ? (
        <div className="empty">
          <p style={{ fontSize: '2rem', margin: 0 }}>🧰</p>
          <p>
            <strong>{t('home.none')}</strong>
          </p>
          <p>{t('home.noneHelp')}</p>
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
                      <Tx>{trade.name}</Tx> · {t('diff.label')} {t(`diff.${difficulty}`)}
                    </em>
                    <em>
                      {STATUS_ICON[statusOf(project)]} {t(`status.${statusOf(project)}`)}
                      {siteOf(project) ? ` · 🏗 ${siteOf(project)}` : ''}
                    </em>
                  </div>
                </div>
                <div className="job-meta">
                  <b>{euro(project.quote.totalEuro)}</b>
                  <small className="help">
                    {t('home.phases', { done, total: project.phases.length })}
                  </small>
                </div>
                <div className="progress" aria-label={`Avanzamento ${pct}%`}>
                  <i style={{ width: `${pct}%` }} />
                </div>
              </Link>
              <div className="job-foot">
                <small className="help">{when(project.updatedAt)}</small>
                <button type="button" className="btn ghost sm danger" onClick={() => void onDelete(project.id, project.title)}>
                  {t('home.delete')}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
