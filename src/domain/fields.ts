import type { InputValue, JobDraft, TradeId } from './types'

export interface FieldDef {
  key: string
  label: string
  type: 'number' | 'boolean' | 'select'
  unit?: string
  min?: number
  max?: number
  step?: number
  help?: string
  defaultValue: InputValue
  options?: { value: string; label: string }[]
  showIf?: (inputs: Record<string, InputValue>) => boolean
}

const yesNo = (key: string, label: string, help: string, value: boolean): FieldDef => ({
  key,
  label,
  type: 'boolean',
  help,
  defaultValue: value,
})

export const FIELDS: Record<TradeId, FieldDef[]> = {
  pittura: [
    {
      key: 'wallM2',
      label: 'Superficie pareti',
      type: 'number',
      unit: 'm²',
      min: 0,
      step: 0.5,
      defaultValue: 0,
      help: 'Solo le pareti, senza il soffitto. Misura sviluppo × altezza, togli le aperture grandi se vuoi essere stretto.',
    },
    yesNo('ceilingIncluded', 'Soffitto compreso', 'Se sì, indica sotto i metri quadri del soffitto. Non inventarli.', true),
    {
      key: 'ceilingM2',
      label: 'Superficie soffitto',
      type: 'number',
      unit: 'm²',
      min: 0,
      step: 0.5,
      defaultValue: 0,
      help: 'Di solito è vicina alla superficie del pavimento. Se lasci 0, il soffitto non entra nei litri.',
      showIf: (inputs) => inputs.ceilingIncluded === true,
    },
    {
      key: 'coats',
      label: 'Mani di idropittura',
      type: 'number',
      min: 1,
      max: 5,
      step: 1,
      defaultValue: 2,
      help: 'Due mani sono il caso ordinario su fondo già chiaro e uniforme.',
    },
    yesNo('primer', 'Primer o fissativo', 'Consigliato su fondi nuovi, sfarinanti o molto assorbenti.', true),
    {
      key: 'wastePercent',
      label: 'Sfrido',
      type: 'number',
      unit: '%',
      min: 0,
      max: 30,
      step: 1,
      defaultValue: 10,
      help: 'Copre assorbimento, ritocchi e fondo irregolare. 10% è una regola pratica.',
    },
  ],
  impermeabilizzazione: [
    {
      key: 'areaM2',
      label: 'Superficie terrazza o piano',
      type: 'number',
      unit: 'm²',
      min: 0,
      step: 0.5,
      defaultValue: 0,
    },
    {
      key: 'perimeterM',
      label: 'Perimetro da nastrare',
      type: 'number',
      unit: 'm',
      min: 0,
      step: 0.1,
      defaultValue: 0,
      help: 'Angoli, soglie e giunti. Se è 0 la bandella non viene quantificata: misuralo in cantiere.',
    },
    {
      key: 'drains',
      label: 'Scarichi',
      type: 'number',
      min: 0,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'slopePercent',
      label: 'Pendenza di progetto',
      type: 'number',
      unit: '%',
      min: 0.2,
      max: 8,
      step: 0.1,
      defaultValue: 1.5,
      help: 'Per un piano pedonabile si usa spesso circa 1–2% verso gli scarichi.',
    },
    {
      key: 'lengthM',
      label: 'Lunghezza di riferimento',
      type: 'number',
      unit: 'm',
      min: 0.2,
      step: 0.1,
      defaultValue: 5,
      help: 'Distanza su cui vuoi leggere il dislivello, per esempio dallo scarico al bordo più lontano.',
    },
    yesNo('withFlooring', 'Rifaccio anche la pavimentazione', 'Aggiunge collante, piastrelle e fughe al fascicolo.', false),
    {
      key: 'tileWidthCm',
      label: 'Larghezza piastrella',
      type: 'number',
      unit: 'cm',
      min: 1,
      step: 1,
      defaultValue: 60,
      showIf: (inputs) => inputs.withFlooring === true,
    },
    {
      key: 'tileHeightCm',
      label: 'Altezza piastrella',
      type: 'number',
      unit: 'cm',
      min: 1,
      step: 1,
      defaultValue: 60,
      showIf: (inputs) => inputs.withFlooring === true,
    },
    {
      key: 'tileWastePercent',
      label: 'Sfrido piastrelle',
      type: 'number',
      unit: '%',
      min: 5,
      max: 25,
      step: 1,
      defaultValue: 10,
      help: 'In diagonale o con molti tagli sali verso il 15%.',
      showIf: (inputs) => inputs.withFlooring === true,
    },
  ],
  pavimentazione: [
    {
      key: 'areaM2',
      label: 'Superficie da pavimentare',
      type: 'number',
      unit: 'm²',
      min: 0,
      step: 0.5,
      defaultValue: 0,
    },
    {
      key: 'tileWidthCm',
      label: 'Larghezza piastrella',
      type: 'number',
      unit: 'cm',
      min: 1,
      step: 1,
      defaultValue: 60,
    },
    {
      key: 'tileHeightCm',
      label: 'Altezza piastrella',
      type: 'number',
      unit: 'cm',
      min: 1,
      step: 1,
      defaultValue: 60,
    },
    {
      key: 'jointMm',
      label: 'Larghezza fuga',
      type: 'number',
      unit: 'mm',
      min: 1,
      step: 0.5,
      defaultValue: 2,
    },
    {
      key: 'tileThicknessMm',
      label: 'Spessore piastrella',
      type: 'number',
      unit: 'mm',
      min: 3,
      step: 0.5,
      defaultValue: 8,
      help: 'Serve solo alla stima dello stucco.',
    },
    {
      key: 'wastePercent',
      label: 'Sfrido',
      type: 'number',
      unit: '%',
      min: 5,
      max: 25,
      step: 1,
      defaultValue: 10,
    },
  ],
  cartongesso: [
    {
      key: 'kind',
      label: 'Tipo di opera',
      type: 'select',
      defaultValue: 'parete',
      options: [
        { value: 'parete', label: 'Parete' },
        { value: 'controsoffitto', label: 'Controsoffitto' },
      ],
    },
    {
      key: 'areaM2',
      label: 'Superficie',
      type: 'number',
      unit: 'm²',
      min: 0,
      step: 0.5,
      defaultValue: 0,
    },
    {
      key: 'heightM',
      label: 'Altezza parete',
      type: 'number',
      unit: 'm',
      min: 0.5,
      step: 0.05,
      defaultValue: 2.7,
      help: 'Serve a ricavare la lunghezza e quindi montanti e guide.',
      showIf: (inputs) => inputs.kind !== 'controsoffitto',
    },
    {
      key: 'layers',
      label: 'Strati di lastre',
      type: 'select',
      defaultValue: '1',
      options: [
        { value: '1', label: 'Uno strato' },
        { value: '2', label: 'Due strati' },
      ],
    },
    {
      key: 'wastePercent',
      label: 'Sfrido lastre',
      type: 'number',
      unit: '%',
      min: 5,
      max: 20,
      step: 1,
      defaultValue: 10,
    },
  ],
  idraulica: [
    {
      key: 'leakPoint',
      label: 'Dove perde',
      type: 'select',
      defaultValue: 'sifone',
      options: [
        { value: 'sifone', label: 'Sifone' },
        { value: 'rubinetto', label: 'Rubinetto o vitone' },
        { value: 'flessibili', label: 'Flessibili di collegamento' },
        { value: 'scarico_lavabo', label: 'Scarico del lavabo' },
        { value: 'non_so', label: 'Non è ancora chiaro' },
      ],
    },
    {
      key: 'fixtures',
      label: 'Punti da aprire',
      type: 'number',
      min: 1,
      step: 1,
      defaultValue: 1,
      help: 'Per esempio un lavabo. Ogni punto porta guarnizioni e un rotolo di PTFE, più una scorta.',
    },
  ],
  elettrica: [
    {
      key: 'workType',
      label: 'Tipo di intervento',
      type: 'select',
      defaultValue: 'sostituzione_frutto',
      options: [
        { value: 'sostituzione_frutto', label: 'Sostituzione frutto o placca' },
        { value: 'illuminazione', label: 'Punto luce esistente' },
        { value: 'nuovo_punto', label: 'Nuovo punto (solo con abilitato)' },
        { value: 'guasto', label: 'Guasto da diagnosticare' },
      ],
    },
    {
      key: 'points',
      label: 'Punti interessati',
      type: 'number',
      min: 1,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'cableMeters',
      label: 'Metri di cavo misurati',
      type: 'number',
      unit: 'm',
      min: 0,
      step: 0.5,
      defaultValue: 0,
      help: 'Se lasci 0, il fascicolo usa una stima di 8 m a punto, da sostituire con il percorso reale. La sezione non viene scelta dall’app.',
    },
  ],
  muratura: [
    {
      key: 'workType',
      label: 'Intervento',
      type: 'select',
      defaultValue: 'intonaco',
      options: [
        { value: 'intonaco', label: 'Intonaco' },
        { value: 'ripristino', label: 'Ripristino localizzato' },
        { value: 'tramezzo', label: 'Tramezzo o chiusura' },
      ],
    },
    {
      key: 'areaM2',
      label: 'Superficie',
      type: 'number',
      unit: 'm²',
      min: 0,
      step: 0.5,
      defaultValue: 0,
    },
    {
      key: 'thicknessCm',
      label: 'Spessore medio',
      type: 'number',
      unit: 'cm',
      min: 0.5,
      step: 0.5,
      defaultValue: 1.5,
      help: 'Per un intonaco civile spesso si ragiona sull’ordine di 1–2 cm. Verifica in cantiere.',
    },
  ],
  tetti: [
    {
      key: 'workType',
      label: 'Intervento',
      type: 'select',
      defaultValue: 'ispezione',
      options: [
        { value: 'ispezione', label: 'Ispezione da punto sicuro' },
        { value: 'tegole', label: 'Tegole rotte o spostate' },
        { value: 'grondaie', label: 'Grondaie' },
      ],
    },
    {
      key: 'areaM2',
      label: 'Superficie di copertura interessata',
      type: 'number',
      unit: 'm²',
      min: 0,
      step: 1,
      defaultValue: 0,
      help: 'Anche solo la falda che vuoi guardare, non per forza tutto il tetto.',
    },
    {
      key: 'brokenTiles',
      label: 'Tegole da sostituire',
      type: 'number',
      min: 0,
      step: 1,
      defaultValue: 0,
      showIf: (inputs) => inputs.workType === 'tegole',
    },
    {
      key: 'gutterM',
      label: 'Sviluppo grondaia',
      type: 'number',
      unit: 'm',
      min: 0,
      step: 0.5,
      defaultValue: 0,
      showIf: (inputs) => inputs.workType === 'grondaie',
    },
  ],
  giardino: [
    {
      key: 'workType',
      label: 'Intervento',
      type: 'select',
      defaultValue: 'prato',
      options: [
        { value: 'prato', label: 'Prato' },
        { value: 'irrigazione', label: 'Irrigazione a goccia' },
        { value: 'aiuole', label: 'Aiuole' },
        { value: 'siepi', label: 'Siepi' },
      ],
    },
    {
      key: 'areaM2',
      label: 'Superficie',
      type: 'number',
      unit: 'm²',
      min: 0,
      step: 1,
      defaultValue: 0,
      showIf: (inputs) => inputs.workType === 'prato' || inputs.workType === 'aiuole',
    },
    {
      key: 'linearM',
      label: 'Sviluppo lineare',
      type: 'number',
      unit: 'm',
      min: 0,
      step: 0.5,
      defaultValue: 0,
      help: 'Ala gocciolante oppure lunghezza della siepe.',
      showIf: (inputs) => inputs.workType === 'irrigazione' || inputs.workType === 'siepi',
    },
  ],
  climatizzazione: [
    {
      key: 'splits',
      label: 'Unità interne',
      type: 'number',
      min: 1,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'rooms',
      label: 'Locali serviti',
      type: 'number',
      min: 1,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'pipeMeters',
      label: 'Distanza linee (andata e ritorno già sommate, oppure tratta singola da verificare)',
      type: 'number',
      unit: 'm',
      min: 1,
      step: 0.5,
      defaultValue: 4,
      help: 'È una lunghezza di canalina e di percorso, non una carica di refrigerante.',
    },
  ],
  falegnameria: [
    {
      key: 'workType',
      label: 'Pezzo',
      type: 'select',
      defaultValue: 'porta',
      options: [
        { value: 'porta', label: 'Porta' },
        { value: 'anta', label: 'Anta o sportello' },
        { value: 'ripristino', label: 'Ripristino' },
        { value: 'mensola', label: 'Mensola' },
      ],
    },
    {
      key: 'pieces',
      label: 'Numero pezzi',
      type: 'number',
      min: 1,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'widthCm',
      label: 'Larghezza',
      type: 'number',
      unit: 'cm',
      min: 0,
      step: 0.5,
      defaultValue: 80,
    },
    {
      key: 'heightCm',
      label: 'Altezza',
      type: 'number',
      unit: 'cm',
      min: 0,
      step: 0.5,
      defaultValue: 210,
    },
  ],
  manutenzione: [
    {
      key: 'focus',
      label: 'Fuoco del giro',
      type: 'select',
      defaultValue: 'generale',
      options: [
        { value: 'generale', label: 'Giro generale' },
        { value: 'umidita', label: 'Umidità e ventilazione' },
        { value: 'infissi', label: 'Infissi e sigillature' },
        { value: 'stagionale', label: 'Controllo stagionale' },
      ],
    },
    {
      key: 'rooms',
      label: 'Locali da vedere',
      type: 'number',
      min: 1,
      step: 1,
      defaultValue: 3,
    },
  ],
}

export function defaultsFor(trade: TradeId): Record<string, InputValue> {
  const inputs: Record<string, InputValue> = {}
  for (const field of FIELDS[trade]) inputs[field.key] = field.defaultValue
  return inputs
}

export interface ExamplePreset {
  id: string
  label: string
  trade: TradeId
  title: string
  description: string
  inputs: Record<string, InputValue>
}

export const EXAMPLES: ExamplePreset[] = [
  {
    id: 'perde',
    label: 'Perde qui',
    trade: 'idraulica',
    title: 'Perdita sotto il lavello',
    description: 'Perde qui',
    inputs: { leakPoint: 'sifone', fixtures: 1 },
  },
  {
    id: 'terrazza',
    label: 'Terrazza 45 m²',
    trade: 'impermeabilizzazione',
    title: 'Terrazza da impermeabilizzare',
    description: 'Terrazza 45 m². Voglio rifare impermeabilizzazione e pavimentazione.',
    inputs: {
      areaM2: 45,
      perimeterM: 0,
      drains: 2,
      slopePercent: 1.5,
      lengthM: 5,
      withFlooring: true,
      tileWidthCm: 60,
      tileHeightCm: 60,
      tileWastePercent: 10,
    },
  },
  {
    id: 'pittura',
    label: '120 m², due mani, soffitto',
    trade: 'pittura',
    title: 'Tinteggiatura interni',
    description: 'Devo imbiancare 120 m², due mani, soffitto compreso.',
    inputs: {
      wallM2: 100,
      ceilingIncluded: true,
      ceilingM2: 20,
      coats: 2,
      primer: true,
      wastePercent: 10,
    },
  },
]

export function applyExample(example: ExamplePreset): {
  trade: TradeId
  title: string
  description: string
  inputs: Record<string, InputValue>
} {
  return {
    trade: example.trade,
    title: example.title,
    description: example.description,
    inputs: { ...defaultsFor(example.trade), ...example.inputs },
  }
}

function n(inputs: Record<string, InputValue>, key: string): number {
  const value = inputs[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0
}

export function validateDraft(draft: JobDraft): string | null {
  if (draft.title.trim().length < 3) return 'Il titolo deve avere almeno 3 caratteri.'
  if (draft.description.trim().length < 2) return 'Descrivi il lavoro, anche in poche parole.'
  const inputs = draft.inputs
  switch (draft.trade) {
    case 'pittura': {
      const walls = n(inputs, 'wallM2')
      const ceiling = inputs.ceilingIncluded === true ? n(inputs, 'ceilingM2') : 0
      if (walls + ceiling <= 0) return 'Indica la superficie delle pareti oppure quella del soffitto.'
      if (n(inputs, 'coats') < 1) return 'Le mani devono essere almeno una.'
      return null
    }
    case 'impermeabilizzazione':
      if (n(inputs, 'areaM2') <= 0) return 'Indica la superficie da impermeabilizzare.'
      if (n(inputs, 'slopePercent') <= 0) return 'Indica la pendenza in percentuale.'
      if (n(inputs, 'lengthM') <= 0) return 'Indica la lunghezza su cui calcolare il dislivello.'
      if (inputs.withFlooring === true && (n(inputs, 'tileWidthCm') <= 0 || n(inputs, 'tileHeightCm') <= 0)) {
        return 'Indica il formato della piastrella.'
      }
      return null
    case 'pavimentazione':
      if (n(inputs, 'areaM2') <= 0) return 'Indica la superficie da pavimentare.'
      if (n(inputs, 'tileWidthCm') <= 0 || n(inputs, 'tileHeightCm') <= 0) return 'Indica il formato della piastrella.'
      return null
    case 'cartongesso':
      if (n(inputs, 'areaM2') <= 0) return 'Indica la superficie di cartongesso.'
      if (inputs.kind !== 'controsoffitto' && n(inputs, 'heightM') <= 0) return 'Indica l’altezza della parete.'
      return null
    case 'idraulica':
      if (n(inputs, 'fixtures') < 1) return 'Indica almeno un punto idraulico.'
      return null
    case 'elettrica':
      if (n(inputs, 'points') < 1) return 'Indica almeno un punto elettrico.'
      return null
    case 'muratura':
      if (n(inputs, 'areaM2') <= 0) return 'Indica la superficie di muratura.'
      if (n(inputs, 'thicknessCm') <= 0) return 'Indica lo spessore.'
      return null
    case 'tetti':
      if (inputs.workType === 'grondaie' && n(inputs, 'gutterM') <= 0) return 'Indica i metri di grondaia.'
      if (inputs.workType === 'tegole' && n(inputs, 'brokenTiles') <= 0 && n(inputs, 'areaM2') <= 0) {
        return 'Indica quante tegole sostituire oppure la superficie della falda.'
      }
      if (inputs.workType === 'ispezione' && n(inputs, 'areaM2') <= 0) return 'Indica la superficie da ispezionare.'
      return null
    case 'giardino':
      if ((inputs.workType === 'prato' || inputs.workType === 'aiuole') && n(inputs, 'areaM2') <= 0) {
        return 'Indica la superficie.'
      }
      if ((inputs.workType === 'irrigazione' || inputs.workType === 'siepi') && n(inputs, 'linearM') <= 0) {
        return 'Indica lo sviluppo in metri.'
      }
      return null
    case 'climatizzazione':
      if (n(inputs, 'splits') < 1) return 'Indica almeno un’unità interna.'
      return null
    case 'falegnameria':
      if (n(inputs, 'pieces') < 1) return 'Indica almeno un pezzo.'
      return null
    case 'manutenzione':
      if (n(inputs, 'rooms') < 1) return 'Indica almeno un locale.'
      return null
    default:
      return null
  }
}
