/** Chiamate alle API del server di Capocantiere (sessione via cookie, intestazione anti-CSRF). */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export const UNAUTH_EVENT = 'capocantiere-unauthorized'
/** Il server risponde 402: prova finita, serve l'abbonamento. L'app aggiorna lo stato e mostra la schermata di sblocco. */
export const PAYWALL_EVENT = 'capocantiere-paywall'

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'capocantiere',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    })
  } catch {
    throw new ApiError('Server non raggiungibile: controlla la connessione.', 0)
  }
  if (response.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event(UNAUTH_EVENT))
  if (response.status === 402) window.dispatchEvent(new Event(PAYWALL_EVENT))
  const type = response.headers.get('content-type') ?? ''
  const payload: unknown = type.includes('json') ? await response.json().catch(() => null) : null
  if (!response.ok) {
    const message = (payload as { error?: { message?: string } } | null)?.error?.message
    throw new ApiError(message || `Errore ${response.status}`, response.status)
  }
  return payload as T
}
