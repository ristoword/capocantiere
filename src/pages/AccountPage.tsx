import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EMPTY_PROFILE, useAccount, type BusinessProfile } from '../context/Account'
import { useAuth } from '../context/Auth'
import { defaultLaborRate, defaultMaterialPrice, LABOR_LABELS, MATERIAL_LABELS, parsePriceCsv, priceCsvTemplate, type PriceMap } from '../domain/priceBook'
import { api } from '../lib/http'

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
  const { user, logout } = useAuth()
  const { profile, prices, saveProfile, savePrices } = useAccount()
  const [form, setForm] = useState<BusinessProfile>({ ...EMPTY_PROFILE, ...profile })
  const [draft, setDraft] = useState<PriceMap>({ ...prices })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  const say = (ok: boolean, text: string) => setMsg({ ok, text })
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
      <p className="kicker">Account</p>
      <h1>{user?.name || user?.email}</h1>
      <p className="lede">
        {user?.email}
        {user?.isAdmin ? ' · amministratore' : ''}
      </p>
      {msg ? (
        <p className={msg.ok ? 'banner' : 'banner err'} role="status">
          {msg.text}
        </p>
      ) : null}

      <div className="account-grid">
        <form className="card stack" onSubmit={submitProfile}>
          <h2>La tua attività</h2>
          <p className="help">Compaiono nell’intestazione dei preventivi per i clienti.</p>
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
            Salva dati attività
          </button>
        </form>

        <section className="card stack">
          <h2>Backup dei tuoi dati</h2>
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
              Esci
            </button>
            <button type="button" className="btn danger" onClick={() => void removeAccount()}>
              Cancella account e dati
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
