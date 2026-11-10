import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/Shell'
import { StoreProvider } from './context/Store'
import { HomePage } from './pages/HomePage'
import { JobBuilderPage } from './pages/JobBuilderPage'
import { ProjectPage } from './pages/ProjectPage'
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

export function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/nuovo" element={<JobBuilderPage />} />
            <Route path="/mestiere/:tradeId" element={<JobBuilderPage />} />
            <Route path="/calcola" element={<OldCalc />} />
            <Route path="/impostazioni" element={<SettingsPage />} />
            <Route path="/progetto/:id" element={<ProjectPage />} />
            <Route path="/progetto/:id/report" element={<ReportPage />} />
            <Route path="*" element={<Missing />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
