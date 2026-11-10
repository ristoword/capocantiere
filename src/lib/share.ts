import type { Project } from '../domain/types'
import { tradeById } from '../domain/trades'
import { euro, numIt, qty } from './format'

/** Riepilogo del preventivo in testo semplice, pronto da incollare in WhatsApp o in una mail. */
export function quoteText(project: Project): string {
  const lines = project.materials.map(
    (line) => `• ${line.name}: ${qty(line.quantity)} ${line.unit} × ${euro(line.unitPrice)} = ${euro(line.quantity * line.unitPrice)}`,
  )
  return [
    `PREVENTIVO — ${project.title} (${tradeById(project.trade).name})`,
    '',
    'MATERIALI',
    ...lines,
    '',
    `Materiali: ${euro(project.quote.materialsEuro)}`,
    `Manodopera: ${numIt(project.quote.laborHours, 1)} h × ${euro(project.quote.hourlyRate)} = ${euro(project.quote.laborEuro)}`,
    `TOTALE: ${euro(project.quote.totalEuro)}`,
    '',
    'Stima indicativa, non vincolante. Prezzi e consumi da verificare sulla scheda tecnica dei prodotti scelti.',
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
