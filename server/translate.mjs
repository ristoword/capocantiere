// Traduzione dei testi dell'app (italiano → inglese/spagnolo) con cache condivisa nel database.
// I testi fissi (mestieri, campi, guide generate dal motore) sono uguali per tutti: si traducono una volta sola.
import crypto from 'node:crypto'

export const LANG_NAMES = { en: 'English', es: 'Spanish (Spain)' }
const MAX_TEXTS = 60
const MAX_CHARS = 1200
const CHUNK = 25

const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 32)

export function createTranslator(env, db) {
  const key = String(env.OPENAI_API_KEY || '').trim()
  const model = String(env.OPENAI_MODEL || '').trim() || 'gpt-4o-mini'
  const base = String(env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const get = db.prepare('SELECT out FROM translations WHERE lang = ? AND hash = ?')
  const put = db.prepare('INSERT OR REPLACE INTO translations (lang, hash, src, out) VALUES (?, ?, ?, ?)')

  async function upstream(lang, items) {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 2500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `You translate the text of a home-renovation assistant app from Italian into ${LANG_NAMES[lang]}. ` +
              'Input: a JSON object {"items": [strings]}. Output: a JSON object {"items": [strings]} with exactly the same number of items in the same order. ' +
              'Keep numbers, units, symbols, emojis, line breaks (\\n), quotation marks and any {placeholders} unchanged. ' +
              'Use the correct technical vocabulary of the building trades (plumbing, electrics, masonry, drywall, painting, tiling, roofing). ' +
              'Do not add explanations and do not shorten the text. If an item is already in the target language or is a proper name, return it unchanged.',
          },
          { role: 'user', content: JSON.stringify({ items }) },
        ],
      }),
    })
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error('Servizio AI non configurato'), { status: 502 })
    const json = await response.json().catch(() => null)
    if (!response.ok) throw Object.assign(new Error(json?.error?.message || `AI ${response.status}`), { status: 502 })
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? '{}')
    const usage = json?.usage ?? {}
    return { items: parsed.items, tokensIn: Number(usage.prompt_tokens) || 0, tokensOut: Number(usage.completion_tokens) || 0 }
  }

  /** Restituisce { traduzioni: {originale: tradotto}, usage }. I testi non traducibili restano fuori dalla mappa. */
  async function translate(lang, texts) {
    if (!LANG_NAMES[lang]) throw Object.assign(new Error('Lingua non supportata'), { status: 400 })
    const unique = [...new Set(texts.map((text) => String(text)).filter((text) => text.trim() && text.length <= MAX_CHARS && /\p{L}/u.test(text)))].slice(0, MAX_TEXTS)
    const map = {}
    const missing = []
    for (const text of unique) {
      const hit = get.get(lang, hashOf(text))
      if (hit) map[text] = hit.out
      else missing.push(text)
    }
    const usage = { tokensIn: 0, tokensOut: 0, calls: 0, model }
    if (missing.length && !key) throw Object.assign(new Error('Traduzione non disponibile: manca la chiave AI del server.'), { status: 503 })
    for (let index = 0; index < missing.length; index += CHUNK) {
      const slice = missing.slice(index, index + CHUNK)
      const result = await upstream(lang, slice)
      usage.tokensIn += result.tokensIn
      usage.tokensOut += result.tokensOut
      usage.calls += 1
      // Si accetta il blocco solo se è coerente: stesso numero di voci e tutte testuali. Altrimenti restano in italiano.
      if (!Array.isArray(result.items) || result.items.length !== slice.length || !result.items.every((item) => typeof item === 'string' && item.trim())) continue
      slice.forEach((source, position) => {
        const out = result.items[position]
        map[source] = out
        put.run(lang, hashOf(source), source, out)
      })
    }
    return { map, usage }
  }

  return { translate, enabled: Boolean(key) }
}
