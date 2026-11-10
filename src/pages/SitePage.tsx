import { Link, useParams } from 'react-router-dom'
import { useAccount } from '../context/Account'
import { useStore } from '../context/Store'
import { tradeById } from '../domain/trades'
import { euro, numIt, qty } from '../lib/format'
import { inSite, STATUS_ICON, STATUS_LABEL, statusOf } from '../lib/jobs'
import { withVat } from '../lib/quoteDoc'
import { copyText } from '../lib/share'

/** Preventivo unico di un cantiere: raccoglie i lavori dello stesso cliente. */
export function SitePage() {
  const { name: raw = '' } = useParams()
  const name = decodeURIComponent(raw)
  const { ready, projects } = useStore()
  const { profile } = useAccount()
  const jobs = projects.filter((project) => inSite(project, name))
  const net = jobs.reduce((sum, project) => sum + project.quote.totalEuro, 0)
  const vatPercent = jobs.find((project) => project.quoteMeta)?.quoteMeta?.vatPercent ?? profile.vatPercent
  const totals = withVat(net, vatPercent)
  const client = jobs.find((project) => project.client?.name)?.client

  if (!ready) return <p className="page">Preparo il cantiere…</p>
  if (jobs.length === 0) {
    return (
      <div className="page">
        <h1>Nessun lavoro in «{name}»</h1>
        <Link className="btn solid" to="/">
          Torna alla dashboard
        </Link>
      </div>
    )
  }

  const text = [
    `${profile.businessName ? `${profile.businessName} — ` : ''}PREVENTIVO CANTIERE: ${name}`,
    '',
    ...jobs.map((project) => `• ${project.title}: ${euro(project.quote.totalEuro)}`),
    '',
    `Imponibile: ${euro(totals.net)}`,
    `IVA ${vatPercent}%: ${euro(totals.vat)}`,
    `TOTALE: ${euro(totals.gross)}`,
    '',
    'Stima indicativa, soggetta a sopralluogo.',
  ].join('\n')

  return (
    <article className="page sheet">
      <div className="actions no-print">
        <Link className="btn" to="/">
          ← Dashboard
        </Link>
        <button type="button" className="btn solid" onClick={() => window.print()}>
          🖨 Stampa o salva PDF
        </button>
        <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>
          💬 WhatsApp
        </a>
        <button type="button" className="btn" onClick={() => void copyText(text)}>
          📋 Copia testo
        </button>
      </div>
      <header className="quote-head">
        <div>
          {profile.logo ? <img className="quote-logo" src={profile.logo} alt="" /> : null}
          <h1>{profile.businessName || 'Preventivo cantiere'}</h1>
          <p>
            {profile.address}
            {profile.address ? <br /> : null}
            {profile.vatId ? `P. IVA ${profile.vatId}` : ''}
          </p>
        </div>
        <div className="quote-meta">
          <p className="kicker">Cantiere</p>
          <h2 style={{ margin: 0 }}>{name}</h2>
          <p>{client?.name ?? ''}</p>
        </div>
      </header>

      {jobs.map((project) => (
        <section key={project.id}>
          <h3>
            {project.title} <small className="help">· {tradeById(project.trade).name} · {STATUS_ICON[statusOf(project)]} {STATUS_LABEL[statusOf(project)]}</small>
          </h3>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {project.materials.map((line) => (
                  <tr key={line.id}>
                    <td>{line.name}</td>
                    <td>
                      {qty(line.quantity)} {line.unit}
                    </td>
                    <td>{euro(line.quantity * line.unitPrice)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Manodopera</td>
                  <td>{numIt(project.quote.laborHours, 1)} h</td>
                  <td>{euro(project.quote.laborEuro)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>
                    <strong>Totale lavoro</strong>
                  </td>
                  <td>
                    <strong>{euro(project.quote.totalEuro)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <dl className="quote-sum">
        <div>
          <dt>Imponibile ({jobs.length} lavori)</dt>
          <dd>{euro(totals.net)}</dd>
        </div>
        <div>
          <dt>IVA {vatPercent}%</dt>
          <dd>{euro(totals.vat)}</dd>
        </div>
        <div className="grand">
          <dt>Totale</dt>
          <dd>{euro(totals.gross)}</dd>
        </div>
      </dl>
      <p className="help">Stima basata sulle misure indicate, soggetta a sopralluogo.</p>
    </article>
  )
}
