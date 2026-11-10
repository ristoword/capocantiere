import { searchVideos } from './youtube.mjs'

// Proxy AI locale: la chiave resta sul server (variabile OPENAI_API_KEY), mai nel bundle del browser.
const MAX_BODY = 8 * 1024 * 1024 // chat con al più qualche foto già ridotta
const ALLOWED = ['messages', 'temperature', 'response_format', 'max_tokens']

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Richiesta troppo grande'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// Se OpenAI rifiuta la chiave del server non va inoltrato un 401 (il browser lo scambierebbe per sessione scaduta).
function upstreamAuthError(res, status) {
  console.error(`OpenAI ha rifiutato la chiave del server (stato ${status}): controlla OPENAI_API_KEY.`)
  return send(res, 502, { error: { message: 'Il servizio AI non è configurato correttamente. Avvisa l’amministratore.' } })
}

export function createAiMiddleware(env, hooks = {}) {
  const key = String(env.OPENAI_API_KEY || '').trim()
  const model = String(env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini'
  const imageModel = String(env.OPENAI_IMAGE_MODEL || '').trim() || 'gpt-image-1-mini'
  const base = String(env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  return async function aiMiddleware(req, res, next) {
    const url = (req.url || '').split('?')[0]
    if (url === '/api/ai/status' && req.method === 'GET') {
      return send(res, 200, { configured: Boolean(key), model })
    }
    if (url === '/api/yt/search' && req.method === 'GET') {
      try {
        const q = new URL(req.url || '', 'http://localhost').searchParams.get('q') || ''
        return send(res, 200, { videos: await searchVideos(q, env) })
      } catch (error) {
        return send(res, 502, { error: { message: error instanceof Error ? error.message : 'Ricerca video non riuscita' } })
      }
    }
    if (url === '/api/ai/image') {
      if (req.method !== 'POST') return send(res, 405, { error: { message: 'Metodo non consentito' } })
      if (!key) return send(res, 503, { error: { message: 'Il server non ha la chiave AI (OPENAI_API_KEY in .env.local).' } })
      try {
        const incoming = JSON.parse(await readBody(req))
        const prompt = String(incoming.prompt || '').slice(0, 1500)
        if (!prompt.trim()) return send(res, 400, { error: { message: 'Descrizione immagine mancante' } })
        const upstream = await fetch(`${base}/images/generations`, {
          signal: AbortSignal.timeout(90_000),
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: imageModel, prompt, size: '1024x1024', quality: 'low', n: 1 }),
        })
        if (upstream.status === 401 || upstream.status === 403) return upstreamAuthError(res, upstream.status)
        const text = await upstream.text()
        if (upstream.ok) hooks.onUsage?.(req, { kind: 'image', model: imageModel, tokensIn: 0, tokensOut: 0 })
        res.statusCode = upstream.status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(text.split(key).join('***'))
      } catch (error) {
        return send(res, 502, { error: { message: error instanceof Error ? error.message : 'Errore del proxy immagini' } })
      }
    }
    if (url !== '/api/ai/chat') return next()
    if (req.method !== 'POST') return send(res, 405, { error: { message: 'Metodo non consentito' } })
    if (!key) {
      return send(res, 503, {
        error: { message: 'Il server non ha la chiave AI (OPENAI_API_KEY in .env.local). Riavvia dopo averla aggiunta.' },
      })
    }
    try {
      const incoming = JSON.parse(await readBody(req))
      const payload = { model }
      for (const name of ALLOWED) if (incoming[name] !== undefined) payload[name] = incoming[name]
      // Tetti di costo: nessuna richiesta può chiedere risposte enormi.
      payload.max_tokens = Math.min(Math.max(Number(payload.max_tokens) || 1200, 1), 2500)
      if (payload.temperature !== undefined) payload.temperature = Math.min(Math.max(Number(payload.temperature) || 0, 0), 1.2)
      if (!Array.isArray(payload.messages)) {
        return send(res, 400, { error: { message: 'Richiesta senza messaggi' } })
      }
      const upstream = await fetch(`${base}/chat/completions`, {
        signal: AbortSignal.timeout(90_000),
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (upstream.status === 401 || upstream.status === 403) return upstreamAuthError(res, upstream.status)
      const text = await upstream.text()
      if (upstream.ok) {
        try {
          const usage = JSON.parse(text).usage ?? {}
          hooks.onUsage?.(req, { kind: 'chat', model, tokensIn: Number(usage.prompt_tokens) || 0, tokensOut: Number(usage.completion_tokens) || 0 })
        } catch {
          /* risposta senza uso: non si registra */
        }
      }
      res.statusCode = upstream.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(text.split(key).join('***'))
    } catch (error) {
      send(res, 502, { error: { message: error instanceof Error ? error.message : 'Errore del proxy AI' } })
    }
  }
}
