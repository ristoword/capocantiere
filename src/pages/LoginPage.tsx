import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LangSwitch } from '../components/LangSwitch'
import { useAuth } from '../context/Auth'
import { euro } from '../lib/format'
import { useT } from '../lib/i18n'
import { api } from '../lib/http'
import { SUBSCRIPTION_PRICE } from '../lib/plan'

export function LoginPage() {
  const { signup, login, register } = useAuth()
  const t = useT()
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
        setInfo(result.emailEnabled ? t('auth.forgotSent') : t('auth.forgotNoMail'))
      } else if (mode === 'login') await login(email, password)
      else await register({ email, password, name, invite })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('auth.failed'))
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
            <em>{t('brand.tagline')}</em>
          </div>
        </div>
        <div className="tabs" style={{ position: 'static' }} role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            {t('auth.login')}
          </button>
          {signup !== 'closed' ? (
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
              {t('auth.register')}
            </button>
          ) : null}
        </div>
        {mode === 'register' ? <p className="banner">{t('auth.trialPromo', { price: euro(SUBSCRIPTION_PRICE) })}</p> : null}
        {mode === 'register' ? (
          <label className="field">
            <span className="field-label">{t('auth.name')}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} />
          </label>
        ) : null}
        <label className="field">
          <span className="field-label">{t('auth.email')}</span>
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        {mode !== 'forgot' ? (
          <label className="field">
            <span className="field-label">{t('auth.password')}</span>
            <input
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' ? <small>{t('auth.min8')}</small> : null}
          </label>
        ) : null}
        {mode === 'register' && signup === 'invite' ? (
          <label className="field">
            <span className="field-label">{t('auth.invite')}</span>
            <input required value={invite} onChange={(event) => setInvite(event.target.value)} autoComplete="off" />
            <small>{t('auth.inviteHelp')}</small>
          </label>
        ) : null}
        {mode === 'register' ? (
          <label className="check-row">
            <input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>
              {t('auth.legalPre')}
              <Link to="/privacy" target="_blank">{t('auth.privacy')}</Link> {t('auth.and')} <Link to="/termini" target="_blank">{t('auth.terms')}</Link>.
            </span>
          </label>
        ) : null}
        {signup === 'closed' && mode === 'login' ? <p className="help">{t('auth.closed')}</p> : null}
        {error ? <p className="banner err" role="alert">{error}</p> : null}
        <button type="submit" className="btn solid" disabled={busy}>
          {busy ? t('common.wait') : mode === 'login' ? t('auth.login') : mode === 'forgot' ? t('auth.sendLink') : t('auth.register')}
        </button>
        {info ? <p className="banner" role="status">{info}</p> : null}
        {mode === 'login' ? (
          <button type="button" className="btn ghost sm" onClick={() => { setMode('forgot'); setError(null); setInfo(null) }}>
            {t('auth.forgot')}
          </button>
        ) : null}
        {mode === 'forgot' ? (
          <button type="button" className="btn ghost sm" onClick={() => { setMode('login'); setInfo(null) }}>
            {t('auth.backLogin')}
          </button>
        ) : null}
        <LangSwitch compact />
        <p className="help auth-foot">
          <Link to="/privacy">Privacy</Link> · <Link to="/termini">{t('auth.terms')}</Link>
        </p>
      </form>
    </div>
  )
}
