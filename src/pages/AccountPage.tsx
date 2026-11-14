import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { InstallApp } from '../components/InstallApp'
import { LangSwitch } from '../components/LangSwitch'
import { EMPTY_PROFILE, regionFor, useAccount, type BusinessProfile } from '../context/Account'
import { planOf, useAuth } from '../context/Auth'
import { defaultLaborRate, defaultMaterialPrice, LABOR_LABELS, MATERIAL_LABELS, parsePriceCsv, priceCsvTemplate, type PriceMap } from '../domain/priceBook'
import { useStore } from '../context/Store'
import { REGIONS, regionOf } from '../domain/regions'
import { euro } from '../lib/format'
import { statusOf } from '../lib/jobs'
import { api } from '../lib/http'
import { getLang, useT } from '../lib/i18n'
import { daysLeft } from '../lib/plan'

async function logoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 300 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

export function AccountPage() {
  const { user, logout, refresh } = useAuth()
  const t = useT()
  const { profile, prices, saveProfile, savePrices } = useAccount()
  const { projects } = useStore()
  const [search, setSearch] = useSearchParams()
  const plan = planOf(user)
  const region = regionOf(regionFor(profile))
  const [form, setForm] = useState<BusinessProfile>({ ...EMPTY_PROFILE, ...profile })
  const [draft, setDraft] = useState<PriceMap>({ ...prices })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  const say = (ok: boolean, text: string) => setMsg({ ok, text })

  // Ritorno dal pagamento: lo stato arriva dal webhook di Stripe, quindi si rilegge dal server.
  useEffect(() => {
    if (search.get('abbonamento') !== 'ok') return
    setMsg({ ok: true, text: t('plan.thanks') })
    void refresh()
    const timer = window.setTimeout(() => void refresh(), 4000)
    setSearch({}, { replace: true })
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function changeRegion(code: string) {
    const next = { ...form, country: code, vatPercent: regionOf(code).vat }
    try {
      await saveProfile(next)
      setForm(next)
      say(true, t('acc.regionSaved'))
    } catch (reason) {
      fail(reason)
    }
  }
  const fail = (reason: unknown) => say(false, reason instanceof Error ? reason.message : 'Operazione non riuscita.')

  async function submitProfile(event: FormEvent) {
    event.preventDefault()
    try {
      await saveProfile(form)
      say(true, '✅ Dati dell’attività salvati.')
    } catch (reason) {
      fail(reason)
    }
  }

  async function submitPrices() {
    const clean: PriceMap = {}
    for (const [key, value] of Object.entries(draft)) if (Number.isFinite(value)) clean[key] = value
    try {
      await savePrices(clean)
      setDraft(clean)
      say(true, '✅ Listino salvato. I nuovi calcoli e i “Ricalcola” useranno questi prezzi.')
    } catch (reason) {
      fail(reason)
    }
  }

  async function importCsv(file: File) {
    const { prices: found, unknown, invalid } = parsePriceCsv(await file.text())
    const count = Object.keys(found).length
    if (count === 0) {
      say(false, 'Nessun prezzo riconosciuto. Scarica il modello CSV e compilalo (nome;prezzo).')
      return
    }
    setDraft((current) => ({ ...current, ...found }))
    const notes = [unknown.length ? `${unknown.length} nomi non riconosciuti (${unknown.slice(0, 3).join(', ')}…)` : '', invalid.length ? `${invalid.length} prezzi non validi` : ''].filter(Boolean)
    say(true, `✅ Letti ${count} prezzi dal file${notes.length ? ` — ${notes.join('; ')}` : ''}. Controlla e premi «Salva listino».`)
  }

  function downloadCsvTemplate() {
    const blob = new Blob(['﻿' + priceCsvTemplate(draft)], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'listino-capocantiere.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function downloadBackup() {
    try {
      const response = await fetch('/api/data/export', { credentials: 'same-origin' })
      if (!response.ok) throw new Error('Backup non riuscito.')
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `capocantiere-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(link.href)
      say(true, '✅ Backup scaricato: contiene lavori, foto, listino e dati attività.')
    } catch (reason) {
      fail(reason)
    }
  }

  async function restoreBackup(file: File) {
    if (!window.confirm('Ripristinare il backup? I lavori con lo stesso identificativo, il listino e i dati attività verranno sostituiti con quelli del file.')) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const result = await api<{ projects: number; photos: number }>('/api/data/import', { method: 'POST', body: parsed })
      say(true, `✅ Ripristinati ${result.projects} lavori e ${result.photos} foto. Ricarico…`)
      setTimeout(() => window.location.assign('/'), 1200)
    } catch (reason) {
      fail(reason)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget // dopo un await currentTarget non è più disponibile
    const data = new FormData(form)
    try {
      await api('/api/account/password', { method: 'POST', body: { current: data.get('current'), next: data.get('next') } })
      form.reset()
      say(true, '✅ Password cambiata.')
    } catch (reason) {
      fail(reason)
    }
  }

  async function removeAccount() {
    const password = window.prompt('Per cancellare DEFINITIVAMENTE account, lavori e foto, scrivi la tua password:')
    if (!password) return
    try {
      await api('/api/account/delete', { method: 'POST', body: { password } })
      // Via ogni copia locale di questo account (cache, coda, foto in attesa, vecchio archivio del browser).
      try {
        for (const key of Object.keys(localStorage)) if (key.startsWith('capocantiere-')) localStorage.removeItem(key)
        indexedDB.deleteDatabase('capocantiere')
      } catch {
        /* archivio non disponibile */
      }
      window.location.assign('/')
    } catch (reason) {
      fail(reason)
    }
  }

  const setPrice = (key: string, raw: string) =>
    setDraft((current) => {
      const next = { ...current }
      const value = Number(raw.replace(',', '.'))
      if (raw.trim() === '' || !Number.isFinite(value)) delete next[key]
      else next[key] = value
      return next
    })

  const set = (patch: Partial<BusinessProfile>) => setForm((current) => ({ ...current, ...patch }))

  return (
    <div className="page">
      <p className="kicker">{t('acc.title')}</p>
      <h1>{user?.name || user?.email}</h1>
      <p className="lede">
        {user?.email}
        {user?.isAdmin ? t('acc.admin') : ''}
      </p>
      {msg ? (
        <p className={msg.ok ? 'banner' : 'banner err'} role="status">
          {msg.text}
        </p>
      ) : null}

      <section className="card stack" style={{ marginBottom: '1rem' }}>
        <h2>{t('plan.section')}</h2>
        <p className={plan.status === 'expired' ? 'banner warn' : 'banner'} role="status">
          {plan.status === 'active'
            ? t('plan.active', { date: new Date(plan.until ?? 0).toLocaleDateString(getLang()) })
            : plan.status === 'trial'
              ? daysLeft(plan.until) <= 1
                ? t('plan.trialLeft1')
                : t('plan.trialLeft', { days: daysLeft(plan.until) })
              : plan.status === 'unlimited'
                ? t('plan.unlimited')
                : t('plan.expired')}
        </p>
        {plan.status === 'unlimited' ? null : (
          <div className="inline-actions">
            <Link className="btn solid" to="/abbonamento">
              {plan.status === 'active' ? t('plan.manage') : t('plan.subscribe')}
            </Link>
          </div>
        )}
      </section>

      <InstallApp />

      <section className="card stack" style={{ marginBottom: '1rem' }}>
        <h2>🗂️ {t('arch.recent')}</h2>
        {projects.length === 0 ? (
          <p className="help">{t('arch.noJobs')}</p>
        ) : (
          <ul className="mini-archive">
            {projects.slice(0, 5).map((project) => (
              <li key={project.id}>
                <Link to={`/progetto/${project.id}`}>{project.title}</Link>
                <span>
                  {project.quoteMeta?.number ? `${t('arch.number')} ${project.quoteMeta.number} · ` : ''}
                  {t(`status.${statusOf(project)}`)}
                </span>
                <b>{euro(project.quote.totalEuro)}</b>
              </li>
            ))}
          </ul>
        )}
        <div className="inline-actions">
          <Link className="btn solid" to="/archivio">
            {t('arch.openAll')}
          </Link>
        </div>
      </section>

      <section className="card stack" style={{ marginBottom: '1rem' }}>
        <h2>{t('acc.region')}</h2>
        <p className="help">{t('acc.regionHelp')}</p>
        <div className="grid-form">
          <label className="field">
            <span className="field-label">{t('common.country')}</span>
            <select value={region.code} onChange={(event) => void changeRegion(event.target.value)}>
              {REGIONS.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.flag} {item.names[getLang()]}
                </option>
              ))}
            </select>
          </label>
          <LangSwitch />
        </div>
        <p className="help">{t('acc.regionSources', { updated: region.updated })}</p>
        <details>
          <summary className="help">{region.sources.length} · {region.names[getLang()]}</summary>
          <ul className="help">
            {region.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </details>
      </section>

      <div className="account-grid">
        <form className="card stack" onSubmit={submitProfile}>
          <h2>{t('acc.business')}</h2>
          <p className="help">{t('acc.businessHelp')}</p>
          <label className="field">
            <span className="field-label">Ragione sociale / nome</span>
            <input value={form.businessName} onChange={(e) => set({ businessName: e.target.value })} maxLength={120} />
          </label>
          <label className="field">
            <span className="field-label">Partita IVA / C.F.</span>
            <input value={form.vatId} onChange={(e) => set({ vatId: e.target.value })} maxLength={30} />
          </label>
          <label className="field">
            <span className="field-label">Indirizzo</span>
            <input value={form.address} onChange={(e) => set({ address: e.target.value })} maxLength={200} />
          </label>
          <label className="field">
            <span className="field-label">Telefono</span>
            <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={40} />
          </label>
          <label className="field">
            <span className="field-label">Email di contatto</span>
            <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} maxLength={120} />
          </label>
          <div className="grid-form">
            <label className="field">
              <span className="field-label">IVA predefinita %</span>
              <input type="number" min={0} max={30} value={form.vatPercent} onChange={(e) => set({ vatPercent: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="field-label">Validità preventivo (giorni)</span>
              <input type="number" min={1} max={365} value={form.validDays} onChange={(e) => set({ validDays: Number(e.target.value) })} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Condizioni predefinite</span>
            <textarea value={form.terms} onChange={(e) => set({ terms: e.target.value })} maxLength={1500} />
          </label>
          <div className="inline-actions">
            {form.logo ? <img src={form.logo} alt="Logo" style={{ maxHeight: 48 }} /> : null}
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) {
                  try {
                    set({ logo: await logoToDataUrl(file) })
                  } catch {
                    say(false, 'Immagine non leggibile.')
                  }
                }
              }}
            />
            <button type="button" className="btn sm" onClick={() => logoRef.current?.click()}>
              🖼 {form.logo ? 'Cambia logo' : 'Carica logo'}
            </button>
            {form.logo ? (
              <button type="button" className="btn sm ghost" onClick={() => set({ logo: '' })}>
                Togli logo
              </button>
            ) : null}
          </div>
          <button type="submit" className="btn solid">
            {t('acc.save')}
          </button>
        </form>

        <section className="card stack">
          <h2>{t('acc.backup')}</h2>
          <p className="help">
            I lavori sono salvati sul server e restano anche se cambi dispositivo. Scarica comunque un backup ogni tanto: puoi ripristinarlo qui o su un altro account.
          </p>
          <div className="inline-actions">
            <button type="button" className="btn solid" onClick={() => void downloadBackup()}>
              ⬇️ Scarica backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void restoreBackup(file)
                e.target.value = ''
              }}
            />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              ⬆️ Ripristina da file
            </button>
          </div>

          <h2 style={{ marginTop: '1.2rem' }}>Sicurezza</h2>
          <form className="stack" onSubmit={changePassword}>
            <label className="field">
              <span className="field-label">Password attuale</span>
              <input name="current" type="password" required autoComplete="current-password" />
            </label>
            <label className="field">
              <span className="field-label">Nuova password</span>
              <input name="next" type="password" required minLength={8} autoComplete="new-password" />
            </label>
            <button type="submit" className="btn">
              Cambia password
            </button>
          </form>
          <div className="inline-actions">
            <button type="button" className="btn" onClick={() => void logout()}>
              {t('acc.logout')}
            </button>
            <button type="button" className="btn danger" onClick={() => void removeAccount()}>
              {t('acc.deleteAccount')}
            </button>
          </div>
          <p className="help">
            <Link to="/privacy">Privacy</Link> · <Link to="/termini">Termini d’uso</Link>
          </p>
        </section>
      </div>

      <section className="card stack" style={{ marginTop: '1rem' }}>
        <h2>Il tuo listino prezzi</h2>
        <p className="help">
          Cambia i prezzi con quelli del tuo negozio o fornitore. Lascia vuoto per usare il valore indicativo. Si applicano ai nuovi calcoli e a «Ricalcola»; i fascicoli già creati mantengono i loro prezzi.
        </p>
        <h3>Tariffe orarie (€/h)</h3>
        <div className="price-grid">
          {Object.entries(LABOR_LABELS).map(([trade, label]) => {
            const key = `labor.${trade}`
            return (
              <label key={key} className="price-row">
                <span>{label}</span>
                <input
                  inputMode="decimal"
                  className={draft[key] !== undefined ? 'changed' : ''}
                  placeholder={String(defaultLaborRate(trade))}
                  value={draft[key] ?? ''}
                  onChange={(e) => setPrice(key, e.target.value)}
                />
              </label>
            )
          })}
        </div>
        <h3>Materiali</h3>
        <div className="price-grid">
          {Object.entries(MATERIAL_LABELS).map(([key, [label, unit]]) => (
            <label key={key} className="price-row">
              <span>
                {label} <small>{unit}</small>
              </span>
              <input
                inputMode="decimal"
                className={draft[key] !== undefined ? 'changed' : ''}
                placeholder={String(defaultMaterialPrice(key))}
                value={draft[key] ?? ''}
                onChange={(e) => setPrice(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="inline-actions">
          <button type="button" className="btn solid" onClick={() => void submitPrices()}>
            Salva listino
          </button>
          <button type="button" className="btn ghost" onClick={() => setDraft({})}>
            Ripristina i valori indicativi
          </button>
          <button type="button" className="btn" onClick={downloadCsvTemplate}>
            ⬇️ Modello CSV
          </button>
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importCsv(file)
              e.target.value = ''
            }}
          />
          <button type="button" className="btn" onClick={() => csvRef.current?.click()}>
            ⬆️ Importa listino CSV
          </button>
        </div>
      </section>
    </div>
  )
}
