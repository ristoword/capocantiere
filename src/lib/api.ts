import { FIELDS } from '../domain/fields'
import type { Difficulty, JobBody, ModelDiagnosis, Phase, Settings } from '../domain/types'
import { tradeById } from '../domain/trades'
import { euro, numIt } from './format'

interface ChatResponse {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

const DIFFICULTIES: Difficulty[] = ['bassa', 'media', 'alta', 'critica']

const SYSTEM_DIAGNOSIS = [
  'Sei un capocantiere prudente. Rispondi solo con un oggetto JSON, in italiano, senza markdown.',
  'Chiavi obbligatorie: problem (stringa), difficulty (bassa | media | alta | critica), criticalPoints (array di stringhe), safety (array di stringhe), procedureNotes (stringa).',
  'problem è il problema probabile. procedureNotes sono note di procedura, non un elenco di prezzi.',
  'I numeri, i prezzi, le rese, i chili, i litri e i codici che ricevi sono fatti già calcolati: non li cambiare e non inventarne altri.',
  'Non inventare codici prodotto, sistemi certificati, titoli di video o ID YouTube.',
  'Se non ti sono state allegate immagini, non scrivere di aver visto una foto.',
  'Per elettricità, tetti e gas richiama l’obbligo di fermarsi se non si è qualificati.',
].join(' ')

const SYSTEM_PHASE = [
  'Sei un capocantiere prudente. Rispondi solo con un oggetto JSON, in italiano, senza markdown.',
  'Chiavi obbligatorie: consistent (boolean), note (stringa).',
  'consistent è true solo se la foto della fase è compatibile con il lavoro descritto. Se non c’è una foto allegata, consistent deve essere false.',
  'Non inventare misure, prezzi, codici prodotto o sistemi certificati. I numeri che ricevi sono già calcolati e non vanno modificati.',
].join(' ')

export class ModelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelError'
  }
}

function redact(message: string, key: string): string {
  const secret = key.trim()
  if (!secret) return message
  return message.split(secret).join('***')
}

function contentText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const content = (value as { content?: unknown }).content
  return typeof content === 'string' ? content.trim() : ''
}

export function parseJsonContent(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(raw)
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new ModelError(`La risposta del modello non contiene ${label}.`)
  }
  const items = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
  if (!items.length) throw new ModelError(`La risposta del modello non contiene ${label}.`)
  return items
}

export function parseDiagnosis(value: unknown): Omit<ModelDiagnosis, 'photosSent'> {
  if (!value || typeof value !== 'object') {
    throw new ModelError('La risposta del modello non è un oggetto JSON.')
  }
  const record = value as Record<string, unknown>
  const problem = typeof record.problem === 'string' ? record.problem.trim() : ''
  if (!problem) throw new ModelError('La risposta del modello non contiene il problema probabile.')
  const difficulty = record.difficulty
  if (typeof difficulty !== 'string' || !DIFFICULTIES.includes(difficulty as Difficulty)) {
    throw new ModelError('La risposta del modello non contiene una difficoltà valida.')
  }
  const procedureNotes = typeof record.procedureNotes === 'string' ? record.procedureNotes.trim() : ''
  if (!procedureNotes) throw new ModelError('La risposta del modello non contiene le note di procedura.')
  return {
    problem,
    difficulty: difficulty as Difficulty,
    criticalPoints: stringList(record.criticalPoints, 'i punti critici'),
    safety: stringList(record.safety, 'le note di sicurezza'),
    procedureNotes,
  }
}

export function parsePhaseCheck(value: unknown): { consistent: boolean; note: string } {
  if (!value || typeof value !== 'object') {
    throw new ModelError('La risposta del modello non è un oggetto JSON.')
  }
  const record = value as Record<string, unknown>
  if (typeof record.consistent !== 'boolean') {
    throw new ModelError('La risposta del modello non dice se la foto della fase è coerente.')
  }
  const note = typeof record.note === 'string' ? record.note.trim() : ''
  if (!note) throw new ModelError('La risposta del modello non contiene la nota di verifica.')
  return { consistent: record.consistent, note }
}

export function factsBlock(job: JobBody): string {
  const trade = tradeById(job.trade)
  const measures = FIELDS[job.trade]
    .map((field) => {
      const value = job.inputs[field.key]
      if (value === undefined) return ''
      const label =
        field.type === 'select'
          ? (field.options?.find((option) => option.value === String(value))?.label ?? String(value))
          : typeof value === 'boolean'
            ? value
              ? 'sì'
              : 'no'
            : String(value)
      return `- ${field.label}: ${label}${field.unit ? ` ${field.unit}` : ''}`
    })
    .filter(Boolean)
    .join('\n')
  const materials = job.materials
    .map((line) => `- ${line.name}: ${numIt(line.quantity)} ${line.unit}, prezzo unitario ${euro(line.unitPrice)}`)
    .join('\n')
  const steps = job.calcSteps.map((item) => `- ${item.label}: ${item.result} (${item.formula})`).join('\n')
  const slope = job.slope
    ? `Pendenza calcolata: ${numIt(job.slope.percent, 1)}% = ${numIt(job.slope.cmPerMeter, 1)} cm/m; su ${numIt(job.slope.lengthM, 1)} m il dislivello è ${numIt(job.slope.totalCm, 1)} cm.`
    : 'Nessuna pendenza calcolata.'
  return [
    `Mestiere: ${trade.name} (${trade.id}).`,
    `Titolo: ${job.title || 'senza titolo'}.`,
    `Descrizione dell’utente: ${job.description || 'nessuna descrizione'}.`,
    `Rilievo già calcolato: ${job.currentState}`,
    job.areaM2 !== undefined ? `Superficie di riferimento calcolata: ${numIt(job.areaM2)} m².` : '',
    'Misure inserite:',
    measures || '- nessuna misura strutturata',
    'FATTI CALCOLATI, da non modificare e da non sostituire:',
    slope,
    'Quantità e prezzi:',
    materials || '- nessun materiale',
    `Ore: ${numIt(job.quote.laborHours, 1)}. Tariffa: ${euro(job.quote.hourlyRate)}/h. Manodopera: ${euro(job.quote.laborEuro)}. Materiali: ${euro(job.quote.materialsEuro)}. Totale: ${euro(job.quote.totalEuro)}.`,
    'Passaggi di calcolo:',
    steps || '- nessuno',
    'Fasi già previste (checklist guida, non riscriverle come video):',
    job.phases.map((phase, index) => `${index + 1}. ${phase.title}`).join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
}

export function diagnosisPrompt(job: JobBody, imageCount: number): string {
  return [
    factsBlock(job),
    imageCount > 0
      ? `Immagini allegate: ${imageCount}. Usale per il problema probabile. Non dire di averne viste altre.`
      : 'Nessuna immagine allegata. Non scrivere di aver analizzato una foto.',
    'Restituisci il JSON richiesto. Non proporre quantità o prezzi diversi da quelli elencati.',
  ].join('\n\n')
}

export function phasePrompt(job: JobBody, phase: Phase, imageCount: number): string {
  return [
    factsBlock(job),
    `Fase da verificare: ${phase.title}.`,
    `Istruzioni guida di questa fase (non sono una lettura della foto): ${phase.detail}`,
    'Domande di autocontrollo:',
    ...phase.questions.map((question) => `- ${question.text} Risposta attuale: ${question.answer ?? 'non data'}`),
    phase.visualNote ? `Nota di cantiere scritta dall’utente: ${phase.visualNote}` : 'Nessuna nota di cantiere.',
    imageCount > 0
      ? `Foto di questa fase allegate: ${imageCount}. Di’ se sono coerenti con la fase.`
      : 'Nessuna foto di fase allegata. consistent deve essere false.',
  ].join('\n')
}

export type ChatPart = { type: string; text?: string; image_url?: { url: string } }
export interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatPart[]
}

/** Chiama il modello. Con chiave nel browser va diretto; senza, passa dal proxy locale che tiene la chiave sul server. */
export async function callChat(
  settings: Settings,
  messages: ChatMsg[],
  options: { json: boolean; temperature?: number; maxTokens?: number },
): Promise<string> {
  const key = settings.apiKey.trim()
  const direct = key.length > 0
  const base = (settings.baseUrl.trim() || DEFAULT_BASE).replace(/\/$/, '')
  const url = direct ? `${base}/chat/completions` : '/api/ai/chat'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (direct) headers.Authorization = `Bearer ${key}`
  else headers['X-Requested-With'] = 'capocantiere' // richiesto dal nostro server (anti-CSRF)
  const body: Record<string, unknown> = { temperature: options.temperature ?? 0.2, messages }
  if (direct) body.model = settings.model.trim() || 'gpt-4o-mini'
  if (options.json) body.response_format = { type: 'json_object' }
  if (options.maxTokens) body.max_tokens = options.maxTokens
  let response: Response
  try {
    response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new ModelError('Nessuna risposta dal servizio. Controlla la rete e che l’app sia avviata con npm run dev.')
  }
  let data: ChatResponse
  try {
    data = (await response.json()) as ChatResponse
  } catch {
    if (!direct) {
      throw new ModelError(
        'Il proxy AI non risponde. Avvia l’app con npm run dev (o npm start) oppure incolla una chiave in Impostazioni.',
      )
    }
    throw new ModelError(`Il servizio ha risposto senza JSON (errore ${response.status}).`)
  }
  if (!response.ok) {
    const raw = data.error?.message || `Il modello ha risposto con errore ${response.status}.`
    throw new ModelError(redact(raw, key))
  }
  const text = contentText(data.choices?.[0]?.message)
  if (!text) throw new ModelError('Il modello non ha restituito testo. Nessun testo di riserva è stato usato.')
  return text
}

async function completeJson(settings: Settings, system: string, userText: string, images: string[]): Promise<unknown> {
  const content: ChatPart[] = [{ type: 'text', text: userText }]
  for (const url of images) {
    if (url.trim()) content.push({ type: 'image_url', image_url: { url } })
  }
  const text = await callChat(
    settings,
    [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
    { json: true },
  )
  try {
    return parseJsonContent(text)
  } catch {
    throw new ModelError('Il modello non ha restituito un JSON leggibile. Nessuna diagnosi di riserva è stata usata.')
  }
}

export { completeJson }

const DEFAULT_BASE = 'https://api.openai.com/v1'

export async function diagnoseJob(settings: Settings, job: JobBody, images: string[]): Promise<ModelDiagnosis> {
  const attached = images.map((url) => url.trim()).filter(Boolean)
  const parsed = await completeJson(settings, SYSTEM_DIAGNOSIS, diagnosisPrompt(job, attached.length), attached)
  const reading = parseDiagnosis(parsed)
  return { ...reading, photosSent: attached.length > 0 }
}

export async function verifyPhase(
  settings: Settings,
  job: JobBody,
  phase: Phase,
  images: string[],
): Promise<{ consistent: boolean; note: string }> {
  const attached = images.map((url) => url.trim()).filter(Boolean)
  const parsed = await completeJson(settings, SYSTEM_PHASE, phasePrompt(job, phase, attached.length), attached)
  const reading = parsePhaseCheck(parsed)
  if (attached.length === 0 && reading.consistent) {
    throw new ModelError('Il modello ha detto che la foto è coerente, ma non gli è stata inviata alcuna foto.')
  }
  return reading
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Lettura foto non riuscita'))
    reader.readAsDataURL(blob)
  })
}
