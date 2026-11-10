import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/Auth'
import { api } from '../lib/http'
import { copyText } from '../lib/share'

interface Overview {
  budget: number
  monthCost: number
  model: string
  emailEnabled: boolean
  users: { id: string; email: string; name: string; isAdmin: boolean; createdAt: string; projects: number; photoMb: number; calls: number; cost: number }[]
  days: { day: string; calls: number; cost: number }[]
}

const usd = (value: number) => `${value.toFixed(value < 1 ? 3 : 2)} $`

export function AdminPage() {
  const { user } = useAuth()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<{ email: string; url: string } | null>(null)
  const [backups, setBackups] = useState<{ name: string; bytes: number }[]>([])

  const load = useCallback(async () => {
    try {
      setData(await api<Overview>('/api/admin/overview'))
      setBackups((await api<{ backups: { name: string; bytes: number }[] }>('/api/admin/backups')).backups)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Dati non disponibili.')
    }
  }, [])

  useEffect(() => {
    if (user?.isAdmin) void load()
  }, [user?.isAdmin, load])

  if (!user?.isAdmin) return <Navigate to="/" replace />

  async function resetLink(id: string) {
    try {
      const result = await api<{ link: string; email: string }>('/api/admin/reset-link', { method: 'POST', body: { userId: id } })
      setLink({ email: result.email, url: result.link })
      void copyText(result.link)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Link non creato.')
    }
  }

  const pct = data && data.budget > 0 ? Math.min(100, Math.round((data.monthCost / data.budget) * 100)) : 0

  return (
    <div className="page">
      <p className="kicker">Amministrazione</p>
      <h1>Utenti, costi e backup</h1>
      {error ? <p className="banner err">{error}</p> : null}
      {data ? (
        <>
          <div className="kpis">
            <div className="kpi">
              <span>Spesa AI del mese (stima)</span>
              <strong>{usd(data.monthCost)}</strong>
            </div>
            <div className="kpi">
              <span>Budget mensile</span>
              <strong>{data.budget > 0 ? usd(data.budget) : 'nessun limite'}</strong>
            </div>
            <div className="kpi">
              <span>Modello</span>
              <strong>{data.model}</strong>
            </div>
            <div className="kpi">
              <span>Email di recupero</span>
              <strong>{data.emailEnabled ? 'attiva' : 'non attiva'}</strong>
            </div>
          </div>
          {data.budget > 0 ? (
            <div className="progress" aria-label={`Budget usato ${pct}%`}>
              <i style={{ width: `${pct}%` }} />
            </div>
          ) : (
            <p className="help">Imposta <code>MONTHLY_BUDGET_USD</code> su Railway per fermare l’AI quando la spesa stimata raggiunge il tetto.</p>
          )}
          <p className="help">Le cifre sono stime in dollari calcolate dai token restituiti da OpenAI: il conto reale è sul tuo account OpenAI.</p>

          <h2>Utenti</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Lavori</th>
                  <th>Foto</th>
                  <th>AI (mese)</th>
                  <th>Costo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.users.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.email}
                      {item.isAdmin ? ' 👑' : ''}
                      <br />
                      <small className="help">{item.name}</small>
                    </td>
                    <td>{item.projects}</td>
                    <td>{item.photoMb} MB</td>
                    <td>{item.calls}</td>
                    <td>{usd(item.cost)}</td>
                    <td>
                      <button type="button" className="btn sm" onClick={() => void resetLink(item.id)}>
                        🔑 Link reset password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {link ? (
            <p className="banner">
              Link per <strong>{link.email}</strong> (valido 1 ora, copiato negli appunti): <code style={{ wordBreak: 'break-all' }}>{link.url}</code>
            </p>
          ) : null}

          <h2>Ultimi 30 giorni</h2>
          {data.days.length === 0 ? (
            <p className="help">Ancora nessun consumo registrato.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Giorno</th>
                    <th>Richieste</th>
                    <th>Costo stimato</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.days].reverse().map((day) => (
                    <tr key={day.day}>
                      <td>{day.day}</td>
                      <td>{day.calls}</td>
                      <td>{usd(day.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>Backup del database</h2>
          <p className="help">
            Il server crea una copia automatica ogni 12 ore e tiene le ultime 7 sul Volume. Scarica anche una copia sul tuo computer: così i dati sopravvivono anche se il Volume andasse perso.
          </p>
          <div className="inline-actions">
            <a className="btn solid" href="/api/admin/backup">
              ⬇️ Scarica una copia del database
            </a>
            <button type="button" className="btn ghost" onClick={() => void load()}>
              ↻ Aggiorna
            </button>
          </div>
          {backups.length > 0 ? (
            <ul className="help">
              {backups.map((item) => (
                <li key={item.name}>
                  {item.name} · {(item.bytes / 1024 / 1024).toFixed(2)} MB
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : error ? null : (
        <p>Carico…</p>
      )}
    </div>
  )
}
