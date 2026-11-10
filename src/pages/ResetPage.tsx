import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/http'

/** Pagina aperta dal link di recupero password (email o link dell'amministratore). */
export function ResetPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/api/auth/reset', { method: 'POST', body: { token, password } })
      setDone(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Operazione non riuscita.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="brand-mark">🔑</span>
          <div>
            <strong>Nuova password</strong>
            <em>Capocantiere</em>
          </div>
        </div>
        {done ? (
          <>
            <p className="banner">✅ Password cambiata. Ora puoi accedere.</p>
            <a className="btn solid" href="/">
              Vai all’accesso
            </a>
          </>
        ) : (
          <>
            {!token ? <p className="banner err">Link non valido: manca il codice.</p> : null}
            <label className="field">
              <span className="field-label">Scegli la nuova password</span>
              <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              <small>Almeno 8 caratteri.</small>
            </label>
            {error ? <p className="banner err" role="alert">{error}</p> : null}
            <button type="submit" className="btn solid" disabled={busy || !token}>
              {busy ? 'Attendi…' : 'Salva la nuova password'}
            </button>
            <p className="help auth-foot">
              <Link to="/">Torna all’accesso</Link>
            </p>
          </>
        )}
      </form>
    </div>
  )
}
