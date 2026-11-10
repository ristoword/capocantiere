export type TradeId =
  | 'idraulica'
  | 'elettrica'
  | 'muratura'
  | 'cartongesso'
  | 'pittura'
  | 'pavimentazione'
  | 'impermeabilizzazione'
  | 'tetti'
  | 'giardino'
  | 'climatizzazione'
  | 'falegnameria'
  | 'manutenzione'

export type Difficulty = 'bassa' | 'media' | 'alta' | 'critica'

export type SourceType = 'scheda tecnica' | 'regola pratica' | 'da verificare in cantiere'

export type InputValue = string | number | boolean

export interface TechNote {
  text: string
  source: SourceType
}

export interface MaterialLine {
  id: string
  name: string
  quantity: number
  unit: string
  unitPrice: number
  wasteLabel: string
  measureNote: string
  sourceNote: string
}

export interface CheckQuestion {
  id: string
  text: string
  answer: 'si' | 'no' | 'ns' | null
}

export interface Phase {
  id: string
  title: string
  detail: string
  videoQuery: string
  videoUrl: string
  done: boolean
  photoIds: string[]
  questions: CheckQuestion[]
  visualNote: string
  aiText: string
  /** True/false solo dopo una verifica riuscita del modello. Assente se il modello non ha risposto. */
  photoConsistent?: boolean | null
  /** Spiegazione passo-passo generata dal modello su richiesta. */
  guide?: PhaseGuide | null
}

export interface GuideStep {
  title: string
  how: string
  tip: string
  /** Descrizione della scena da illustrare (per il generatore di immagini). */
  visual?: string
  /** Illustrazione generata, data URL JPEG ridotto. */
  image?: string
}

export interface PhaseGuide {
  intro: string
  steps: GuideStep[]
  mistakes: string[]
  tools: string[]
  minutes: number
}

export interface VideoHit {
  id: string
  title: string
  channel: string
  duration: string
  thumb: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  withPhoto?: boolean
  /** Video YouTube trovati per questa risposta (risultati reali di ricerca). */
  videos?: VideoHit[]
  videoQuery?: string
}

export interface QuoteReview {
  verdict: 'congruo' | 'basso' | 'alto'
  summary: string
  suggestedHours: number | null
  missing: string[]
  savingTips: string[]
  clientNote: string
}

export interface CheckItem {
  id: string
  text: string
  checked: boolean
}

export interface CalcStep {
  label: string
  formula: string
  result: string
}

export interface SlopeInfo {
  percent: number
  cmPerMeter: number
  lengthM: number
  totalCm: number
  formula: string
  example: string
}

export interface Quote {
  hourlyRate: number
  laborHours: number
  laborNote: string
  materialsEuro: number
  laborEuro: number
  totalEuro: number
  assumptions: string
}

export interface Project {
  id: string
  trade: TradeId
  title: string
  description: string
  inputs: Record<string, InputValue>
  createdAt: string
  updatedAt: string
  photoIds: string[]
  problem: string
  currentState: string
  difficulty: Difficulty
  criticalPoints: string[]
  tools: string[]
  safety: string[]
  notes: TechNote[]
  materials: MaterialLine[]
  calcSteps: CalcStep[]
  slope?: SlopeInfo
  phases: Phase[]
  checklist: CheckItem[]
  quote: Quote
  areaM2?: number
  aiDiagnosis: string
  /** Compilata solo dopo una risposta JSON valida del modello. Mai un testo di riserva. */
  modelDiagnosis?: ModelDiagnosis | null
  diagnosisError?: string
  /** Conversazione con l'assistente AI del fascicolo. */
  chat?: ChatMessage[]
  quoteReview?: QuoteReview | null
}

export interface ModelDiagnosis {
  problem: string
  difficulty: Difficulty
  criticalPoints: string[]
  safety: string[]
  procedureNotes: string
  /** Vero solo se a quella chiamata erano allegate immagini. */
  photosSent: boolean
}

export interface JobDraft {
  trade: TradeId
  title: string
  description: string
  inputs: Record<string, InputValue>
  hasPhotos?: boolean
}

export type JobBody = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>

export interface StoredPhoto {
  id: string
  projectId: string
  phaseId: string | null
  name: string
  createdAt: string
  blob: Blob
}

export interface Settings {
  apiKey: string
  baseUrl: string
  model: string
  /** Se vero, una chiave vuota nel browser non ricade su quella dell'ambiente. */
  ignoreEnvKey?: boolean
}
