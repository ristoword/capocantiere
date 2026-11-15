import type { Project } from '../domain/types'
import { tradeById } from '../domain/trades'
import { euro, numIt, qty } from './format'
import { translate } from './i18n'
import { tx } from './translate'

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export interface VatTotals {
  net: number
  vat: number
  gross: number
}

/** I prezzi del motore di calcolo sono imponibili: l'IVA si aggiunge in fondo. */
export function withVat(netEuro: number, vatPercent: number): VatTotals {
  const net = round2(netEuro)
  const vat = round2((net * Math.max(0, vatPercent)) / 100)
  return { net, vat, gross: round2(net + vat) }
}

/** Prossimo numero progressivo AAAA-NNN guardando i preventivi già emessi. */
export function nextQuoteNumber(projects: Project[], now = new Date()): string {
  const year = now.getFullYear()
  let max = 0
  for (const project of projects) {
    const match = /^(\d{4})-(\d+)$/.exec(project.quoteMeta?.number ?? '')
    if (match && Number(match[1]) === year) max = Math.max(max, Number(match[2]))
  }
  return `${year}-${String(max + 1).padStart(3, '0')}`
}

export function validUntil(issuedAt: string, validDays: number): Date {
  const date = new Date(issuedAt)
  date.setDate(date.getDate() + Math.max(0, validDays))
  return date
}

/** Testo del preventivo per WhatsApp o email, con IVA e intestazione. */
export function quoteMessage(project: Project, business: string): string {
  const meta = project.quoteMeta
  const totals = withVat(project.quote.totalEuro, meta?.vatPercent ?? 22)
  const lines = project.materials.map(
    (line) => `• ${tx(line.name)}: ${qty(line.quantity)} ${tx(line.unit)} × ${euro(line.unitPrice)} = ${euro(line.quantity * line.unitPrice)}`,
  )
  return [
    `${business ? `${business} — ` : ''}${translate('q.title')}${meta ? ` ${translate('q.n')} ${meta.number}` : ''}`,
    `${project.title} (${tx(tradeById(project.trade).name)})`,
    project.client?.name ? `${translate('q.client')}: ${project.client.name}` : '',
    '',
    ...lines,
    `${translate('q.labor')}: ${numIt(project.quote.laborHours, 1)} h × ${euro(project.quote.hourlyRate)} = ${euro(project.quote.laborEuro)}`,
    '',
    `${translate('q.net')}: ${euro(totals.net)}`,
    `${translate('q.vat')} ${meta?.vatPercent ?? 22}%: ${euro(totals.vat)}`,
    `${translate('q.total')}: ${euro(totals.gross)}`,
    '',
    translate('q.note'),
  ]
    .filter((line, index, all) => line !== '' || all[index - 1] !== '')
    .join('\n')
}
