import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, planOf } from '../context/Auth'
import { euro } from '../lib/format'
import { useT } from '../lib/i18n'
import { api } from '../lib/http'
import { daysLeft, inPlayApp, SUBSCRIPTION_PRICE } from '../lib/plan'
import { Tx } from '../lib/translate'

/** Pagamento (se attivo sul server) e stato dell'abbonamento. Con la prova finita i dati restano leggibili ed esportabili. */
export function PaywallPage() {
  const { user } = useAuth()
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plan = planOf(user)
  const expired = plan.status === 'expired'
  const price = euro(SUBSCRIPTION_PRICE)

  async function go(path: '/api/billing/checkout' | '/api/billing/portal') {
    setBusy(true)
    setError(null)
    try {
      const { url } = await api<{ url: string }>(path, { method: 'POST', body: {} })
      if (!/^https:\/\//.test(url)) throw new Error(t('plan.checkoutFail'))
      window.location.assign(url) // pagina di pagamento ospitata da Stripe: i dati della carta non passano da qui
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('plan.checkoutFail'))
      setBusy(false)
    }
  }

  async function exportData() {
    try {
      const response = await fetch('/api/data/export', { credentials: 'same-origin' })
      if (!response.ok) throw new Error(t('plan.checkoutFail'))
      const link = document.createElement('a')
      link.href = URL.createObjectURL(await response.blob())
      link.download = `capocantiere-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('plan.checkoutFail'))
    }
  }

  const status =
    plan.status === 'trial'
      ? daysLeft(plan.until) <= 1
        ? t('plan.trialLeft1')
        : t('plan.trialLeft', { days: daysLeft(plan.until) })
      : plan.status === 'active'
        ? t('plan.active', { date: new Date(plan.until ?? 0).toLocaleDateString() })
        : plan.status === 'unlimited'
          ? t('plan.unlimited')
          : t('plan.expired')

  return (
    <div className="page paywall">
      <p className="kicker">{t('plan.section')}</p>
      <h1>{expired ? t('plan.expiredTitle') : t('plan.title')}</h1>
      <p className="lede">{t('plan.lede')}</p>
      <section className="card stack plan-card">
        <p className="plan-price">
          <strong>{t('plan.price', { price })}</strong>
        </p>
        <ul className="perks">
          <li>✅ {t('plan.perks1')}</li>
          <li>✅ {t('plan.perks2')}</li>
          <li>✅ {t('plan.perks3')}</li>
          <li>✅ {t('plan.perks4')}</li>
        </ul>
        <p className={expired ? 'banner warn' : 'banner'} role="status">
          {status}
        </p>
        {error ? (
          <p className="banner err" role="alert">
            {error}
          </p>
        ) : null}
        {plan.status === 'unlimited' ? null : inPlayApp() ? (
          <p className="banner">
            <Tx>Per abbonarti vai su capocantiere-production.up.railway.app dal browser, accedi con lo stesso account e attiva l'abbonamento: qui nell'app si sbloccherà da solo.</Tx>
          </p>
        ) : user?.billing.enabled ? (
          <div className="inline-actions">
            {plan.status !== 'active' ? (
              <button type="button" className="btn solid" disabled={busy} onClick={() => void go('/api/billing/checkout')}>
                {t('plan.pay')}
              </button>
            ) : null}
            {user.billing.manageable ? (
              <button type="button" className="btn" disabled={busy} onClick={() => void go('/api/billing/portal')}>
                {t('plan.manage')}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="banner warn">{t('plan.notReady')}</p>
        )}
        <p className="help">{t('plan.cancelHelp')}</p>
        <p className="help">{t('plan.safe')}</p>
        <div className="inline-actions">
          <button type="button" className="btn" onClick={() => void exportData()}>
            {t('plan.exportAnyway')}
          </button>
          <Link className="btn ghost" to="/">
            {t('nav.home')}
          </Link>
        </div>
      </section>
    </div>
  )
}
