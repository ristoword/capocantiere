// Abbonamento mensile con Stripe (Checkout + portale clienti + webhook firmato). Nessuna libreria: solo fetch e HMAC.
import crypto from 'node:crypto'

const STRIPE = 'https://api.stripe.com/v1'

export const billingConfigured = (env) => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID && env.APP_URL)

function flatten(input, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(input)) {
    const name = prefix ? `${prefix}[${key}]` : key
    if (value && typeof value === 'object') flatten(value, name, out)
    else if (value !== undefined && value !== null) out.append(name, String(value))
  }
  return out
}

async function stripe(env, path, body) {
  const response = await fetch(`${STRIPE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: flatten(body).toString(),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(json?.error?.message || `Stripe ${response.status}`), { status: 502 })
  return json
}

export async function createCheckout(env, user) {
  const base = String(env.APP_URL).replace(/\/$/, '')
  return stripe(env, '/checkout/sessions', {
    mode: 'subscription',
    line_items: { 0: { price: env.STRIPE_PRICE_ID, quantity: 1 } },
    client_reference_id: user.id,
    ...(user.stripe_customer ? { customer: user.stripe_customer } : { customer_email: user.email }),
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    success_url: `${base}/account?abbonamento=ok`,
    cancel_url: `${base}/abbonamento`,
  })
}

export async function createPortal(env, user) {
  const base = String(env.APP_URL).replace(/\/$/, '')
  return stripe(env, '/billing_portal/sessions', { customer: user.stripe_customer, return_url: `${base}/account` })
}

/** Verifica la firma Stripe-Signature (t=...,v1=...) sul corpo grezzo; tolleranza 5 minuti. */
export function verifyWebhook(rawBody, header, secret, now = Date.now()) {
  if (!secret || !header) return false
  const parts = Object.fromEntries(String(header).split(',').map((item) => item.split('=')))
  const timestamp = Number(parts.t)
  if (!parts.v1 || !Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex')
  const left = Buffer.from(expected)
  const right = Buffer.from(String(parts.v1))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

/** Dal evento Stripe ricava l'azione da applicare: chi, fino a quando, e il cliente Stripe. */
export function interpretEvent(event) {
  const object = event?.data?.object ?? {}
  if (event?.type === 'checkout.session.completed') {
    return { userId: object.client_reference_id || null, customer: object.customer || '', until: null }
  }
  if (typeof event?.type === 'string' && event.type.startsWith('customer.subscription.')) {
    const end = object.current_period_end ?? object.items?.data?.[0]?.current_period_end
    const live = ['active', 'trialing', 'past_due'].includes(object.status)
    return {
      userId: object.metadata?.user_id || null,
      customer: object.customer || '',
      until: live && Number.isFinite(end) ? end * 1000 : 0,
    }
  }
  return null
}
