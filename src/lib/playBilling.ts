// Abbonamento Google Play dentro l'app Android (Trusted Web Activity): Digital Goods API + Payment Request.
import { api } from './http'

const BILLING = 'https://play.google.com/billing'
export const PLAY_SKU = 'capocantiere_mensile'

interface DigitalGoods {
  getDetails(ids: string[]): Promise<Array<{ itemId: string; title?: string; price?: { currency: string; value: string } }>>
  listPurchases(): Promise<Array<{ itemId: string; purchaseToken: string }>>
}

async function service(): Promise<DigitalGoods | null> {
  const w = window as unknown as { getDigitalGoodsService?: (url: string) => Promise<DigitalGoods> }
  if (typeof w.getDigitalGoodsService !== 'function') return null
  try {
    return await w.getDigitalGoodsService(BILLING)
  } catch {
    return null
  }
}

export async function playBillingAvailable(): Promise<boolean> {
  return (await service()) !== null
}

/** Prezzo con la valuta del paese dell'utente, come lo mostra Google Play. */
export async function playPriceLabel(): Promise<string | null> {
  const s = await service()
  const item = (await s?.getDetails([PLAY_SKU]).catch(() => []))?.[0]
  if (!item?.price) return null
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: item.price.currency }).format(Number(item.price.value))
  } catch {
    return `${item.price.value} ${item.price.currency}`
  }
}

/** Apre la schermata di acquisto di Google Play; il server verifica il token e sblocca l'accesso. */
export async function buyOnPlay(): Promise<void> {
  if (!(await service())) throw new Error('Google Play non è disponibile su questo dispositivo.')
  const request = new PaymentRequest([{ supportedMethods: BILLING, data: { sku: PLAY_SKU } }], {
    total: { label: 'Capocantiere', amount: { currency: 'EUR', value: '0' } },
  })
  const response = await request.show()
  try {
    const token = (response.details as { purchaseToken?: string }).purchaseToken
    if (!token) throw new Error('Acquisto non riuscito.')
    await api('/api/billing/play', { method: 'POST', body: { purchaseToken: token } })
    await response.complete('success')
  } catch (error) {
    await response.complete('fail').catch(() => undefined)
    throw error
  }
}

let synced = false

/** Riallinea il server con gli acquisti che Google Play ha già: rinnovi, nuovo telefono, app reinstallata. Una volta per avvio. */
export async function syncPlayPurchases(): Promise<boolean> {
  if (synced) return false
  synced = true
  const s = await service()
  if (!s) return false
  try {
    const own = (await s.listPurchases()).find((purchase) => purchase.itemId === PLAY_SKU)
    if (!own) return false
    await api('/api/billing/play', { method: 'POST', body: { purchaseToken: own.purchaseToken } })
    return true
  } catch {
    return false
  }
}
