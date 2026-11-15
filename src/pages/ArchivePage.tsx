import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../context/Store'
import { tradeById, tradeStyle } from '../domain/trades'
import type { Project } from '../domain/types'
import { euro, when } from '../lib/format'
import { useT } from '../lib/i18n'
import { Tx } from '../lib/translate'
import { statusOf } from '../lib/jobs'

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

/** Righe dell'archivio filtrate per testo (titolo, cliente, numero preventivo, cantiere, mestiere). */
export function filterArchive(projects: Project[], query: string): Project[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return projects
  return projects.filter((project) =>
    [project.title, project.client?.name, project.quoteMeta?.number, project.siteName, tradeById(project.trade).name]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(needle)),
  )
}

export function archiveCsv(projects: Project[], statusLabel: (project: Project) => string): string {
  const rows = [['Titolo', 'Mestiere', 'Cliente', 'Cantiere', 'Numero preventivo', 'Data', 'Stato', 'Totale €'].map(csvCell).join(';')]
  for (const project of projects) {
    rows.push(
      [
        project.title,
        tradeById(project.trade).name,
        project.client?.name ?? '',
        project.siteName ?? '',
        project.quoteMeta?.number ?? '',
        (project.quoteMeta?.issuedAt || project.updatedAt).slice(0, 10),
        statusLabel(project),
        project.quote.totalEuro.toFixed(2).replace('.', ','),
      ]
        .map(csvCell)
        .join(';'),
    )
  }
  return rows.join('\r\n')
}

export function ArchivePage() {
  const t = useT()
  const { ready, projects } = useStore()
  const [tab, setTab] = useState<'jobs' | 'quotes'>('jobs')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const base = tab === 'quotes' ? projects.filter((project) => project.quoteMeta?.number) : projects
    return filterArchive(base, query)
  }, [projects, tab, query])
  const total = visible.reduce((sum, project) => sum + project.quote.totalEuro, 0)
  const statusLabel = (project: Project) => t(`status.${statusOf(project)}`)

  function download() {
    const blob = new Blob(['﻿' + archiveCsv(visible, statusLabel)], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `archivio-capocantiere-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="page">
      <p className="kicker">{t('nav.archive')}</p>
      <h1>{t('arch.title')}</h1>
      <p className="lede">{t('arch.lede')}</p>
      <div className="filters no-print">
        <div className="chips" role="tablist">
          {(['jobs', 'quotes'] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'chip on' : 'chip'} onClick={() => setTab(id)}>
              {id === 'jobs' ? `🧰 ${t('arch.jobs')}` : `🧾 ${t('arch.quotes')}`} (
              {id === 'jobs' ? projects.length : projects.filter((project) => project.quoteMeta?.number).length})
            </button>
          ))}
        </div>
        <div className="inline-actions">
          <input type="search" aria-label={t('arch.search')} placeholder={t('arch.search')} value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <button type="button" className="btn" disabled={visible.length === 0} onClick={download}>
            {t('arch.csv')}
          </button>
        </div>
        <p className="help">{t('arch.count', { n: visible.length, total: euro(total) })}</p>
      </div>
      {!ready ? <p>{t('home.opening')}</p> : null}
      {ready && projects.length === 0 ? <div className="empty"><p>{t('arch.noJobs')}</p></div> : null}
      {ready && projects.length > 0 && visible.length === 0 ? <div className="empty"><p>{t('arch.noMatch')}</p></div> : null}
      <div className="archive-list">
        {visible.map((project) => {
          const style = tradeStyle(project.trade)
          const number = project.quoteMeta?.number
          return (
            <article key={project.id} className="archive-row">
              <span className="trade-ico" aria-hidden>
                {style.icon}
              </span>
              <div className="archive-main">
                <strong>{project.title}</strong>
                <em>
                  <Tx>{tradeById(project.trade).name}</Tx>
                  {project.client?.name ? ` · ${project.client.name}` : ''}
                  {project.siteName ? ` · 🏗 ${project.siteName}` : ''}
                </em>
                <em>
                  {number ? `${t('arch.quote')} ${t('arch.number')} ${number}` : t('arch.noQuote')} · {statusLabel(project)} · {when(project.quoteMeta?.issuedAt || project.updatedAt)}
                </em>
              </div>
              <b className="archive-total">{euro(project.quote.totalEuro)}</b>
              <div className="inline-actions">
                <Link className="btn sm" to={`/progetto/${project.id}`}>
                  {t('arch.open')}
                </Link>
                <Link className="btn sm solid" to={`/progetto/${project.id}/preventivo`}>
                  🧾 {t('arch.quote')}
                </Link>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
