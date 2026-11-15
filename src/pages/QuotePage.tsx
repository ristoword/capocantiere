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
import { localeOf } from '../lib/i18n'
import { EMPTY_PROFILE } from '../context/Account'
import { Tx } from '../lib/translate'

const EMPTY_CLIENT: ClientInfo = { name: '', address: '', phone: '', email: '' }
const day = (iso: string | Date) => new Intl.DateTimeFormat(localeOf(), { dateStyle: 'long' }).format(new Date(iso))

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

  if (!ready) return <p className="page"><Tx>Preparo il preventivo…</Tx></p>
  if (!project || !meta) {
    return (
      <div className="page">
        <h1><Tx>Fascicolo non trovato</Tx></h1>
        <Link className="btn solid" to="/">
          <Tx>Torna alla dashboard</Tx>
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
    if (!Number.isFinite(meta?.vatPercent)) throw new Error('IVA non valida')
    await saveProject({ ...current, updatedAt: new Date().toISOString() })
    setNote('✅ Dati del preventivo salvati.')
  }

  return (
    <article className="page sheet">
      <div className="actions no-print">
        <Link className="btn" to={`/progetto/${project.id}`}>
          <Tx>← Torna al fascicolo</Tx>
        </Link>
        <button
          type="button"
          className="btn solid"
          onClick={() => {
            void save()
              .then(() => window.print())
              .catch((reason: unknown) => setNote(`⚠️ Salvataggio non riuscito: ${reason instanceof Error ? reason.message : 'riprova'}`))
          }}
        >
          <Tx>🖨 Stampa o salva PDF</Tx>
        </button>
        <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>
          <Tx>💬 WhatsApp</Tx>
        </a>
        <a
          className="btn"
          href={`mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(`Preventivo ${meta.number} — ${project.title}`)}&body=${encodeURIComponent(message)}`}
        >
          <Tx>✉️ Email</Tx>
        </a>
        <button type="button" className="btn" onClick={async () => setNote((await copyText(message)) ? '✅ Testo copiato.' : 'Copia non riuscita.')}>
          <Tx>📋 Copia testo</Tx>
        </button>
        <button type="button" className="btn" onClick={() => void save().catch((reason: unknown) => setNote(`⚠️ Salvataggio non riuscito: ${reason instanceof Error ? reason.message : 'riprova'}`))}>
          <Tx>💾 Salva</Tx>
        </button>
      </div>
      {note ? <p className="banner no-print">{note}</p> : null}

      <section className="card no-print quote-form">
        <h2><Tx>Dati del preventivo</Tx></h2>
        {!profile.businessName ? (
          <p className="banner warn">
            <Tx>Non hai ancora inserito i dati della tua attività:</Tx> <Link to="/account"><Tx>completali nell’Account</Tx></Link> <Tx>per intestare il preventivo.</Tx>
          </p>
        ) : null}
        <div className="grid-form">
          <label className="field">
            <span className="field-label"><Tx>Cliente</Tx></span>
            <input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label"><Tx>Indirizzo del cantiere</Tx></span>
            <input value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label"><Tx>Telefono</Tx></span>
            <input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label"><Tx>Email cliente</Tx></span>
            <input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label"><Tx>Numero preventivo</Tx></span>
            <input value={meta.number} onChange={(e) => setMeta({ ...meta, number: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label"><Tx>IVA %</Tx></span>
            <input type="number" min={0} max={30} value={meta.vatPercent} onChange={(e) => setMeta({ ...meta, vatPercent: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0 })} />
          </label>
          <label className="field">
            <span className="field-label"><Tx>Validità (giorni)</Tx></span>
            <input type="number" min={1} max={365} value={meta.validDays} onChange={(e) => setMeta({ ...meta, validDays: Number.isFinite(Number(e.target.value)) && Number(e.target.value) > 0 ? Number(e.target.value) : 30 })} />
          </label>
        </div>
        <label className="field">
          <span className="field-label"><Tx>Condizioni e note</Tx></span>
          <textarea value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
        </label>
      </section>

      <header className="quote-head">
        <div>
          {profile.logo ? <img className="quote-logo" src={profile.logo} alt="" /> : null}
          <h1>{business || <Tx>Preventivo</Tx>}</h1>
          <p>
            {profile.address}
            {profile.address ? <br /> : null}
            {profile.vatId ? (
              <>
                <Tx>P. IVA</Tx> {profile.vatId}
                <br />
              </>
            ) : null}
            {[profile.phone, profile.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="quote-meta">
          <p className="kicker"><Tx>Preventivo n.</Tx> {meta.number}</p>
          <p><Tx>Data:</Tx> {day(meta.issuedAt)}</p>
          <p><Tx>Valido fino al</Tx> {day(validUntil(meta.issuedAt, meta.validDays))}</p>
        </div>
      </header>

      <section className="quote-client">
        <h3><Tx>Cliente</Tx></h3>
        <p>
          <strong>{client.name || '—'}</strong>
          <br />
          {client.address}
          {client.address ? <br /> : null}
          {[client.phone, client.email].filter(Boolean).join(' · ')}
        </p>
        <h3><Tx>Lavoro</Tx></h3>
        <p>
          <strong>{project.title}</strong> — <Tx>{trade.name}</Tx>
        </p>
      </section>

      <section>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th><Tx>Voce</Tx></th>
                <th><Tx>Q.tà</Tx></th>
                <th><Tx>Prezzo</Tx></th>
                <th><Tx>Importo</Tx></th>
              </tr>
            </thead>
            <tbody>
              {project.materials.map((line) => (
                <tr key={line.id}>
                  <td><Tx>{line.name}</Tx></td>
                  <td>
                    {qty(line.quantity)} <Tx>{line.unit}</Tx>
                  </td>
                  <td>{euro(line.unitPrice)}</td>
                  <td>{euro(line.quantity * line.unitPrice)}</td>
                </tr>
              ))}
              <tr>
                <td><Tx>Manodopera</Tx></td>
                <td>{numIt(project.quote.laborHours, 1)} <Tx>h</Tx></td>
                <td>{euro(project.quote.hourlyRate)}</td>
                <td>{euro(project.quote.laborEuro)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl className="quote-sum">
          <div>
            <dt><Tx>Imponibile</Tx></dt>
            <dd>{euro(totals.net)}</dd>
          </div>
          <div>
            <dt><Tx>IVA</Tx> {meta.vatPercent}%</dt>
            <dd>{euro(totals.vat)}</dd>
          </div>
          <div className="grand">
            <dt><Tx>Totale</Tx></dt>
            <dd>{euro(totals.gross)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <RiskNotice trade={project.trade} />
        <h3><Tx>Condizioni</Tx></h3>
        <p className="detail" style={{ whiteSpace: 'pre-wrap' }}>
          {meta.notes === EMPTY_PROFILE.terms ? <Tx>{meta.notes}</Tx> : meta.notes}
        </p>
        <p className="help">
          <Tx>Stima basata sulle misure indicate, soggetta a sopralluogo. Per lavori su impianti, gas, strutture o in quota è richiesto un tecnico abilitato.</Tx>
        </p>
        <div className="signs">
          <span><Tx>Per accettazione (firma cliente)</Tx></span>
          <span><Tx>Data</Tx></span>
        </div>
      </section>
    </article>
  )
}
