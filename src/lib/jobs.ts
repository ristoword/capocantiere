import type { Project, QuoteStatus } from '../domain/types'

export const STATUSES: QuoteStatus[] = ['bozza', 'inviato', 'accettato', 'rifiutato', 'concluso']

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  bozza: 'Bozza',
  inviato: 'Inviato',
  accettato: 'Accettato',
  rifiutato: 'Rifiutato',
  concluso: 'Concluso',
}

export const STATUS_ICON: Record<QuoteStatus, string> = {
  bozza: '📝',
  inviato: '📤',
  accettato: '✅',
  rifiutato: '❌',
  concluso: '🏁',
}

export const statusOf = (project: Project): QuoteStatus => project.status ?? 'bozza'

export interface StatusSummary {
  count: number
  total: number
}

/** Numero e importo dei preventivi per stato. */
export function summarizeByStatus(projects: Project[]): Record<QuoteStatus, StatusSummary> {
  const out = Object.fromEntries(STATUSES.map((status) => [status, { count: 0, total: 0 }])) as Record<QuoteStatus, StatusSummary>
  for (const project of projects) {
    const bucket = out[statusOf(project)]
    bucket.count += 1
    bucket.total = Math.round((bucket.total + project.quote.totalEuro) * 100) / 100
  }
  return out
}

export const siteOf = (project: Project): string => (project.siteName ?? '').trim()

/** Nomi dei cantieri (gruppi di lavori) in ordine alfabetico, senza duplicati per maiuscole. */
export function siteNames(projects: Project[]): string[] {
  const seen = new Map<string, string>()
  for (const project of projects) {
    const name = siteOf(project)
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'it'))
}

export const inSite = (project: Project, name: string): boolean => siteOf(project).toLowerCase() === name.trim().toLowerCase()

export function siteTotal(projects: Project[], name: string): { net: number; jobs: number } {
  const jobs = projects.filter((project) => inSite(project, name))
  return { net: Math.round(jobs.reduce((sum, project) => sum + project.quote.totalEuro, 0) * 100) / 100, jobs: jobs.length }
}
