import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { planOf, useAuth } from '../context/Auth'
import { useStore } from '../context/Store'
import { useT } from '../lib/i18n'
import { daysLeft } from '../lib/plan'
import { hasApiKey } from '../storage/settings'
import { LangSwitch } from './LangSwitch'

function useAiReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(hasApiKey() ? true : null)
  useEffect(() => {
    if (hasApiKey()) return
    fetch('/api/ai/status')
      .then((response) => response.json())
      .then((data: { configured: boolean }) => setReady(Boolean(data.configured)))
      .catch(() => setReady(false))
  }, [])
  return ready
}

export function Shell() {
  const { error, pending, online, problem, dismissProblem } = useStore()
  const { user } = useAuth()
  const t = useT()
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const ai = useAiReady()
  const plan = planOf(user)
  const links = [
    { to: '/', label: t('nav.home'), ico: '🏠', end: true },
    { to: '/nuovo', label: t('nav.new'), ico: '➕', end: false },
    { to: '/archivio', label: t('nav.archive'), ico: '🗂️', end: false },
    { to: '/account', label: t('nav.account'), ico: '👤', end: false },
    { to: '/impostazioni', label: t('nav.key'), ico: '⚙️', end: false },
    ...(user?.isAdmin ? [{ to: '/admin', label: t('nav.admin'), ico: '🛡️', end: false }] : []),
  ]
  return (
    <div className="app">
      <aside className="sidebar no-print">
        <Link to="/" className="brand">
          <span className="brand-mark">🛠️</span>
          <span>
            <strong>Capocantiere</strong>
            <em>{t('brand.tagline')}</em>
          </span>
        </Link>
        <nav className="nav" aria-label="Menu">
          {links.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span className="ico">{item.ico}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/nuovo" className="btn solid side-cta">
          {t('shell.cta')}
        </Link>
        <div className="side-foot">
          <LangSwitch compact />
          <span className={ai ? 'ai-pill on' : 'ai-pill off'}>{ai ? t('shell.aiOn') : t('shell.aiOff')}</span>
          <p>{t('shell.disclaimer')}</p>
        </div>
      </aside>
      <div className="main">
        <header className="topbar-m no-print">
          <Link to="/" className="brand">
            <span className="brand-mark">🛠️</span>
            <strong>Capocantiere</strong>
          </Link>
          <LangSwitch compact />
          <span className={ai ? 'ai-pill on' : 'ai-pill off'}>{ai ? t('shell.aiOnShort') : t('shell.aiOffShort')}</span>
        </header>
        {plan.status === 'trial' ? (
          <p className="banner no-print" role="status">
            {daysLeft(plan.until) <= 1 ? t('plan.trialLeft1') : t('plan.trialLeft', { days: daysLeft(plan.until) })}{' '}
            <Link className="btn sm" to="/abbonamento">
              {t('plan.subscribe')}
            </Link>
          </p>
        ) : null}
        {plan.status === 'expired' ? (
          <p className="banner warn no-print" role="alert">
            {t('plan.expiredBanner')}{' '}
            <Link className="btn sm solid" to="/abbonamento">
              {t('plan.subscribe')}
            </Link>
          </p>
        ) : null}
        {!online || pending > 0 ? (
          <p className="banner warn no-print" role="status">
            {!online ? t('shell.offline') : t('shell.syncing')}
            {pending > 0 ? ` ${t('shell.pending', { n: pending })}` : ''}
          </p>
        ) : null}
        {problem ? (
          <p className="banner err no-print" role="alert">
            {problem}{' '}
            <button type="button" className="btn sm" onClick={dismissProblem}>
              {t('shell.ok')}
            </button>
          </p>
        ) : null}
        {error ? <p className="banner err no-print">{error}</p> : null}
        <main className="wrap">
          <Outlet />
        </main>
        <nav className="bottom-nav no-print" aria-label="Menu">
          <NavLink to="/" end>
            <span className="ico">🏠</span>
            {t('nav.homeShort')}
          </NavLink>
          <NavLink to="/archivio">
            <span className="ico">🗂️</span>
            {t('nav.archive')}
          </NavLink>
          <NavLink to="/nuovo" className="plus">
            <span className="ico">＋</span>
            {t('nav.newShort')}
          </NavLink>
          <NavLink to="/account">
            <span className="ico">👤</span>
            {t('nav.accountShort')}
          </NavLink>
        </nav>
      </div>
    </div>
  )
}
