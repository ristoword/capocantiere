import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/Auth'
import { useStore } from '../context/Store'
import { hasApiKey } from '../storage/settings'

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

const LINKS = [
  { to: '/', label: 'Dashboard', ico: '🏠', end: true },
  { to: '/nuovo', label: 'Nuovo lavoro', ico: '➕', end: false },
  { to: '/account', label: 'Account e listino', ico: '👤', end: false },
  { to: '/impostazioni', label: 'Chiave AI', ico: '⚙️', end: false },
]

export function Shell() {
  const { error, pending, online, problem, dismissProblem } = useStore()
  const { user } = useAuth()
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const ai = useAiReady()
  return (
    <div className="app">
      <aside className="sidebar no-print">
        <Link to="/" className="brand">
          <span className="brand-mark">🛠️</span>
          <span>
            <strong>Capocantiere</strong>
            <em>Il tuo assistente di cantiere</em>
          </span>
        </Link>
        <nav className="nav" aria-label="Menu principale">
          {[...LINKS, ...(user?.isAdmin ? [{ to: '/admin', label: 'Amministrazione', ico: '🛡️', end: false }] : [])].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span className="ico">{item.ico}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/nuovo" className="btn solid side-cta">
          📷 Parti da una foto
        </Link>
        <div className="side-foot">
          <span className={ai ? 'ai-pill on' : 'ai-pill off'}>{ai ? 'Assistente AI attivo' : 'AI non configurata'}</span>
          <p>Prezzi e quantità sono indicativi: verifica sempre la scheda tecnica del prodotto.</p>
        </div>
      </aside>
      <div className="main">
        <header className="topbar-m no-print">
          <Link to="/" className="brand">
            <span className="brand-mark">🛠️</span>
            <strong>Capocantiere</strong>
          </Link>
          <span className={ai ? 'ai-pill on' : 'ai-pill off'}>{ai ? 'AI attiva' : 'AI off'}</span>
        </header>
        {!online || pending > 0 ? (
          <p className="banner warn no-print" role="status">
            {!online ? '📴 Sei offline: puoi continuare a lavorare, le modifiche si inviano da sole quando torna la rete.' : '🔄 Sincronizzo le modifiche fatte offline…'}
            {pending > 0 ? ` (${pending} in attesa)` : ''}
          </p>
        ) : null}
        {problem ? (
          <p className="banner err no-print" role="alert">
            {problem}{' '}
            <button type="button" className="btn sm" onClick={dismissProblem}>
              Ho capito
            </button>
          </p>
        ) : null}
        {error ? <p className="banner err no-print">{error}</p> : null}
        <main className="wrap">
          <Outlet />
        </main>
        <nav className="bottom-nav no-print" aria-label="Menu">
          <NavLink to="/" end>
            <span className="ico">🏠</span>Home
          </NavLink>
          <NavLink to="/nuovo" className="plus">
            <span className="ico">＋</span>Nuovo
          </NavLink>
          <NavLink to="/account">
            <span className="ico">👤</span>Account
          </NavLink>
        </nav>
      </div>
    </div>
  )
}
