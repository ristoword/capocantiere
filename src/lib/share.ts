import type { Project } from '../domain/types'
import { tradeById } from '../domain/trades'
import { euro, numIt, qty } from './format'
import { translate } from './i18n'
import { tx } from './translate'

/** Riepilogo del preventivo in testo semplice, pronto da incollare in WhatsApp o in una mail. */
export function quoteText(project: Project): string {
  const lines = project.materials.map(
    (line) => `• ${tx(line.name)}: ${qty(line.quantity)} ${tx(line.unit)} × ${euro(line.unitPrice)} = ${euro(line.quantity * line.unitPrice)}`,
  )
  return [
    `${translate('q.title')} — ${project.title} (${tx(tradeById(project.trade).name)})`,
    '',
    translate('q.materialsCaps'),
    ...lines,
    '',
    `${translate('q.materials')}: ${euro(project.quote.materialsEuro)}`,
    `${translate('q.labor')}: ${numIt(project.quote.laborHours, 1)} h × ${euro(project.quote.hourlyRate)} = ${euro(project.quote.laborEuro)}`,
    `${translate('q.total')}: ${euro(project.quote.totalEuro)}`,
    '',
    translate('q.noteLong'),
  ].join('\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}
