import type { TradeId } from './types'

export interface TradeInfo {
  id: TradeId
  name: string
  order: string
  short: string
  blurb: string
}

export const TRADES: TradeInfo[] = [
  {
    id: 'idraulica',
    name: 'Idraulica',
    order: '01',
    short: 'Perdite, sifoni, rubinetti',
    blurb: 'Diagnosi guidata di una perdita visibile e lista materiali di tenuta.',
  },
  {
    id: 'elettrica',
    name: 'Elettrica',
    order: '02',
    short: 'Punti, circuiti, sicurezza',
    blurb: 'Sequenza di messa in sicurezza. Gli impianti fissi chiedono un abilitato.',
  },
  {
    id: 'muratura',
    name: 'Muratura',
    order: '03',
    short: 'Intonaci e ripristini',
    blurb: 'Fondo, malta e stagionatura con quantità legate a superficie e spessore.',
  },
  {
    id: 'cartongesso',
    name: 'Cartongesso',
    order: '04',
    short: 'Pareti e controsoffitti',
    blurb: 'Lastre, orditura e viti calcolate sulla superficie.',
  },
  {
    id: 'pittura',
    name: 'Pittura',
    order: '05',
    short: 'Interni, mani, soffitto',
    blurb: 'Litri di idropittura e primer da resa di riferimento e sfrido.',
  },
  {
    id: 'pavimentazione',
    name: 'Pavimentazione',
    order: '06',
    short: 'Piastrelle, colla, fughe',
    blurb: 'Metri quadri con sfrido, pezzi, collante e stucco.',
  },
  {
    id: 'impermeabilizzazione',
    name: 'Impermeabilizzazione',
    order: '07',
    short: 'Terrazze e pendenze',
    blurb: 'Membrana, pendenza in centimetri e, se serve, il pacchetto pavimento.',
  },
  {
    id: 'tetti',
    name: 'Tetti',
    order: '08',
    short: 'Coperture e grondaie',
    blurb: 'Ispezione e piccoli ripristini solo da posizione sicura.',
  },
  {
    id: 'giardino',
    name: 'Giardino',
    order: '09',
    short: 'Prato, aiuole, irrigazione',
    blurb: 'Superfici, seme o ala gocciolante, con avviso sui sottoservizi.',
  },
  {
    id: 'climatizzazione',
    name: 'Climatizzazione',
    order: '10',
    short: 'Split e scarichi',
    blurb: 'Predisposizione. La carica del gas resta al tecnico certificato.',
  },
  {
    id: 'falegnameria',
    name: 'Falegnameria',
    order: '11',
    short: 'Porte, ante, ripristini',
    blurb: 'Rilievo, ferramenta e registro, pezzo per pezzo.',
  },
  {
    id: 'manutenzione',
    name: 'Manutenzione casa',
    order: '12',
    short: 'Giro di controllo',
    blurb: 'Checklist di casa e minuteria, senza cantieri inventati.',
  },
]

export function tradeById(id: TradeId): TradeInfo {
  const found = TRADES.find((t) => t.id === id)
  if (!found) throw new Error(`Mestiere sconosciuto: ${id}`)
  return found
}

export const PIPELINE = [
  'Foto',
  'Diagnosi',
  'Progetto',
  'Materiali',
  'Quantità',
  'Preventivo',
  'Procedura',
  'Video',
  'Checklist',
  'Report',
] as const

export const PIPELINE_ANCHORS: Record<(typeof PIPELINE)[number], string> = {
  Foto: 'foto',
  Diagnosi: 'diagnosi',
  Progetto: 'progetto',
  Materiali: 'materiali',
  Quantità: 'quantita',
  Preventivo: 'preventivo',
  Procedura: 'procedura',
  Video: 'video',
  Checklist: 'checklist',
  Report: 'report',
}

export interface TradeStyle {
  icon: string
  color: string
  placeholder: string
}

const STYLES: Record<TradeId, TradeStyle> = {
  idraulica: { icon: '💧', color: '#0ea5e9', placeholder: 'Es. Perde acqua sotto il lavello della cucina, dal sifone' },
  elettrica: { icon: '⚡', color: '#f59e0b', placeholder: 'Es. Voglio aggiungere due prese in soggiorno' },
  muratura: { icon: '🧱', color: '#ef6c3a', placeholder: 'Es. Intonaco scrostato sul muro del bagno, circa 6 m²' },
  cartongesso: { icon: '📐', color: '#8b5cf6', placeholder: 'Es. Voglio dividere la stanza con una parete in cartongesso' },
  pittura: { icon: '🎨', color: '#ec4899', placeholder: 'Es. Imbiancare salotto e camera, due mani, soffitto compreso' },
  pavimentazione: { icon: '🔲', color: '#14b8a6', placeholder: 'Es. Posare gres 60×60 in cucina, circa 14 m²' },
  impermeabilizzazione: { icon: '☔', color: '#3b82f6', placeholder: 'Es. Terrazza di 45 m² che infiltra, da rifare con pavimento' },
  tetti: { icon: '🏠', color: '#dc2626', placeholder: 'Es. Alcune tegole rotte e una grondaia che perde' },
  giardino: { icon: '🌿', color: '#22c55e', placeholder: 'Es. Rifare il prato di 80 m² e mettere l’irrigazione' },
  climatizzazione: { icon: '❄️', color: '#06b6d4', placeholder: 'Es. Installare uno split in camera da letto' },
  falegnameria: { icon: '🪚', color: '#a16207', placeholder: 'Es. Porta che strofina, cerniere da sistemare' },
  manutenzione: { icon: '🔧', color: '#6366f1', placeholder: 'Es. Giro di controllo della casa prima dell’inverno' },
}

export function tradeStyle(id: TradeId): TradeStyle {
  return STYLES[id]
}
