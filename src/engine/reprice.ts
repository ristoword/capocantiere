import { quoteTotals } from '../calc/quote'
import type { Project } from '../domain/types'

export function reprice(project: Project): Project {
  return {
    ...project,
    quote: quoteTotals(
      project.materials,
      project.quote.laborHours,
      project.quote.hourlyRate,
      project.quote.laborNote,
      project.quote.assumptions,
    ),
  }
}
