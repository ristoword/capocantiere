import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/Auth'
import { api } from '../lib/http'

export function LoginPage() {
  const { signup, login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(signup === 'open' ? 'register' : 'login')
  const [info, setInfo] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'forgot') {
        const result = await api<{ emailEnabled: boolean }>('/api/auth/forgot', { method: 'POST', body: { email } })
        setInfo(
          result.emailEnabled
            ? 'Se l’email è registrata, ti abbiamo inviato un link per scegliere una nuova password (valido 1 ora).'
            : 'L’invio email non è attivo su questo server: chiedi all’amministratore un link di reset.',
        )
      } else if (mode === 'login') await login(email, password)
      else await register({ email, password, name, invite })
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
          <span className="brand-mark">🛠️</span>
          <div>
            <strong>Capocantiere</strong>
            <em>Il tuo assistente di cantiere</em>
          </div>
        </div>
        <div className="tabs" style={{ position: 'static' }} role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            Accedi
          </button>
          {signup !== 'closed' ? (
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
              Crea account
            </button>
          ) : null}
        </div>
        {mode === 'register' ? (
          <label className="field">
            <span className="field-label">Il tuo nome</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} />
          </label>
        ) : null}
        <label className="field">
          <span className="field-label">Email</span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        {mode !== 'forgot' ? (
        <label className="field">
          <span className="field-label">Password</span>
          <input
            type="password"
            required
            minLength={mode === 'register' ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'register' ? <small>Almeno 8 caratteri.</small> : null}
        </label>
        ) : null}
        {mode === 'register' && signup === 'invite' ? (
          <label className="field">
            <span className="field-label">Codice di invito</span>
            <input required value={invite} onChange={(event) => setInvite(event.target.value)} autoComplete="off" />
            <small>Te lo dà chi gestisce l’app.</small>
          </label>
        ) : null}
        {mode === 'register' ? (
          <label className="check-row">
            <input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>
              Ho letto l’<Link to="/privacy" target="_blank">informativa privacy</Link> e i <Link to="/termini" target="_blank">termini d’uso</Link>.
            </span>
          </label>
        ) : null}
        {signup === 'closed' && mode === 'login' ? <p className="help">Le registrazioni sono chiuse: serve un invito.</p> : null}
        {error ? <p className="banner err" role="alert">{error}</p> : null}
        <button type="submit" className="btn solid" disabled={busy}>
          {busy ? 'Attendi…' : mode === 'login' ? 'Accedi' : mode === 'forgot' ? 'Invia il link' : 'Crea account'}
        </button>
        {info ? <p className="banner" role="status">{info}</p> : null}
        {mode === 'login' ? (
          <button type="button" className="btn ghost sm" onClick={() => { setMode('forgot'); setError(null); setInfo(null) }}>
            Password dimenticata?
          </button>
        ) : null}
        {mode === 'forgot' ? (
          <button type="button" className="btn ghost sm" onClick={() => { setMode('login'); setInfo(null) }}>
            ← Torna all’accesso
          </button>
        ) : null}
        <p className="help auth-foot">
          <Link to="/privacy">Privacy</Link> · <Link to="/termini">Termini</Link>
        </p>
      </form>
    </div>
  )
}
