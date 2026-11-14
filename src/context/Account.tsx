import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { applyPriceBook, type PriceMap } from '../domain/priceBook'
import { detectRegion, REGION_CODES, type RegionCode } from '../domain/regions'
import { api } from '../lib/http'
import { useT } from '../lib/i18n'

/** Paese del listino: quello scelto nel profilo, altrimenti dedotto dalla lingua del dispositivo. */
export function regionFor(profile: { country?: string } | null | undefined): RegionCode {
  const chosen = String(profile?.country ?? '').toUpperCase()
  return (REGION_CODES as string[]).includes(chosen) ? (chosen as RegionCode) : detectRegion()
}

const CACHE = 'capocantiere-account-cache'

export interface BusinessProfile {
  businessName: string
  vatId: string
  address: string
  phone: string
  email: string
  logo: string
  vatPercent: number
  validDays: number
  terms: string
  /** Paese del listino prezzi (IT, NL, DE, ES, BE). Vuoto = dedotto dalla lingua del dispositivo. */
  country?: string
}

export const EMPTY_PROFILE: BusinessProfile = {
  businessName: '', vatId: '', address: '', phone: '', email: '', logo: '', vatPercent: 22, validDays: 30,
  terms: 'Preventivo indicativo. Il prezzo definitivo è confermato dopo sopralluogo. Pagamento: da concordare.',
}

interface AccountValue {
  profile: BusinessProfile
  prices: PriceMap
  saveProfile: (profile: BusinessProfile) => Promise<void>
  savePrices: (prices: PriceMap) => Promise<void>
}

const AccountContext = createContext<AccountValue | null>(null)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE)
  const [prices, setPrices] = useState<PriceMap>({})
  const [loaded, setLoaded] = useState(false)
  const pricesRef = useRef(prices)
  const profileRef = useRef(profile)
  pricesRef.current = prices
  profileRef.current = profile

  useEffect(() => {
    let alive = true
    Promise.all([
      api<{ profile: Partial<BusinessProfile> }>('/api/data/profile'),
      api<{ prices: PriceMap }>('/api/data/prices'),
    ])
      .then(([p, pr]) => {
        if (!alive) return
        applyPriceBook(pr.prices, regionFor(p.profile))
        setProfile({ ...EMPTY_PROFILE, ...p.profile })
        setPrices(pr.prices)
        try {
          localStorage.setItem(CACHE, JSON.stringify({ profile: p.profile, prices: pr.prices }))
        } catch {
          /* niente copia locale */
        }
      })
      .catch(() => {
        // Offline: si usano profilo e listino dell'ultimo accesso.
        try {
          const cached = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { profile: Partial<BusinessProfile>; prices: PriceMap } | null
          if (cached && alive) {
            applyPriceBook(cached.prices, regionFor(cached.profile))
            setProfile({ ...EMPTY_PROFILE, ...cached.profile })
            setPrices(cached.prices)
          }
        } catch {
          /* niente */
        }
      })
      .finally(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [])

  const saveProfile = useCallback(async (next: BusinessProfile) => {
    await api('/api/data/profile', { method: 'PUT', body: next })
    applyPriceBook(pricesRef.current, regionFor(next)) // il paese cambia il listino predefinito dei nuovi calcoli
    setProfile(next)
  }, [])

  const savePrices = useCallback(async (next: PriceMap) => {
    await api('/api/data/prices', { method: 'PUT', body: next })
    applyPriceBook(next, regionFor(profileRef.current))
    setPrices(next)
  }, [])

  const value = useMemo(() => ({ profile, prices, saveProfile, savePrices }), [profile, prices, saveProfile, savePrices])
  const t = useT()
  if (!loaded) return <div className="splash">{t('common.loading')}</div>
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount(): AccountValue {
  const value = useContext(AccountContext)
  if (!value) throw new Error('Account non inizializzato')
  return value
}
