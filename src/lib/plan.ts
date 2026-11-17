import type { User } from '../context/Auth'

/** Prezzo mensile dell'abbonamento in euro (deve coincidere con il prezzo creato su Stripe). */
export const SUBSCRIPTION_PRICE = 4.99

export const isExpired = (user: User | null): boolean => user?.plan?.status === 'expired'

/** Giorni interi rimasti (almeno 1 finché la scadenza non è passata). */
export function daysLeft(until: number | undefined, now = Date.now()): number {
  if (!until || until <= now) return 0
  return Math.max(1, Math.ceil((until - now) / 86400000))
}

/** Dentro l'app Android (Trusted Web Activity) il referrer iniziale è android-app://: lo ricordiamo.
 *  Google Play vieta il pagamento esterno dentro l'app, quindi lì si nascondono i pulsanti Stripe. */
export function inPlayApp(): boolean {
  try {
    if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) localStorage.setItem('cc-play', '1')
    return localStorage.getItem('cc-play') === '1'
  } catch {
    return false
  }
}
