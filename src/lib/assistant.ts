import { FIELDS, type FieldDef } from '../domain/fields'
import { TRADES } from '../domain/trades'
import type { InputValue, JobBody, Phase, PhaseGuide, QuoteReview, Settings, TradeId, ChatMessage } from '../domain/types'
import { callChat, completeJson, factsBlock, ModelError, type ChatMsg, type ChatPart } from './api'

const BASE_RULES = [
  'Sei il Capocantiere AI: un artigiano italiano esperto, pratico, prudente e chiaro. Parli in italiano semplice, dai del tu.',
  'I numeri già calcolati nel fascicolo (quantità, prezzi, ore, totali) sono fatti: non cambiarli di nascosto. Se pensi siano sbagliati, dillo esplicitamente e spiega perché.',
  'Non inventare codici prodotto, marchi certificati, titoli di video o ID YouTube. Non dire di aver visto foto che non ti sono state allegate.',
  'Per elettricità (impianti fissi), gas, tetti in quota e strutture portanti: ricorda quando serve un professionista abilitato e fermati lì.',
].join(' ')

/* ------------------------------------------------------------------ */
/* 1. Analisi foto: capisce il lavoro e precompila mestiere e misure   */
/* ------------------------------------------------------------------ */

export interface SiteAnalysis {
  trade: TradeId
  title: string
  description: string
  whatISee: string
  confidence: 'bassa' | 'media' | 'alta'
  inputs: Record<string, InputValue>
  assumptions: string[]
  questions: string[]
}

function fieldCatalog(): string {
  return TRADES.map((trade) => {
    const fields = FIELDS[trade.id]
      .map((field) => {
        const parts = [`${field.key} (${field.type}${field.unit ? `, ${field.unit}` : ''})`]
        if (field.options) parts.push(`valori: ${field.options.map((o) => o.value).join('|')}`)
        if (field.min !== undefined) parts.push(`min ${field.min}`)
        if (field.max !== undefined) parts.push(`max ${field.max}`)
        parts.push(`predefinito ${String(field.defaultValue)}`)
        return `    - ${parts.join(', ')} — ${field.label}`
      })
      .join('\n')
    return `  ${trade.id} (${trade.name}):\n${fields}`
  }).join('\n')
}

const SYSTEM_ANALYZE = () =>
  [
    BASE_RULES,
    'Guarda le foto e la descrizione e capisci che lavoro è. Rispondi SOLO con un oggetto JSON, senza markdown.',
    'Chiavi: trade (uno degli id elencati), title (breve), description (2-3 frasi: cosa si vede e cosa va fatto), whatISee (cosa vedi davvero nelle foto, onesto), confidence (bassa|media|alta),',
    'inputs (oggetto con SOLO le chiavi del mestiere scelto, valori coerenti col tipo), assumptions (array: ogni misura che stimi a occhio e come l’hai stimata), questions (array: cosa devi chiedere all’utente per essere preciso, es. misure da prendere con il metro).',
    'Le misure che non puoi ricavare dalla foto o dal testo lasciale al valore predefinito e scrivile in questions. Non fingere precisione: una superficie stimata a occhio va dichiarata in assumptions.',
    'Mestieri e campi disponibili:',
    fieldCatalog(),
  ].join('\n')

function coerce(field: FieldDef, raw: unknown): InputValue | undefined {
  if (field.type === 'boolean') {
    if (typeof raw === 'boolean') return raw
    if (raw === 'true' || raw === 'si' || raw === 'sì') return true
    if (raw === 'false' || raw === 'no') return false
    return undefined
  }
  if (field.type === 'select') {
    const value = String(raw ?? '')
    return field.options?.some((option) => option.value === value) ? value : undefined
  }
  const parsed = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.'))
  if (!Number.isFinite(parsed)) return undefined
  let value = parsed
  if (field.min !== undefined) value = Math.max(field.min, value)
  if (field.max !== undefined) value = Math.min(field.max, value)
  return value
}

/** Tiene solo chiavi esistenti, con tipo e limiti validi. Il resto resta ai valori predefiniti. */
export function sanitizeInputs(trade: TradeId, raw: unknown): Record<string, InputValue> {
  const out: Record<string, InputValue> = {}
  for (const field of FIELDS[trade]) out[field.key] = field.defaultValue
  if (!raw || typeof raw !== 'object') return out
  const record = raw as Record<string, unknown>
  for (const field of FIELDS[trade]) {
    if (!(field.key in record)) continue
    const value = coerce(field, record[field.key])
    if (value !== undefined) out[field.key] = value
  }
  return out
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean) : []
}

const plain = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')

/** Accetta id, nome o forme vicine («Pittura», «impermeabilizzazione terrazze»). */
export function matchTrade(value: unknown): TradeId | undefined {
  if (typeof value !== 'string') return undefined
  const wanted = plain(value)
  if (!wanted) return undefined
  const exact = TRADES.find((item) => plain(item.id) === wanted || plain(item.name) === wanted)
  if (exact) return exact.id
  return TRADES.find((item) => wanted.includes(plain(item.id)) || plain(item.id).includes(wanted))?.id
}

export function parseSiteAnalysis(value: unknown): SiteAnalysis {
  if (!value || typeof value !== 'object') throw new ModelError('La risposta del modello non è un oggetto JSON.')
  const r = value as Record<string, unknown>
  const trade = matchTrade(r.trade)
  if (!trade) throw new ModelError('Il modello non ha indicato un mestiere valido.')
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  const description = typeof r.description === 'string' ? r.description.trim() : ''
  if (!title || !description) throw new ModelError('Il modello non ha descritto il lavoro.')
  const confidence = r.confidence === 'alta' || r.confidence === 'media' ? r.confidence : 'bassa'
  return {
    trade,
    title,
    description,
    whatISee: typeof r.whatISee === 'string' ? r.whatISee.trim() : '',
    confidence,
    inputs: sanitizeInputs(trade, r.inputs),
    assumptions: strings(r.assumptions),
    questions: strings(r.questions),
  }
}

export async function analyzeSite(
  settings: Settings,
  input: { description: string; tradeHint: TradeId | null; images: string[] },
): Promise<SiteAnalysis> {
  const images = input.images.filter((url) => url.trim())
  const text = [
    `Descrizione dell’utente: ${input.description.trim() || 'nessuna'}.`,
    input.tradeHint ? `Mestiere scelto dall’utente (cambialo solo se le foto lo contraddicono): ${input.tradeHint}.` : '',
    images.length ? `Foto allegate: ${images.length}.` : 'Nessuna foto allegata: ragiona solo sul testo e dillo in whatISee.',
  ]
    .filter(Boolean)
    .join('\n')
  try {
    return parseSiteAnalysis(await completeJson(settings, SYSTEM_ANALYZE(), text, images))
  } catch (reason) {
    if (!(reason instanceof ModelError) || /chiave|rete|proxy|errore \d+/i.test(reason.message)) throw reason
    // risposta del modello in forma inattesa: un secondo tentativo basta quasi sempre
    return parseSiteAnalysis(await completeJson(settings, SYSTEM_ANALYZE(), text, images))
  }
}

/* ------------------------------------------------------------------ */
/* 2. Guida passo-passo di una fase                                    */
/* ------------------------------------------------------------------ */

const SYSTEM_GUIDE = [
  BASE_RULES,
  'Spiega UNA fase di lavoro come farebbe un maestro d’arte a un principiante, passo per passo. Rispondi SOLO con JSON.',
  'Chiavi: intro (2 frasi: perché questa fase conta), steps (array di 3-7 oggetti {title, how, tip, visual}: how è l’azione concreta con gesto, ordine e tempi; tip è il trucco del mestiere o il controllo da fare; visual è una descrizione IN INGLESE, di una sola frase, della scena da disegnare: mani, attrezzo, superficie, gesto; niente testo né numeri nell’immagine),',
  'mistakes (array: errori tipici da evitare), tools (array: attrezzi per questa fase), minutes (numero: durata realistica per un principiante).',
  'Usa le quantità e le misure del fascicolo quando servono. Niente video inventati.',
].join(' ')

export function parseGuide(value: unknown): PhaseGuide {
  if (!value || typeof value !== 'object') throw new ModelError('La risposta del modello non è un oggetto JSON.')
  const r = value as Record<string, unknown>
  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .map((item) => {
      const s = (item ?? {}) as Record<string, unknown>
      return {
        title: typeof s.title === 'string' ? s.title.trim() : '',
        how: typeof s.how === 'string' ? s.how.trim() : '',
        tip: typeof s.tip === 'string' ? s.tip.trim() : '',
        visual: typeof s.visual === 'string' ? s.visual.trim() : '',
      }
    })
    .filter((item) => item.title && item.how)
  if (!steps.length) throw new ModelError('La risposta del modello non contiene i passi della fase.')
  const minutes = Number(r.minutes)
  return {
    intro: typeof r.intro === 'string' ? r.intro.trim() : '',
    steps,
    mistakes: strings(r.mistakes),
    tools: strings(r.tools),
    minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0,
  }
}

export async function explainPhase(settings: Settings, job: JobBody, phase: Phase): Promise<PhaseGuide> {
  const text = [
    factsBlock(job),
    `Fase da spiegare: ${phase.title}.`,
    `Indicazioni di base già nel fascicolo: ${phase.detail}`,
    'Dettaglia i passi concreti.',
  ].join('\n\n')
  return parseGuide(await completeJson(settings, SYSTEM_GUIDE, text, []))
}

/* ------------------------------------------------------------------ */
/* 3. Revisione ragionata del preventivo                               */
/* ------------------------------------------------------------------ */

const SYSTEM_QUOTE = [
  BASE_RULES,
  'Rivedi il preventivo come un capocantiere che lo deve difendere davanti a un cliente. Rispondi SOLO con JSON.',
  'Chiavi: verdict (congruo|basso|alto, rispetto a ore e prezzi realistici in Italia oggi), summary (3-4 frasi di ragionamento: perché),',
  'suggestedHours (numero se le ore ti sembrano sbagliate, altrimenti null), missing (array: voci che di solito mancano e fanno lievitare il costo: ponteggi, smaltimento, protezioni, trasporto, imprevisti...),',
  'savingTips (array: dove risparmiare senza peggiorare il lavoro), clientNote (una frase pronta da dire al cliente sul perché del prezzo).',
  'Non riscrivere i totali: proponi solo suggestedHours; sarà l’utente a decidere.',
].join(' ')

export function parseQuoteReview(value: unknown): QuoteReview {
  if (!value || typeof value !== 'object') throw new ModelError('La risposta del modello non è un oggetto JSON.')
  const r = value as Record<string, unknown>
  const verdict = r.verdict === 'basso' || r.verdict === 'alto' || r.verdict === 'congruo' ? r.verdict : null
  if (!verdict) throw new ModelError('Il modello non ha dato un giudizio valido sul preventivo.')
  const summary = typeof r.summary === 'string' ? r.summary.trim() : ''
  if (!summary) throw new ModelError('Il modello non ha spiegato il giudizio sul preventivo.')
  const hours = typeof r.suggestedHours === 'number' && r.suggestedHours > 0 ? Math.round(r.suggestedHours * 10) / 10 : null
  return {
    verdict,
    summary,
    suggestedHours: hours,
    missing: strings(r.missing),
    savingTips: strings(r.savingTips),
    clientNote: typeof r.clientNote === 'string' ? r.clientNote.trim() : '',
  }
}

export async function reviewQuote(settings: Settings, job: JobBody): Promise<QuoteReview> {
  const text = [factsBlock(job), 'Rivedi questo preventivo e ragiona sui costi.'].join('\n\n')
  return parseQuoteReview(await completeJson(settings, SYSTEM_QUOTE, text, []))
}

/* ------------------------------------------------------------------ */
/* 4. Assistente in chat, che accompagna passo passo                   */
/* ------------------------------------------------------------------ */

const SYSTEM_CHAT = [
  BASE_RULES,
  'Stai accompagnando l’utente dentro il suo fascicolo di cantiere. Rispondi in modo breve (massimo 120 parole salvo richiesta), concreto, a passi numerati quando spieghi come fare.',
  'Guida l’utente: dì cosa fare ORA, cosa controllare prima di passare oltre, e termina con UNA domanda o UN prossimo passo. Usa il contesto (fase corrente, misure, materiali). Testo semplice, niente markdown pesante.',
  'Se manca un dato per rispondere bene, chiedilo invece di indovinare.',
  'Se l’utente chiede di stimare misure da una foto: individua un oggetto di riferimento visibile e dalle dimensioni note (porta interna circa 210x80 cm, interruttore a circa 110 cm da terra, piastrella o mattone standard), ricava le misure con un intervallo (es. «circa 3,2-3,6 m») e dì quanto sei incerto. Chiudi sempre dicendo di verificare con un metro prima di ordinare materiali; le misure della foto non sostituiscono quelle prese in opera.',
  'L’app mostra da sola, sotto le tue risposte, video YouTube reali sull’argomento (quando l’utente li chiede o preme il pulsante). Quindi non dire MAI di non poter mostrare video: se ne chiede uno, spiega a parole l’essenziale in 2-3 punti e aggiungi «qui sotto trovi i video». Non citare titoli, canali o link di video: li aggiunge l’app.',
].join(' ')

export function currentPhase(job: Pick<JobBody, 'phases'>): Phase | undefined {
  return job.phases.find((item) => !item.done) ?? job.phases.at(-1)
}

export async function chatTurn(
  settings: Settings,
  job: JobBody,
  history: ChatMessage[],
  userText: string,
  images: string[],
): Promise<string> {
  const phase = currentPhase(job)
  const done = job.phases.filter((item) => item.done).length
  const context = [
    factsBlock(job),
    `Avanzamento: ${done} fasi su ${job.phases.length} completate.`,
    phase ? `Fase corrente: ${phase.title}. ${phase.detail}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const messages: ChatMsg[] = [
    { role: 'system', content: `${SYSTEM_CHAT}\n\nCONTESTO DEL FASCICOLO:\n${context}` },
    ...history.slice(-12).map((item): ChatMsg => ({ role: item.role, content: item.text })),
  ]
  const content: ChatPart[] = [{ type: 'text', text: userText }]
  for (const url of images) if (url.trim()) content.push({ type: 'image_url', image_url: { url } })
  messages.push({ role: 'user', content })
  return callChat(settings, messages, { json: false, temperature: 0.4, maxTokens: 600 })
}
