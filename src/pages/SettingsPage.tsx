import { useEffect, useState, type FormEvent } from 'react'
import type { Settings } from '../domain/types'
import { callChat } from '../lib/api'
import { Tx } from '../lib/translate'
import {
  DEFAULT_SETTINGS,
  envConfig,
  forgetBrowserSettings,
  interpretSettings,
  keySource,
  loadSettings,
  maskKey,
  readBrowserSettings,
  saveSettings,
} from '../storage/settings'

export function SettingsPage() {
  const env = envConfig()
  const stored = readBrowserSettings()
  const [settings, setSettings] = useState<Settings>(() => ({
    apiKey: stored?.apiKey ?? '',
    baseUrl: stored?.baseUrl || env.baseUrl,
    model: stored?.model || env.model,
    ignoreEnvKey: stored?.ignoreEnvKey === true,
  }))
  const [saved, setSaved] = useState(false)
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function runTest() {
    setTesting(true)
    setTest(null)
    try {
      const answer = await callChat(
        loadSettings(),
        [{ role: 'user', content: 'Rispondi solo con la parola: pronto' }],
        { json: false, maxTokens: 10 },
      )
      setTest({ ok: true, text: `Connessione riuscita: il modello ha risposto «${answer.slice(0, 40)}».` })
    } catch (reason) {
      setTest({ ok: false, text: reason instanceof Error ? reason.message : 'Prova non riuscita.' })
    } finally {
      setTesting(false)
    }
  }
  const [server, setServer] = useState<{ configured: boolean; model: string } | null>(null)

  useEffect(() => {
    fetch('/api/ai/status')
      .then((response) => response.json())
      .then((data: { configured: boolean; model: string }) => setServer(data))
      .catch(() => setServer(null))
  }, [])
  const [activeSource, setActiveSource] = useState(keySource)
  const [activeMask, setActiveMask] = useState(() => maskKey(loadSettings().apiKey))

  function refreshStatus(next: Settings | null) {
    const resolved = interpretSettings(env, next)
    setActiveSource(resolved.source)
    setActiveMask(maskKey(resolved.settings.apiKey))
  }

  function persist(event: FormEvent) {
    event.preventDefault()
    const next: Settings = {
      ...settings,
      apiKey: settings.apiKey.trim(),
      ignoreEnvKey: settings.ignoreEnvKey === true && settings.apiKey.trim().length === 0,
    }
    saveSettings(next)
    setSettings(next)
    refreshStatus(next)
    setSaved(true)
  }

  const envMask = maskKey(env.apiKey)
  const draft = interpretSettings(env, settings)

  return (
    <div className="page narrow">
      <p className="kicker"><Tx>Impostazioni</Tx></p>
      <h1><Tx>Chiave del modello.</Tx></h1>
      <p className="lede">
        <Tx>Quantità, materiali, pendenza e preventivo si calcolano in questo browser anche senza chiave. La diagnosi delle
        foto e la verifica di una fase chiamano il modello: se la chiave manca o la risposta non è valida, compare un
        errore e non un testo finto.</Tx>
      </p>
      <p className={server?.configured ? 'banner' : 'banner warn'}>
        {server?.configured
          ? `Chiave AI sul server attiva (modello ${server.model}): l’app funziona senza incollare nulla e la chiave non arriva mai al browser.`
          : 'Nessuna chiave AI sul server. Metti OPENAI_API_KEY in .env.local e riavvia, oppure incolla una chiave qui sotto.'}
      </p>
      <p className="banner">
        {activeSource === 'env'
          ? `In uso adesso: chiave dell’ambiente ${activeMask}. Non è scritta nel codice.`
          : activeSource === 'browser'
            ? `In uso adesso: chiave scritta in questo browser ${activeMask}. Ha la precedenza sull’ambiente.`
            : server?.configured
              ? 'In uso adesso: la chiave del server. Qui sotto puoi, se vuoi, usarne una tua.'
              : 'In uso adesso: nessuna chiave. L’assistente AI non può partire.'}
      </p>
      <p className="help">
        {env.apiKey
          ? `Ambiente: ${envMask}. Indirizzo ${env.baseUrl}, modello ${env.model}.`
          : server?.configured
            ? 'Non serve fare nulla: la chiave è già configurata sul server (.env.local).'
            : `Nessuna chiave configurata. Metti OPENAI_API_KEY in .env.local e riavvia l’app, oppure incollala qui sotto. Indirizzo predefinito ${DEFAULT_SETTINGS.baseUrl}, modello ${DEFAULT_SETTINGS.model}.`}
      </p>
      <div className="actions" style={{ margin: '0.8rem 0' }}>
        <button type="button" className="btn solid" disabled={testing} onClick={() => void runTest()}>
          <Tx>{testing ? 'Provo…' : '🔌 Prova la connessione AI'}</Tx>
        </button>
      </div>
      {test ? <p className={test.ok ? 'banner' : 'banner err'}>{test.text}</p> : null}
      <form className="card stack" onSubmit={persist}>
        <label className="field">
          <span className="field-label"><Tx>Chiave da usare in questo browser</Tx></span>
          <input
            type="password"
            autoComplete="off"
            value={settings.apiKey}
            onChange={(event) => setSettings({ ...settings, apiKey: event.target.value, ignoreEnvKey: false })}
            placeholder={env.apiKey ? 'Vuota: resta la chiave dell’ambiente' : 'Incolla la chiave'}
          />
        </label>
        <label className="field">
          <span className="field-label"><Tx>Indirizzo base, compatibile OpenAI</Tx></span>
          <input
            value={settings.baseUrl}
            onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label"><Tx>Modello</Tx></span>
          <input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} />
        </label>
        {env.apiKey ? (
          <label className="check">
            <input
              type="checkbox"
              checked={settings.ignoreEnvKey === true && settings.apiKey.trim().length === 0}
              onChange={(event) => setSettings({ ...settings, apiKey: '', ignoreEnvKey: event.target.checked })}
            />
            <Tx>Non usare la chiave dell’ambiente in questo browser</Tx>
          </label>
        ) : null}
        <p className="help">
          <Tx>{draft.source === 'browser'
            ? 'Al salvataggio questa chiave scritta qui avrà la precedenza.'
            : draft.source === 'env'
              ? 'Al salvataggio, con il campo vuoto, resta la chiave dell’ambiente.'
              : server?.configured
                ? 'Con il campo vuoto continuerai a usare la chiave del server.'
                : 'Al salvataggio non ci sarà una chiave utilizzabile.'}</Tx>
        </p>
        <div className="actions">
          <button className="btn solid" type="submit">
            <Tx>Salva in questo browser</Tx>
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              forgetBrowserSettings()
              const next = { apiKey: '', baseUrl: env.baseUrl, model: env.model, ignoreEnvKey: false }
              setSettings(next)
              refreshStatus(null)
              setSaved(true)
            }}
          >
            <Tx>Dimentica il salvataggio</Tx>
          </button>
        </div>
        {saved ? <p className="banner"><Tx>✅ Salvato solo su questo dispositivo.</Tx></p> : null}
      </form>
    </div>
  )
}
