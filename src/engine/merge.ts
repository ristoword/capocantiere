import type { JobBody, Project } from '../domain/types'
import { reprice } from './reprice'

export function mergeProject(existing: Project, computed: JobBody): Project {
  const materials = computed.materials.map((line) => {
    const previous = existing.materials.find((item) => item.id === line.id)
    return previous ? { ...line, unitPrice: previous.unitPrice } : line
  })
  const phases = computed.phases.map((item) => {
    const previous = existing.phases.find((phase) => phase.id === item.id)
    if (!previous) return item
    return {
      ...item,
      done: previous.done,
      photoIds: previous.photoIds,
      visualNote: previous.visualNote,
      aiText: previous.aiText,
      guide: previous.guide ?? null,
      photoConsistent: previous.photoConsistent ?? null,
      questions: item.questions.map((question) => {
        const old = previous.questions.find((entry) => entry.id === question.id)
        return old ? { ...question, answer: old.answer } : question
      }),
    }
  })
  const checklist = computed.checklist.map((item) => {
    const previous = existing.checklist.find((entry) => entry.id === item.id)
    return previous ? { ...item, checked: previous.checked } : item
  })
  return reprice({
    ...computed,
    materials,
    phases,
    checklist,
    quote: { ...computed.quote, hourlyRate: existing.quote.hourlyRate },
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    photoIds: existing.photoIds,
    aiDiagnosis: existing.aiDiagnosis,
    modelDiagnosis: existing.modelDiagnosis ?? null,
    diagnosisError: existing.diagnosisError ?? '',
    chat: existing.chat ?? [],
    quoteReview: existing.quoteReview ?? null,
  })
}
