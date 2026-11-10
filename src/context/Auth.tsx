import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, ApiError, UNAUTH_EVENT } from '../lib/http'

const USER_CACHE = 'capocantiere-last-user'

export interface User {
  id: string
  email: string
  name: string
  isAdmin: boolean
}

export type SignupMode = 'open' | 'invite' | 'closed'

interface AuthValue {
  user: User | null
  signup: SignupMode
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; password: string; name: string; invite: string }) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [signup, setSignup] = useState<SignupMode>('closed')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: User | null; signup: SignupMode }>('/api/auth/me')
      setUser(me.user)
      setSignup(me.signup)
      try {
        if (me.user) localStorage.setItem(USER_CACHE, JSON.stringify(me.user))
        else localStorage.removeItem(USER_CACHE)
      } catch {
        /* archivio non disponibile */
      }
    } catch (error) {
      // Senza rete si riapre l'app con l'ultimo utente collegato: i dati sono la copia locale.
      let cached: User | null = null
      if (error instanceof ApiError && error.status === 0) {
        try {
          cached = JSON.parse(localStorage.getItem(USER_CACHE) ?? 'null') as User | null
        } catch {
          cached = null
        }
      }
      setUser(cached)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onUnauth = () => setUser(null)
    window.addEventListener(UNAUTH_EVENT, onUnauth)
    return () => window.removeEventListener(UNAUTH_EVENT, onUnauth)
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: { email, password } })
    setUser(result.user)
  }, [])

  const register = useCallback(async (input: { email: string; password: string; name: string; invite: string }) => {
    const result = await api<{ user: User }>('/api/auth/register', { method: 'POST', body: input })
    setUser(result.user)
  }, [])

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    try {
      localStorage.removeItem(USER_CACHE)
      localStorage.removeItem('capocantiere-account-cache')
      for (const key of Object.keys(localStorage)) if (key.startsWith('capocantiere-cache-')) localStorage.removeItem(key)
    } catch {
      /* niente */
    }
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, signup, loading, login, register, logout, refresh }), [user, signup, loading, login, register, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Accesso non inizializzato')
  return value
}
