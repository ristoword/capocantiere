import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/Shell'
import { AuthProvider, useAuth } from './context/Auth'
import { AccountProvider } from './context/Account'
import { StoreProvider } from './context/Store'
import { LegalPage } from './pages/LegalPage'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { JobBuilderPage } from './pages/JobBuilderPage'
import { ProjectPage } from './pages/ProjectPage'
import { AccountPage } from './pages/AccountPage'
import { QuotePage } from './pages/QuotePage'
import { AdminPage } from './pages/AdminPage'
import { ResetPage } from './pages/ResetPage'
import { SitePage } from './pages/SitePage'
import { ReportPage } from './pages/ReportPage'
import { SettingsPage } from './pages/SettingsPage'

function Missing() {
  return (
    <div className="page">
      <div className="empty">
        <p style={{ fontSize: '2rem', margin: 0 }}>🧭</p>
        <h2>Pagina non trovata</h2>
        <Link className="btn solid" to="/">
          Torna alla dashboard
        </Link>
      </div>
    </div>
  )
}

/** Vecchio indirizzo /calcola: porta al nuovo costruttore, mantenendo il fascicolo se c'è. */
function OldCalc() {
  const { search } = useLocation()
  const id = new URLSearchParams(search).get('fascicolo')
  return <Navigate to={id ? `/nuovo?fascicolo=${id}` : '/nuovo'} replace />
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <div className="splash">Caricamento…</div>
  if (!user) return <LoginPage />
  return (
    <StoreProvider key={user.id}>
      <AccountProvider>
      <Routes>
        <Route element={<Shell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/nuovo" element={<JobBuilderPage />} />
            <Route path="/mestiere/:tradeId" element={<JobBuilderPage />} />
            <Route path="/calcola" element={<OldCalc />} />
            <Route path="/impostazioni" element={<SettingsPage />} />
            <Route path="/progetto/:id" element={<ProjectPage />} />
            <Route path="/progetto/:id/report" element={<ReportPage />} />
            <Route path="/progetto/:id/preventivo" element={<QuotePage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/cantiere/:name" element={<SitePage />} />
            <Route path="*" element={<Missing />} />
        </Route>
      </Routes>
      </AccountProvider>
    </StoreProvider>
  )
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/reset" element={<ResetPage />} />
          <Route path="/privacy" element={<LegalPage kind="privacy" />} />
          <Route path="/termini" element={<LegalPage kind="termini" />} />
          <Route path="*" element={<Gate />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
