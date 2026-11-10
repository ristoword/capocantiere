import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Settings } from '../domain/types'
import { computeJob } from '../engine/compute'
import { callChat, diagnoseJob, parseDiagnosis, verifyPhase } from './api'
import { interpretSettings, maskKey } from '../storage/settings'

const env: Settings = {
  apiKey: 'sk-env-secret-value',
  baseUrl: 'https://example.test/v1',
  model: 'model-from-env',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const sample = computeJob({
  trade: 'pittura',
  title: 'Tinteggiatura',
  description: 'Pareti umide in cucina.',
  inputs: {
    wallM2: 100,
    ceilingIncluded: true,
    ceilingM2: 20,
    coats: 2,
    primer: true,
    wastePercent: 10,
  },
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('impostazioni', () => {
  it('usa la chiave dell’ambiente se il browser non ne ha una', () => {
    const resolved = interpretSettings(env, null)
    expect(resolved.source).toBe('env')
    expect(resolved.settings.apiKey).toBe(env.apiKey)
    expect(resolved.settings.baseUrl).toBe(env.baseUrl)
    expect(resolved.settings.model).toBe(env.model)
  })

  it('fa vincere la chiave scritta nel browser', () => {
    const resolved = interpretSettings(env, {
      apiKey: 'sk-browser-secret',
      baseUrl: 'https://browser.test/v1',
      model: 'browser-model',
    })
    expect(resolved.source).toBe('browser')
    expect(resolved.settings.apiKey).toBe('sk-browser-secret')
    expect(resolved.settings.model).toBe('browser-model')
  })

  it('non ricade sull’ambiente se il browser ha disattivato la chiave', () => {
    const resolved = interpretSettings(env, { apiKey: '', baseUrl: '', model: '', ignoreEnvKey: true })
    expect(resolved.source).toBe('none')
    expect(resolved.settings.apiKey).toBe('')
    expect(resolved.settings.baseUrl).toBe(env.baseUrl)
  })

  it('maschera la chiave con prefisso e lunghezza', () => {
    const masked = maskKey(env.apiKey)
    expect(masked).toContain(String(env.apiKey.length))
    expect(masked.startsWith('sk-env')).toBe(true)
    expect(masked).not.toContain(env.apiKey)
  })
})

describe('client del modello', () => {
  it('invia misure, cifre calcolate e foto e legge il JSON', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe('gpt-4o-mini')
      expect(body.messages[1].content[0].text).toContain('24')
      expect(body.messages[1].content[1].image_url.url).toBe('data:image/png;base64,abc')
      expect(String(init?.headers && (init.headers as Record<string, string>).Authorization)).toBe('Bearer sk-test')
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                problem: 'Il fondo sfarina sotto la pittura.',
                difficulty: 'media',
                criticalPoints: ['Controllare la macchia in alto.'],
                safety: ['Arieggiare il locale.'],
                procedureNotes: 'Stuccare solo dopo che il muro è asciutto.',
              }),
            },
          },
        ],
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const reading = await diagnoseJob(
      { apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      sample,
      ['data:image/png;base64,abc'],
    )
    expect(reading.problem).toContain('sfarina')
    expect(reading.photosSent).toBe(true)
    expect(reading.difficulty).toBe('media')
    expect(sample.materials.find((line) => line.id === 'mat:pittura:idropittura')?.quantity).toBeCloseTo(24, 5)
  })

  it('verso il nostro server invia l’intestazione anti-CSRF e non la chiave', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      expect(url).toBe('/api/ai/chat')
      expect(headers['X-Requested-With']).toBe('capocantiere')
      expect(headers.Authorization).toBeUndefined()
      return jsonResponse({ choices: [{ message: { content: 'ok' } }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const answer = await callChat({ apiKey: '', baseUrl: '', model: '' }, [{ role: 'user', content: 'ciao' }], { json: false })
    expect(answer).toBe('ok')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('se il JSON non è valido non inventa una diagnosi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'non è json' } }] })))
    await expect(
      diagnoseJob({ apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }, sample, []),
    ).rejects.toThrow(/JSON leggibile/)
  })

  it('se il servizio rifiuta la chiave mostra l’errore e non un testo preconfezionato', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { message: 'Chiave rifiutata' } }, 401)),
    )
    await expect(
      diagnoseJob({ apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }, sample, []),
    ).rejects.toThrow(/Chiave rifiutata/)
  })

  it('rifiuta una verifica che dichiara la foto coerente senza averla ricevuta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          choices: [{ message: { content: JSON.stringify({ consistent: true, note: 'Sembra a posto.' }) } }],
        }),
      ),
    )
    const phase = sample.phases[0]
    await expect(
      verifyPhase({ apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }, sample, phase, []),
    ).rejects.toThrow(/non gli è stata inviata alcuna foto/)
  })

  it('accetta la verifica di una foto allegata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          choices: [{ message: { content: JSON.stringify({ consistent: false, note: 'Si vede il soffitto ancora scoperto.' }) } }],
        }),
      ),
    )
    const reading = await verifyPhase(
      { apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      sample,
      sample.phases[0],
      ['data:image/jpeg;base64,ff'],
    )
    expect(reading.consistent).toBe(false)
    expect(reading.note).toContain('soffitto')
  })

  it('non accetta un problema vuoto', () => {
    expect(() => parseDiagnosis({ problem: '  ', difficulty: 'bassa', criticalPoints: ['a'], safety: ['b'], procedureNotes: 'c' })).toThrow(
      /problema probabile/,
    )
  })
})
