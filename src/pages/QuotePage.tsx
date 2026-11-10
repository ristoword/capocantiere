import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RiskNotice } from '../components/RiskNotice'
import { useAccount } from '../context/Account'
import { useStore } from '../context/Store'
import type { ClientInfo, Project, QuoteMeta } from '../domain/types'
import { tradeById } from '../domain/trades'
import { euro, numIt, qty } from '../lib/format'
import { nextQuoteNumber, quoteMessage, validUntil, withVat } from '../lib/quoteDoc'
import { copyText } from '../lib/share'

const EMPTY_CLIENT: ClientInfo = { name: '', address: '', phone: '', email: '' }
const day = (iso: string | Date) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date(iso))

export function QuotePage() {
  const { id = '' } = useParams()
  const { ready, projects, saveProject } = useStore()
  const { profile } = useAccount()
  const project = projects.find((item) => item.id === id)
  const [client, setClient] = useState<ClientInfo>(EMPTY_CLIENT)
  const [meta, setMeta] = useState<QuoteMeta | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!project) return
    setClient(project.client ?? EMPTY_CLIENT)
    setMeta(
      project.quoteMeta ?? {
        number: nextQuoteNumber(projects),
        issuedAt: new Date().toISOString(),
        vatPercent: profile.vatPercent,
        validDays: profile.validDays,
        notes: profile.terms,
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  if (!ready) return <p className="page">Preparo il preventivo…</p>
  if (!project || !meta) {
    return (
      <div className="page">
        <h1>Fascicolo non trovato</h1>
        <Link className="btn solid" to="/">
          Torna alla dashboard
        </Link>
      </div>
    )
  }
  const current: Project = { ...project, client, quoteMeta: meta }
  const totals = withVat(project.quote.totalEuro, meta.vatPercent)
  const trade = tradeById(project.trade)
  const business = profile.businessName
  const message = quoteMessage(current, business)

  async function save() {
    await saveProject({ ...current, updatedAt: new Date().toISOString() })
    setNote('✅ Dati del preventivo salvati.')
  }

  return (
    <article className="page sheet">
      <div className="actions no-print">
        <Link className="btn" to={`/progetto/${project.id}`}>
          ← Torna al fascicolo
        </Link>
        <button
          type="button"
          className="btn solid"
          onClick={() => {
            void save().then(() => window.print())
          }}
        >
          🖨 Stampa o salva PDF
        </button>
        <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>
          💬 WhatsApp
        </a>
        <a
          className="btn"
          href={`mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(`Preventivo ${meta.number} — ${project.title}`)}&body=${encodeURIComponent(message)}`}
        >
          ✉️ Email
        </a>
        <button type="button" className="btn" onClick={async () => setNote((await copyText(message)) ? '✅ Testo copiato.' : 'Copia non riuscita.')}>
          📋 Copia testo
        </button>
        <button type="button" className="btn" onClick={() => void save()}>
          💾 Salva
        </button>
      </div>
      {note ? <p className="banner no-print">{note}</p> : null}

      <section className="card no-print quote-form">
        <h2>Dati del preventivo</h2>
        {!profile.businessName ? (
          <p className="banner warn">
            Non hai ancora inserito i dati della tua attività: <Link to="/account">completali nell’Account</Link> per intestare il preventivo.
          </p>
        ) : null}
        <div className="grid-form">
          <label className="field">
            <span className="field-label">Cliente</span>
            <input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Indirizzo del cantiere</span>
            <input value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Telefono</span>
            <input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Email cliente</span>
            <input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Numero preventivo</span>
            <input value={meta.number} onChange={(e) => setMeta({ ...meta, number: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">IVA %</span>
            <input type="number" min={0} max={30} value={meta.vatPercent} onChange={(e) => setMeta({ ...meta, vatPercent: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span className="field-label">Validità (giorni)</span>
            <input type="number" min={1} max={365} value={meta.validDays} onChange={(e) => setMeta({ ...meta, validDays: Number(e.target.value) })} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Condizioni e note</span>
          <textarea value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
        </label>
      </section>

      <header className="quote-head">
        <div>
          {profile.logo ? <img className="quote-logo" src={profile.logo} alt="" /> : null}
          <h1>{business || 'Preventivo'}</h1>
          <p>
            {profile.address}
            {profile.address ? <br /> : null}
            {profile.vatId ? (
              <>
                P. IVA {profile.vatId}
                <br />
              </>
            ) : null}
            {[profile.phone, profile.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="quote-meta">
          <p className="kicker">Preventivo n. {meta.number}</p>
          <p>Data: {day(meta.issuedAt)}</p>
          <p>Valido fino al {day(validUntil(meta.issuedAt, meta.validDays))}</p>
        </div>
      </header>

      <section className="quote-client">
        <h3>Cliente</h3>
        <p>
          <strong>{client.name || '—'}</strong>
          <br />
          {client.address}
          {client.address ? <br /> : null}
          {[client.phone, client.email].filter(Boolean).join(' · ')}
        </p>
        <h3>Lavoro</h3>
        <p>
          <strong>{project.title}</strong> — {trade.name}
        </p>
      </section>

      <section>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Voce</th>
                <th>Q.tà</th>
                <th>Prezzo</th>
                <th>Importo</th>
              </tr>
            </thead>
            <tbody>
              {project.materials.map((line) => (
                <tr key={line.id}>
                  <td>{line.name}</td>
                  <td>
                    {qty(line.quantity)} {line.unit}
                  </td>
                  <td>{euro(line.unitPrice)}</td>
                  <td>{euro(line.quantity * line.unitPrice)}</td>
                </tr>
              ))}
              <tr>
                <td>Manodopera</td>
                <td>{numIt(project.quote.laborHours, 1)} h</td>
                <td>{euro(project.quote.hourlyRate)}</td>
                <td>{euro(project.quote.laborEuro)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl className="quote-sum">
          <div>
            <dt>Imponibile</dt>
            <dd>{euro(totals.net)}</dd>
          </div>
          <div>
            <dt>IVA {meta.vatPercent}%</dt>
            <dd>{euro(totals.vat)}</dd>
          </div>
          <div className="grand">
            <dt>Totale</dt>
            <dd>{euro(totals.gross)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <RiskNotice trade={project.trade} />
        <h3>Condizioni</h3>
        <p className="detail" style={{ whiteSpace: 'pre-wrap' }}>
          {meta.notes}
        </p>
        <p className="help">
          Stima basata sulle misure indicate, soggetta a sopralluogo. Per lavori su impianti, gas, strutture o in quota è richiesto un tecnico abilitato.
        </p>
        <div className="signs">
          <span>Per accettazione (firma cliente)</span>
          <span>Data</span>
        </div>
      </section>
    </article>
  )
}
