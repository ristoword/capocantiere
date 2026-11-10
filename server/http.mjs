// Piccole utilità HTTP condivise dai moduli del server.
export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export const fail = (res, status, message) => send(res, status, { error: { message } })

export function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('Richiesta troppo grande'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export async function readJson(req, limit = 2 * 1024 * 1024) {
  const raw = await readRaw(req, limit)
  try {
    return raw.length ? JSON.parse(raw.toString('utf8')) : {}
  } catch {
    throw Object.assign(new Error('JSON non valido'), { status: 400 })
  }
}

export function parseCookies(header) {
  const out = {}
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=')
    if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return out
}

export function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket?.remoteAddress || 'unknown'
}

/** Limitatore a finestra fissa, in memoria. */
export function createLimiter() {
  const buckets = new Map()
  return function hit(key, max, windowMs) {
    const now = Date.now()
    const bucket = buckets.get(key)
    if (!bucket || bucket.reset <= now) {
      buckets.set(key, { count: 1, reset: now + windowMs })
      if (buckets.size > 20000) {
        for (const [name, value] of buckets) if (value.reset <= now) buckets.delete(name)
      }
      return { ok: true, retryAfter: 0 }
    }
    bucket.count += 1
    return { ok: bucket.count <= max, retryAfter: Math.ceil((bucket.reset - now) / 1000) }
  }
}
