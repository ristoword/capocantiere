import { Link, useParams } from 'react-router-dom'
import { useAccount } from '../context/Account'
import { useStore } from '../context/Store'
import { tradeById } from '../domain/trades'
import { euro, numIt, qty } from '../lib/format'
import { inSite, STATUS_ICON, STATUS_LABEL, statusOf } from '../lib/jobs'
import { withVat } from '../lib/quoteDoc'
import { copyText } from '../lib/share'
import { Tx } from '../lib/translate'

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

  if (!ready) return <p className="page"><Tx>Preparo il cantiere…</Tx></p>
  if (jobs.length === 0) {
    return (
      <div className="page">
        <h1><Tx>Nessun lavoro in «</Tx>{name}»</h1>
        <Link className="btn solid" to="/">
          <Tx>Torna alla dashboard</Tx>
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
          <Tx>← Dashboard</Tx>
        </Link>
        <button type="button" className="btn solid" onClick={() => window.print()}>
          <Tx>🖨 Stampa o salva PDF</Tx>
        </button>
        <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>
          <Tx>💬 WhatsApp</Tx>
        </a>
        <button type="button" className="btn" onClick={() => void copyText(text)}>
          <Tx>📋 Copia testo</Tx>
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
          <p className="kicker"><Tx>Cantiere</Tx></p>
          <h2 style={{ margin: 0 }}>{name}</h2>
          <p>{client?.name ?? ''}</p>
        </div>
      </header>

      {jobs.map((project) => (
        <section key={project.id}>
          <h3>
            {project.title} <small className="help">· <Tx>{tradeById(project.trade).name}</Tx> · {STATUS_ICON[statusOf(project)]} <Tx>{STATUS_LABEL[statusOf(project)]}</Tx></small>
          </h3>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {project.materials.map((line) => (
                  <tr key={line.id}>
                    <td><Tx>{line.name}</Tx></td>
                    <td>
                      {qty(line.quantity)} <Tx>{line.unit}</Tx>
                    </td>
                    <td>{euro(line.quantity * line.unitPrice)}</td>
                  </tr>
                ))}
                <tr>
                  <td><Tx>Manodopera</Tx></td>
                  <td>{numIt(project.quote.laborHours, 1)} <Tx>h</Tx></td>
                  <td>{euro(project.quote.laborEuro)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>
                    <strong><Tx>Totale lavoro</Tx></strong>
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
          <dt><Tx>Imponibile (</Tx>{jobs.length} <Tx>lavori)</Tx></dt>
          <dd>{euro(totals.net)}</dd>
        </div>
        <div>
          <dt><Tx>IVA</Tx> {vatPercent}%</dt>
          <dd>{euro(totals.vat)}</dd>
        </div>
        <div className="grand">
          <dt><Tx>Totale</Tx></dt>
          <dd>{euro(totals.gross)}</dd>
        </div>
      </dl>
      <p className="help"><Tx>Stima basata sulle misure indicate, soggetta a sopralluogo.</Tx></p>
    </article>
  )
}
