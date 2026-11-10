import { round2 } from '../calc/number'
import type {
  CalcStep,
  CheckItem,
  InputValue,
  JobDraft,
  MaterialLine,
  Phase,
  TechNote,
  SourceType,
} from '../domain/types'
import { ytSearch } from '../lib/youtube'

export const VERIFY =
  'Consumo di riferimento — verificare sulla scheda tecnica del prodotto scelto.'

const PIECE_UNITS = new Set(['pz', 'rotoli', 'scatole', 'bustine', 'cartucce', 'fogli', 'kit'])

export function num(inputs: Record<string, InputValue>, key: string, fallback = 0): number {
  const value = inputs[key]
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export function str(inputs: Record<string, InputValue>, key: string, fallback = ''): string {
  const value = inputs[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

export function flag(inputs: Record<string, InputValue>, key: string, fallback = false): boolean {
  const value = inputs[key]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value === 'true' || value === 'si' || value === '1'
  return fallback
}

export function mat(
  id: string,
  name: string,
  quantity: number,
  unit: string,
  unitPrice: number,
  wasteLabel: string,
  measureNote: string,
  sourceNote: string,
): MaterialLine {
  const safe = Number.isFinite(quantity) ? quantity : 0
  const qty = PIECE_UNITS.has(unit) ? (safe <= 0 ? 0 : Math.ceil(safe - 1e-9)) : round2(safe)
  return {
    id,
    name,
    quantity: qty,
    unit,
    unitPrice,
    wasteLabel,
    measureNote,
    sourceNote,
  }
}

export function phase(
  trade: string,
  slug: string,
  title: string,
  detail: string,
  videoQuery: string,
  questionTexts: string[],
): Phase {
  const id = `fase:${trade}:${slug}`
  return {
    id,
    title,
    detail,
    videoQuery,
    videoUrl: ytSearch(videoQuery),
    done: false,
    photoIds: [],
    questions: questionTexts.map((text, index) => ({
      id: `${id}:q${index + 1}`,
      text,
      answer: null,
    })),
    visualNote: '',
    aiText: '',
    photoConsistent: null,
  }
}

export function note(text: string, source: SourceType): TechNote {
  return { text, source }
}

export function checks(trade: string, texts: string[]): CheckItem[] {
  return texts.map((text, index) => ({
    id: `chk:${trade}:${index + 1}`,
    text,
    checked: false,
  }))
}

export function step(label: string, formula: string, result: string): CalcStep {
  return { label, formula, result }
}

export function quoted(draft: JobDraft): string {
  const text = draft.description.trim()
  return text ? `«${text}»` : 'nessuna descrizione'
}

export function missingPhoto(draft: JobDraft, points: string[]): string[] {
  if (draft.hasPhotos) return points
  return ['Manca ancora una foto: aggiungi un campo largo e un particolare del punto.', ...points]
}
