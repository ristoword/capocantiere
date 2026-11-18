// Verifica degli abbonamenti Google Play (Play Developer API). Nessuna libreria: JWT RS256 con node:crypto e fetch.
import crypto from 'node:crypto'

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const LIVE_STATES = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'])

export const playProduct = (env) => env.PLAY_PRODUCT_ID || 'capocantiere_mensile'

/** Chiave dell'account di servizio: JSON in chiaro oppure in base64 (comodo nelle variabili di Railway). */
export function serviceAccount(env) {
  let raw = String(env.PLAY_SERVICE_ACCOUNT_JSON || '').trim()
  if (!raw) return null
  if (/^'[\s\S]*'$/.test(raw)) raw = raw.slice(1, -1).trim() // apici attorno all'intero JSON
  if (!raw.startsWith('{')) {
    try {
      raw = Buffer.from(raw, 'base64').toString('utf8').trim()
    } catch {
      return null
    }
  }
  let json = null
  try {
    json = JSON.parse(raw)
  } catch {
    // Alcuni pannelli trasformano i \n della chiave in a-capo veri o raddoppiano le barre: si estraggono i due campi a mano.
    const mail = /"client_email"\s*:\s*"([^"]+)"/.exec(raw)?.[1]
    const key = /"private_key"\s*:\s*"(-----BEGIN[\s\S]*?-----END [A-Z ]+-----)/.exec(raw)?.[1]
    if (mail && key) json = { client_email: mail, private_key: key }
  }
  if (!json?.client_email || typeof json.private_key !== 'string') return null
  const privateKey = json.private_key.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '')
  return { ...json, private_key: privateKey }
}

export const playConfigured = (env) => Boolean(serviceAccount(env) && env.ANDROID_PACKAGE)

const b64 = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

let cached = { token: '', exp: 0, mail: '' }

async function accessToken(env, doFetch) {
  const account = serviceAccount(env)
  if (cached.token && cached.mail === account.client_email && cached.exp > Date.now() + 60_000) return cached.token
  const now = Math.floor(Date.now() / 1000)
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`
  const signature = crypto.createSign('RSA-SHA256').update(head).sign(account.private_key).toString('base64url')
  const response = await doFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${signature}` }).toString(),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !json.access_token) throw Object.assign(new Error('Accesso a Google Play non riuscito'), { status: 502 })
  cached = { token: json.access_token, exp: Date.now() + Number(json.expires_in || 3600) * 1000, mail: account.client_email }
  return cached.token
}

async function call(env, doFetch, path, init = {}) {
  const token = await accessToken(env, doFetch)
  const response = await doFetch(`${API}/${encodeURIComponent(env.ANDROID_PACKAGE)}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  return { ok: response.ok, status: response.status, json: text ? JSON.parse(text) : {} }
}

/** Dalla risposta di purchases.subscriptionsv2.get ricava il prodotto, la scadenza e se l'accesso è valido adesso. */
export function interpretSubscription(data, product, now = Date.now()) {
  const item = (data?.lineItems ?? []).find((line) => line.productId === product)
  if (!item) return { valid: false, reason: 'prodotto' }
  const until = Date.parse(item.expiryTime ?? '')
  const live = LIVE_STATES.has(data.subscriptionState) && Number.isFinite(until) && until > now
  return {
    valid: live,
    until: live ? until : 0,
    reason: live ? '' : 'scaduto',
    acknowledged: data.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  }
}

/** Controlla il token d'acquisto presso Google e, se serve, lo conferma (entro 3 giorni, altrimenti Google rimborsa). */
export async function verifyPurchase(env, purchaseToken, doFetch = fetch) {
  const product = playProduct(env)
  const found = await call(env, doFetch, `purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`)
  if (!found.ok) return { valid: false, reason: found.status === 400 || found.status === 404 ? 'token' : 'google' }
  const result = interpretSubscription(found.json, product)
  if (result.valid && !result.acknowledged) {
    await call(env, doFetch, `purchases/subscriptions/${encodeURIComponent(product)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {
      method: 'POST',
      body: '{}',
    })
  }
  return result
}
