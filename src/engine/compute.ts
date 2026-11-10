import {
  ADHESIVE_KG_PER_M2,
  adhesiveKg,
  areaWithWaste,
  flooringLaborHours,
  groutKg,
  tileCount,
} from '../calc/flooring'
import { round1, round2, wasteFraction } from '../calc/number'
import {
  PAINT_COVERAGE_M2_PER_L,
  PRIMER_COVERAGE_M2_PER_L,
  litersForCoats,
  paintConsumables,
  paintLaborHours,
  paintableSurface,
  primerLiters,
} from '../calc/paint'
import { plumbingKit, plumbingLaborHours } from '../calc/plumbing'
import { quoteTotals } from '../calc/quote'
import { SLOPE_EXAMPLE, SLOPE_FORMULA, slopeCmPerMeter, slopeTotalCm } from '../calc/slope'
import {
  MEMBRANE_KG_PER_M2_PER_MM,
  MEMBRANE_THICKNESS_MM,
  TERRACE_PRIMER_KG_PER_M2,
  cornerBandMeters,
  membraneKg,
  terraceLaborHours,
  terracePrimerKg,
} from '../calc/terrace'
import {
  BOARD_AREA_M2,
  JOINT_COMPOUND_KG_PER_M2,
  boardCount,
  ceilingMetalMeters,
  drywallLaborHours,
  hangerCount,
  jointCompoundKg,
  profilePieces,
  screwBoxes,
  screwCount,
  studCount,
  trackPieces,
  wallLengthM,
} from '../calc/drywall'
import { PRICE, PRICE_ASSUMPTIONS } from '../domain/pricing'
import type { Difficulty, JobBody, JobDraft, MaterialLine, Phase } from '../domain/types'
import { numIt } from '../lib/format'
import { VERIFY, checks, flag, mat, note, num, phase, quoted, step, str } from './factory'

function pack(
  draft: JobDraft,
  built: Omit<
    JobBody,
    'trade' | 'title' | 'description' | 'inputs' | 'photoIds' | 'aiDiagnosis' | 'modelDiagnosis' | 'diagnosisError'
  >,
): JobBody {
  return {
    trade: draft.trade,
    title: draft.title.trim(),
    description: draft.description.trim(),
    inputs: { ...draft.inputs },
    ...built,
    photoIds: [],
    aiDiagnosis: '',
    modelDiagnosis: null,
    diagnosisError: '',
  }
}

function moneyQuote(
  lines: MaterialLine[],
  hours: number,
  tradeRate: number,
  laborNote: string,
) {
  return quoteTotals(lines, round1(hours), tradeRate, laborNote, PRICE_ASSUMPTIONS)
}

const LABOR_NOTE =
  'Ore stimate per una persona a ritmo ordinario, regola pratica di cantiere. La tariffa oraria è indicativa e modificabile.'

export function computeJob(draft: JobDraft): JobBody {
  switch (draft.trade) {
    case 'pittura':
      return paintJob(draft)
    case 'impermeabilizzazione':
      return terraceJob(draft)
    case 'pavimentazione':
      return floorJob(draft)
    case 'cartongesso':
      return drywallJob(draft)
    case 'idraulica':
      return plumbingJob(draft)
    case 'elettrica':
      return electricJob(draft)
    case 'muratura':
      return masonryJob(draft)
    case 'tetti':
      return roofJob(draft)
    case 'giardino':
      return gardenJob(draft)
    case 'climatizzazione':
      return climateJob(draft)
    case 'falegnameria':
      return woodJob(draft)
    case 'manutenzione':
      return careJob(draft)
  }
}

function paintJob(draft: JobDraft): JobBody {
  const walls = Math.max(0, num(draft.inputs, 'wallM2'))
  const ceilingOn = flag(draft.inputs, 'ceilingIncluded', true)
  const ceiling = ceilingOn ? Math.max(0, num(draft.inputs, 'ceilingM2')) : 0
  const coats = Math.max(1, Math.round(num(draft.inputs, 'coats', 2)))
  const usePrimer = flag(draft.inputs, 'primer', true)
  const wastePct = num(draft.inputs, 'wastePercent', 10)
  const waste = wasteFraction(wastePct)
  const surface = paintableSurface(walls, ceiling, ceilingOn)
  const paintL = litersForCoats(surface, coats, PAINT_COVERAGE_M2_PER_L, waste)
  const primerL = usePrimer ? primerLiters(surface, PRIMER_COVERAGE_M2_PER_L, waste) : 0
  const kit = paintConsumables(surface)
  const filler = round2(Math.max(0.5, surface / 35))
  const hours = paintLaborHours(surface, coats, usePrimer)

  const materials: MaterialLine[] = [
    mat(
      'mat:pittura:idropittura',
      'Idropittura traspirante per interni',
      paintL,
      'L',
      PRICE.paintPerL,
      `sfrido ${numIt(wastePct, 0)}% già compreso`,
      'Rimisura pareti (sviluppo × altezza) e soffitto. Togli le aperture grandi solo se le hai escluse dal rilievo.',
      `${VERIFY} Resa usata: ${PAINT_COVERAGE_M2_PER_L} m²/L per mano. Intervallo spesso pubblicato: 10–12 m²/L.`,
    ),
  ]
  if (usePrimer) {
    materials.push(
      mat(
        'mat:pittura:primer',
        'Fissativo o primer acrilico per interni',
        primerL,
        'L',
        PRICE.primerPerL,
        `sfrido ${numIt(wastePct, 0)}% già compreso`,
        'Serve soprattutto se il fondo sfarina, è nuovo o molto assorbente.',
        `${VERIFY} Resa usata: ${PRIMER_COVERAGE_M2_PER_L} m²/L. Intervallo tipico circa 10–14 m²/L.`,
      ),
    )
  }
  materials.push(
    mat('mat:pittura:stucco', 'Stucco in pasta per interni', filler, 'kg', PRICE.fillerKg, 'stima difetti ordinari, non un rasatura totale', 'Aggiungi stucco se trovi buchi o crepe lunghe.', 'Regola pratica: circa 1 kg ogni 35 m² di fondo già decoroso.'),
    mat('mat:pittura:carta', 'Carta abrasiva a grana fine', kit.sandpaperSheets, 'fogli', PRICE.sandpaper, 'qualche foglio di scorta', 'Grana media per lo stucco, fine per la ripresa.', 'Da verificare in cantiere.'),
    mat('mat:pittura:rulli', 'Rullo per idropittura e ricambio', kit.rollers, 'pz', PRICE.roller, 'un rullo ogni 50 m² circa, minimo 1', 'Porta anche un rullo piccolo per il soffitto se lavori sopra la testa.', 'Regola pratica.'),
    mat('mat:pittura:pennelli', 'Pennello per tagli e angoli', kit.brushes, 'pz', PRICE.brush, 'nessuno sfrido di resa', 'Uno per i tagli, il secondo se alterni colori o primer.', 'Regola pratica.'),
    mat('mat:pittura:nastro', 'Nastro di carta per mascheratura', kit.tapeRolls, 'rotoli', PRICE.tape, 'un rotolo ogni 30 m² circa', 'Misura stipiti, zoccoli e controsoffitti da proteggere.', 'Regola pratica.'),
    mat('mat:pittura:teli', 'Teli di protezione', kit.dropCloths, 'pz', PRICE.cloth, 'un telo ogni 25 m² circa', 'Copri pavimento e arredi che restano nella stanza.', 'Regola pratica.'),
  )

  const ceilingGap = ceilingOn && ceiling <= 0
  const critical = [
    ceilingGap
      ? 'Hai chiesto il soffitto, ma la superficie soffitto è 0: i litri coprono solo le pareti finché non lo misuri.'
      : 'Controlla la ripresa tra parete e soffitto: è il punto dove si vede la mano disomogenea.',
    'Se il fondo sfarina, il primer non è facoltativo: la pittura si stacca a pelle.',
    'In case vecchie non carteggiare a secco in modo aggressivo senza chiederti se le vecchie pitture contengono piombo.',
    'Proteggi pavimenti e prese prima di aprire il barattolo. La pulizia finale fa parte del lavoro.',
  ]

  const difficulty: Difficulty = surface >= 160 || coats >= 3 ? 'media' : 'bassa'
  const phases: Phase[] = [
    phase('pittura', 'protezione', 'Protezione e rilievo', 'Svuota o raggruppa i mobili al centro.\nStendi i teli e nastra stipiti, zoccoli e controsoffitti.\nSegna crepe, macchie e fondi che sfarinano: cambiano primer e stucco.', 'come proteggere la stanza prima di imbiancare tutorial', [
      'Pavimento e arredi fissi sono coperti?',
      'Le mascherature sono continue su stipiti e zoccoli?',
      'Hai segnato i punti da stuccare?',
    ]),
    phase('pittura', 'fondo', 'Stuccatura e carteggiatura', 'Apri le crepe sottili solo quanto serve, stucca e lascia asciugare.\nCarteggia senza scavare il fondo.\nTogli la polvere con un panno appena umido, non con un getto d’acqua.', 'stuccare e carteggiare parete prima di pitturare tutorial', [
      'Lo stucco è asciutto e non sporge?',
      'La polvere è stata tolta prima del primer o della pittura?',
      'Non hai carteggiato a fondo pitture vecchie di cui non conosci la composizione?',
    ]),
  ]
  if (usePrimer) {
    phases.push(
      phase('pittura', 'primer', 'Primer o fissativo', 'Stendi il fissativo in modo uniforme, senza lasciare colature.\nRispetta il tempo di sovraverniciatura scritto sulla scheda del prodotto che hai comprato.\nSu macchie di umidità ferma il lavoro: la pittura non le chiude.', 'fissativo primer pareti interne tutorial', [
        'Il fondo ha smesso di sfarinare al tatto?',
        'Hai rispettato l’asciugatura indicata sulla scheda?',
        'Le macchie di umidità sono state capite prima di coprirle?',
      ]),
    )
  }
  phases.push(
    phase('pittura', 'prima', 'Prima mano', 'Taglia angoli e soffitto col pennello, poi chiudi il campo col rullo.\nLavora bagnato su bagnato, senza ripassare quando la pittura ha già tirato.\nLa prima mano può coprire poco: è normale.', 'prima mano idropittura interni rullo tutorial', [
      'I tagli agli angoli sono stati fatti prima del rullo?',
      'Non ci sono colature sul soffitto?',
      'La mano è continua, senza rettangoli di rullo già asciutti?',
    ]),
    phase('pittura', 'finitura', coats > 1 ? 'Mani successive' : 'Chiusura della mano', `Prevedi ${coats} ${coats === 1 ? 'mano' : 'mani'} di idropittura.\nLa mano dopo si dà solo a fondo asciutto, secondo la scheda.\nIncrocia il rullo e controlla controluce.`, 'seconda mano pittura pareti tutorial', [
      'La mano precedente è asciutta?',
      'La copertura è uniforme controluce?',
      'Gli angoli non sono più chiari del campo?',
    ]),
    phase('pittura', 'controllo', 'Controllo e smontaggio protezioni', 'Guarda spigoli, dietro i termosifoni e il soffitto.\nTogli il nastro quando la pittura è ancora appena morbida sul bordo, se la scheda non dice altro.\nPulisci schizzi da pavimento e ferramenta.', 'controllo finale tinteggiatura interni', [
      'Gli spigoli sono coperti?',
      'Il nastro è stato tolto senza strappare la pelle di pittura?',
      'La stanza è pulita e arieggiata?',
    ]),
  )

  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} il lavoro è una tinteggiatura di interni.`,
    currentState: ceilingOn
      ? `Pareti ${numIt(walls)} m², soffitto ${numIt(ceiling)} m², totale da pitturare ${numIt(surface)} m², ${coats} mani${usePrimer ? ', con primer' : ', senza primer'}.`
      : `Pareti ${numIt(walls)} m², soffitto escluso, ${coats} mani${usePrimer ? ', con primer' : ', senza primer'}.`,
    difficulty,
    criticalPoints: critical,
    tools: ['Rullo e asta', 'Pennello da taglio', 'Vassoio', 'Spatola', 'Carta abrasiva', 'Teli e nastro', 'Scala stabile', 'Luce radente per il controllo'],
    safety: [
      'Scala aperta in piano, sempre tre punti di appoggio. Non salire sugli ultimi gradini.',
      'Arieggia il locale. Leggi i pittogrammi del barattolo prima di aprire.',
      'Tieni bambini e animali fuori finché i teli sono a terra e la pittura è fresca.',
      'Se compare muffa estesa o intonaco che suona a vuoto, fermati: non è più una semplice tinteggiatura.',
    ],
    notes: [
      note(`Idropittura: litri = m² × mani / ${PAINT_COVERAGE_M2_PER_L} × (1 + sfrido). ${VERIFY}`, 'scheda tecnica'),
      note('Lo sfrido del 10% è una regola pratica per assorbimento e ritocchi, non un dato di laboratorio.', 'regola pratica'),
      note('Il tempo di asciugatura tra le mani si legge sulla scheda del barattolo scelto e dipende anche da freddo e umidità della stanza.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Superficie da pitturare', 'm² = pareti + soffitto (solo se compreso e misurato)', `${numIt(surface)} m²`),
      step('Idropittura', `litri = m² × mani / ${PAINT_COVERAGE_M2_PER_L} × (1 + ${numIt(wastePct, 0)}%)`, `${numIt(paintL)} L`),
      step('Primer', usePrimer ? `litri = m² / ${PRIMER_COVERAGE_M2_PER_L} × (1 + sfrido)` : 'Non previsto in questo fascicolo', usePrimer ? `${numIt(primerL)} L` : '0 L'),
      step('Tempo', 'ore = m²/25 + primer m²/16 + (m² × mani)/12', `${numIt(hours, 1)} h`),
    ],
    phases,
    checklist: checks('pittura', [
      'La copertura è uniforme anche controluce e sul soffitto.',
      'Non restano aloni, colature o riprese lucide.',
      'Spigoli, stipiti e zoccoli sono puliti.',
      'Il nastro e i teli sono stati rimossi senza danni.',
      'La stanza è arieggiata e il pavimento è pulito.',
      'Eventuali macchie di umidità non sono state solo coperte.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.pittura, LABOR_NOTE),
    areaM2: surface,
  })
}

function floorLines(
  prefix: string,
  area: number,
  widthCm: number,
  heightCm: number,
  wastePct: number,
  jointMm: number,
  thicknessMm: number,
): MaterialLine[] {
  const waste = wasteFraction(wastePct)
  const orderM2 = areaWithWaste(area, wastePct)
  const pieces = tileCount(area, widthCm, heightCm, wastePct)
  const glue = adhesiveKg(area, ADHESIVE_KG_PER_M2, waste)
  const grout = groutKg(area, widthCm, heightCm, jointMm, thicknessMm, waste)
  return [
    mat(
      `mat:${prefix}:piastrelle`,
      `Piastrelle ${numIt(widthCm, 0)}×${numIt(heightCm, 0)} cm`,
      orderM2,
      'm²',
      PRICE.tilePerM2,
      `sfrido ${numIt(wastePct, 0)}% già compreso, circa ${pieces} pezzi`,
      'Conta i pezzi sul formato reale e tieni gli scarti di taglio. In diagonale aumenta lo sfrido.',
      'Prezzo al m² indicativo di una piastrella generica, da sostituire col listino del formato scelto.',
    ),
    mat(
      `mat:${prefix}:colla`,
      'Collante cementizio di classe C2',
      glue,
      'kg',
      PRICE.adhesivePerKg,
      `sfrido ${numIt(wastePct, 0)}% già compreso`,
      'La spatola (qui assunta da 10 mm) cambia il consumo. Verifica anche il fondo.',
      `${VERIFY} Consumo usato: ${ADHESIVE_KG_PER_M2} kg/m², intervallo spesso pubblicato 4–5 kg/m² con spatola da 10 mm.`,
    ),
    mat(
      `mat:${prefix}:stucco`,
      'Stucco cementizio per fughe',
      grout,
      'kg',
      PRICE.groutPerKg,
      `sfrido ${numIt(wastePct, 0)}% già compreso`,
      'Misura fuga e spessore reali: lo stucco cambia molto.',
      `${VERIFY} Formula pratica kg/m² = ((A+B)/(A×B)) × fuga × spessore × 1,5 con i lati in mm.`,
    ),
    mat(
      `mat:${prefix}:croci`,
      'Distanziatori',
      Math.max(1, area / 8),
      'bustine',
      PRICE.spacerBag,
      'una bustina ogni 8 m² circa',
      'Lo spessore del distanziatore deve essere la fuga che hai deciso.',
      'Regola pratica.',
    ),
  ]
}

function terraceJob(draft: JobDraft): JobBody {
  const area = Math.max(0, num(draft.inputs, 'areaM2'))
  const perimeter = Math.max(0, num(draft.inputs, 'perimeterM'))
  const drains = Math.max(0, Math.round(num(draft.inputs, 'drains', 1)))
  const slope = num(draft.inputs, 'slopePercent', 1.5)
  const length = Math.max(0, num(draft.inputs, 'lengthM', 5))
  const withFloor = flag(draft.inputs, 'withFlooring')
  const wastePct = withFloor ? num(draft.inputs, 'tileWastePercent', 10) : 10
  const waste = wasteFraction(10)
  const kg = membraneKg(area, MEMBRANE_THICKNESS_MM, MEMBRANE_KG_PER_M2_PER_MM, waste)
  const primer = terracePrimerKg(area, TERRACE_PRIMER_KG_PER_M2, waste)
  const band = cornerBandMeters(perimeter, drains)
  const cmPerM = slopeCmPerMeter(slope)
  const totalCm = slopeTotalCm(slope, length)
  const width = num(draft.inputs, 'tileWidthCm', 60)
  const height = num(draft.inputs, 'tileHeightCm', 60)
  const hours = terraceLaborHours(area, drains, withFloor)

  const materials: MaterialLine[] = [
    mat(
      'mat:impermeabilizzazione:membrana',
      'Membrana cementizia bicomponente elastica',
      kg,
      'kg',
      PRICE.membranePerKg,
      'sfrido 10% già compreso',
      'Pesa i kg sul secchio e controlla lo spessore bagnato. Due mani, circa 2 mm finiti, sono l’ipotesi.',
      `${VERIFY} ${MEMBRANE_KG_PER_M2_PER_MM} kg/m² per mm × ${MEMBRANE_THICKNESS_MM} mm ≈ ${numIt(MEMBRANE_KG_PER_M2_PER_MM * MEMBRANE_THICKNESS_MM)} kg/m². Intervallo spesso pubblicato 1,5–1,8 kg/m² per mm.`,
    ),
    mat(
      'mat:impermeabilizzazione:primer',
      'Primer per fondi cementizi',
      primer,
      'kg',
      PRICE.terracePrimerPerKg,
      'sfrido 10% già compreso',
      'Il fondo deve essere pulito, coeso, senza ristagni di polvere.',
      `${VERIFY} Consumo usato: ${TERRACE_PRIMER_KG_PER_M2} kg/m². Intervallo tipico circa 0,1–0,3 kg/m².`,
    ),
    mat(
      'mat:impermeabilizzazione:bandella',
      'Bandella per angoli, giunti e scarichi',
      band,
      'm',
      PRICE.bandPerM,
      'perimetro × 1,1 più 1,2 m a scarico',
      perimeter <= 0 ? 'Perimetro non misurato: questa quantità è solo l’extra scarichi. Misura gli angoli.' : 'Misura soglie, pilastri e risvolti verticali, non solo il filo esterno.',
      'Regola pratica di sormonto. Larghezza tipica di bandella 12–14 cm: conferma sulla scheda del sistema scelto.',
    ),
    mat(
      'mat:impermeabilizzazione:scarichi',
      'Kit di raccordo per scarico (generico)',
      drains,
      'pz',
      PRICE.drainKit,
      'uno per scarico, senza scorta',
      'Verifica diametro e che il bocchettone sia solidale col massetto, non solo appoggiato.',
      'Prezzo indicativo di un pezzo generico. Il modello deve essere compatibile col sistema scelto. Da verificare in cantiere.',
    ),
  ]
  if (withFloor) {
    materials.push(
      ...floorLines('impermeabilizzazione', area, width, height, wastePct, 3, 10),
      mat(
        'mat:impermeabilizzazione:silicone',
        'Sigillante poliuretanico o neutro per giunti perimetrali',
        Math.max(1, perimeter > 0 ? perimeter / 6 : 1),
        'cartucce',
        PRICE.silicone,
        perimeter > 0 ? 'una cartuccia ogni 6 m circa' : 'quantità minima: il perimetro non è misurato',
        'I giunti elastici perimetrali non si chiudono con lo stucco cementizio.',
        'Da verificare in cantiere sul tipo di sigillante ammesso dal pavimento.',
      ),
    )
  }

  const critical = [
    perimeter <= 0 ? 'Perimetro a zero: la bandella è incompleta finché non misuri angoli e soglie.' : 'Angoli e scarichi sono i punti che fanno fallire la tenuta, non il centro del piano.',
    slope < 1 || slope > 2.5
      ? `Pendenza ${numIt(slope, 1)}%: per un piano pedonabile si usa spesso circa 1–2%. Verifica soglie e altezze prima di fissarla.`
      : 'La pendenza deve arrivare davvero agli scarichi, senza conche.',
    'Non impermeabilizzare su ceramica in fase di distacco, su fondi polverosi o su ristagni.',
    'Una prova d’acqua si fa solo se soglie e scarichi possono trattenerla senza allagare i locali sotto.',
  ]

  const phases: Phase[] = [
    phase('impermeabilizzazione', 'sottofondo', 'Sottofondo', 'Togli il pavimento in fase di distacco e tutto ciò che suona a vuoto.\nLava il fondo cementizio e lascialo asciugare.\nSegna buche e fessure: si chiudono prima della pendenza, non sopra la membrana.', 'preparazione sottofondo terrazza prima di impermeabilizzare tutorial', [
      'Il fondo è coeso e senza parti che si staccano?',
      'Non restano colle o polvere sciolta?',
      'Le buche grandi sono state chiuse prima del nuovo massetto di pendenza?',
    ]),
    phase('impermeabilizzazione', 'pendenza', 'Pendenza', `Porta l’acqua agli scarichi con una pendenza del ${numIt(slope, 1)}%.\nSono ${numIt(cmPerM, 1)} cm di dislivello per ogni metro. Sulla lunghezza di ${numIt(length, 1)} m fanno ${numIt(totalCm, 1)} cm.\nControlla con una staggia e un livello, non a occhio. ${SLOPE_EXAMPLE}`, 'massetto pendenza terrazza scarichi tutorial', [
      'Il dislivello misurato è coerente con la percentuale scelta?',
      'Non ci sono conche lontano dagli scarichi?',
      'Le soglie restano più alte del piano finito?',
    ]),
    phase('impermeabilizzazione', 'primer', 'Primer', 'Stendi il primer sul fondo asciutto e pulito.\nRispetta la finestra di tempo della scheda prima della membrana.\nNon primerizzare se piove o se il fondo è bagnato.', 'primer sottofondo terrazza membrana cementizia tutorial', [
      'Il fondo era asciutto?',
      'Il primer è uniforme, senza pozzanghere?',
      'Hai letto i tempi sulla scheda del prodotto comprato?',
    ]),
    phase('impermeabilizzazione', 'membrana', 'Impermeabilizzazione', 'Stendi la membrana cementizia bicomponente in due mani, fino a circa 2 mm complessivi.\nLa seconda mano incrocia la prima, a prodotto indurito secondo scheda.\nRisvolta in verticale su soglie e muretti per almeno una decina di centimetri, se le quote lo permettono.', 'impermeabilizzazione terrazza membrana cementizia bicomponente tutorial', [
      'Le due mani sono incrociate?',
      'Lo spessore è continuo, anche vicino agli scarichi?',
      'I risvolti verticali ci sono dove l’acqua può fermarsi?',
    ]),
    phase('impermeabilizzazione', 'angoli', 'Trattamento angoli e scarichi', 'Annega la bandella negli angoli, nei giunti e intorno a ogni scarico, dentro la membrana fresca.\nI sormonti della bandella non vanno lasciati a secco.\nLo scarico deve essere raccordato, non solo “toccato” dalla malta.', 'bandella angoli scarichi terrazza impermeabilizzazione tutorial', [
      'Ogni angolo ha la bandella continua?',
      'Ogni scarico è raccordato?',
      'I sormonti sono annegati, non solo appoggiati?',
    ]),
  ]
  if (withFloor) {
    phases.push(
      phase('impermeabilizzazione', 'collante', 'Collante', 'Posa il collante C2 solo quando la membrana è pronta secondo la sua scheda.\nDoppio spalmatura sulle lastre grandi.\nNon chiudere la terrazza se è annunciata pioggia nel tempo di presa.', 'posa pavimento su guaina cementizia terrazza tutorial', [
        'La membrana è fuori dai tempi minimi di attesa della scheda?',
        'Le lastre grandi sono a doppia spalmatura?',
        'Il meteo copre la presa del collante?',
      ]),
      phase('impermeabilizzazione', 'pavimento', 'Pavimentazione', 'Parti dagli scarichi e dalle soglie, non dal centro a caso.\nMantieni le fughe e non pestare il fresco.\nLascia un giunto perimetrale libero: non arrivare a battuta sul muro.', 'posa piastrelle esterne terrazza tutorial', [
        'Le fughe sono costanti?',
        'Il giunto perimetrale è libero?',
        'Le pendenze non sono state annullate dallo spessore della colla?',
      ]),
      phase('impermeabilizzazione', 'fughe', 'Fugatura', 'Stucca solo a collante maturo.\nPulisci il velo di stucco prima che indurisca sulla superficie.\nI giunti perimetrali vanno in sigillante elastico, non in stucco rigido.', 'fugatura piastrelle esterne e giunto perimetrale tutorial', [
        'Lo stucco è pieno e senza buchi?',
        'Il velo è stato pulito?',
        'Il perimetro è elastico e non cementizio?',
      ]),
    )
  } else {
    phases.push(
      phase('impermeabilizzazione', 'prova', 'Attesa e controllo tenuta', 'Rispetta i giorni di stagionatura scritti sulla scheda prima di qualsiasi prova o pavimento.\nSe fai una prova d’acqua, tappi gli scarichi solo quando sei certo di non allagare l’interno.\nSegna ogni bolla o punto morbido prima di coprire la membrana.', 'prova tenuta impermeabilizzazione terrazza', [
        'I tempi di scheda sono passati?',
        'La prova d’acqua, se fatta, non rischia i locali sotto?',
        'Hai segnato i difetti prima di coprire?',
      ]),
    )
  }

  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} il lavoro è un’impermeabilizzazione di piano, con lettura esplicita della pendenza.`,
    currentState: `Superficie ${numIt(area)} m², perimetro ${numIt(perimeter)} m, ${drains} scarichi, pendenza ${numIt(slope, 1)}% su ${numIt(length, 1)} m${withFloor ? ', con nuova pavimentazione' : ''}.`,
    difficulty: area >= 25 ? 'alta' : 'media',
    criticalPoints: critical,
    tools: ['Staggia e livella', 'Frattazzo e spatola dentata', 'Miscelatore', 'Pennello e rullo da membrana', 'Cutter', 'Secchio graduato', 'Metro'],
    safety: [
      'Sulle terrazze in quota valgono parapetto o imbrago. Non lavorare sul bordo senza protezione.',
      'Le malte cementizie irritano pelle e occhi: guanti, occhiali, e non respirare la polvere in miscela.',
      'Chiudi il passaggio alle persone finché primer e membrana sono freschi.',
      'Non sovraccaricare un solaio di cui non conosci la portata con cumuli di demolizione.',
    ],
    notes: [
      note(`Membrana: kg = m² × ${MEMBRANE_THICKNESS_MM} mm × ${MEMBRANE_KG_PER_M2_PER_MM} kg/m²/mm × 1,10. ${VERIFY}`, 'scheda tecnica'),
      note(`${SLOPE_FORMULA}. ${SLOPE_EXAMPLE}`, 'regola pratica'),
      note('Quote di soglia, spessore del pacchetto e compatibilità tra membrana e collante si verificano sui prodotti realmente acquistati.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Dislivello per metro', 'cm/m = pendenza %', `${numIt(cmPerM, 1)} cm/m`),
      step('Dislivello sulla lunghezza', SLOPE_FORMULA, `${numIt(totalCm, 1)} cm su ${numIt(length, 1)} m`),
      step('Membrana', `kg = m² × ${MEMBRANE_THICKNESS_MM} × ${MEMBRANE_KG_PER_M2_PER_MM} × 1,10`, `${numIt(kg)} kg`),
      step('Bandella', 'm = perimetro × 1,1 + scarichi × 1,2', `${numIt(band)} m`),
      step('Tempo', 'ore di preparazione, pendenza, membrana, dettagli e eventuale pavimento', `${numIt(hours, 1)} h`),
    ],
    slope: {
      percent: slope,
      cmPerMeter: cmPerM,
      lengthM: length,
      totalCm,
      formula: SLOPE_FORMULA,
      example: SLOPE_EXAMPLE,
    },
    phases,
    checklist: checks('impermeabilizzazione', [
      'L’acqua non resta in conca: arriva agli scarichi.',
      'Angoli, soglie e scarichi hanno bandella o raccordo continuo.',
      'Lo spessore della membrana è stato controllato, non solo “dato a vista”.',
      'I tempi di scheda tra le mani e prima del pavimento sono stati rispettati.',
      withFloor ? 'Fughe piene e giunto perimetrale elastico.' : 'La membrana non è stata coperta prima del controllo.',
      'Non ci sono lesioni nuove sul risvolto verticale.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.impermeabilizzazione, LABOR_NOTE),
    areaM2: area,
  })
}

function floorJob(draft: JobDraft): JobBody {
  const area = Math.max(0, num(draft.inputs, 'areaM2'))
  const width = num(draft.inputs, 'tileWidthCm', 60)
  const height = num(draft.inputs, 'tileHeightCm', 60)
  const joint = num(draft.inputs, 'jointMm', 2)
  const thick = num(draft.inputs, 'tileThicknessMm', 8)
  const wastePct = num(draft.inputs, 'wastePercent', 10)
  const orderM2 = areaWithWaste(area, wastePct)
  const pieces = tileCount(area, width, height, wastePct)
  const hours = flooringLaborHours(area)
  const materials = [
    ...floorLines('pavimentazione', area, width, height, wastePct, joint, thick),
    mat('mat:pavimentazione:silicone', 'Sigillante per giunto perimetrale', Math.max(1, Math.sqrt(area) / 2), 'cartucce', PRICE.silicone, 'stima grossolana sul perimetro di una stanza compatta', 'Misura il perimetro reale: questa cartuccia è solo un ordine di grandezza.', 'Da verificare in cantiere.'),
  ]
  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} il lavoro è una pavimentazione a colla.`,
    currentState: `${numIt(area)} m², formato ${numIt(width, 0)}×${numIt(height, 0)} cm, fuga ${numIt(joint, 1)} mm, sfrido ${numIt(wastePct, 0)}%.`,
    difficulty: area >= 40 ? 'media' : 'bassa',
    criticalPoints: [
      'Il piano deve essere in quota e planare prima della colla. La colla non corregge una conca.',
      'Lastre grandi: doppia spalmatura, altrimenti suonano a vuoto.',
      'Giunto perimetrale libero, specie sopra un impianto radiante o su un massetto giovane.',
      'Se sotto c’è una terrazza, questo fascicolo non sostituisce l’impermeabilizzazione.',
    ],
    tools: ['Spatola dentata', 'Crocette', 'Livella e staggia', 'Tagliapiastrelle o flex con disco adatto e acqua', 'Ventosa', 'Spugna', 'Metro'],
    safety: [
      'Il taglio a disco fa polvere e schegge: occhiali, maschera, guanti, e non a mano libera instabile.',
      'Tieni il cavo dell’utensile fuori dall’acqua di taglio.',
      'Ginocchiere: è un lavoro a terra lungo.',
      'Se il sottofondo suona a vuoto su ampia superficie, fermati prima di incollare sopra.',
    ],
    notes: [
      note('m² da ordinare = m² × (1 + sfrido). I pezzi si arrotondano per eccesso sul formato.', 'regola pratica'),
      note(`Collante: ${ADHESIVE_KG_PER_M2} kg/m² con spatola da 10 mm, più sfrido. ${VERIFY}`, 'scheda tecnica'),
      note('Fuga, spessore e rettifica della piastrella scelta cambiano lo stucco. Misurali sulla confezione.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Superficie con sfrido', `m² × (1 + ${numIt(wastePct, 0)}%)`, `${numIt(orderM2)} m²`),
      step('Pezzi', 'pezzi = arrotondamento per eccesso di (m² con sfrido / area di una piastrella)', `${pieces} pz`),
      step('Collante', `kg = m² × ${ADHESIVE_KG_PER_M2} × (1 + sfrido)`, `${numIt(adhesiveKg(area, ADHESIVE_KG_PER_M2, wasteFraction(wastePct)))} kg`),
      step('Tempo', 'ore ≈ m² / 4 + 1,2', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('pavimentazione', 'piano', 'Verifica del piano', 'Controlla quote verso le porte e planarità con la staggia.\nTogli piastrelle cave e polvere.\nDecidi il verso di posa e il punto di partenza prima di impastare.', 'verifica massetto prima della posa piastrelle tutorial', [
        'Le porte chiudono ancora con lo spessore previsto?',
        'La staggia non mostra conche evidenti?',
        'Il verso di posa è segnato?',
      ]),
      phase('pavimentazione', 'tracciamento', 'Tracciamento', 'Stendi una fila a secco per vedere i tagli.\nEvita di finire con una striscia sottile contro il muro più in vista.\nSegna gli assi.', 'tracciamento posa piastrelle a secco tutorial', [
        'I tagli di chiusura sono accettabili?',
        'Gli assi sono segnati?',
        'Hai tenuto conto di fuori squadra della stanza?',
      ]),
      phase('pavimentazione', 'colla', 'Collante', 'Impasta solo quanto stendi prima che tiri.\nSpatola dentata piena, doppia spalmatura sulle grandi lastre.\nNon bagnare il fondo “per far prendere” se la scheda non lo chiede.', 'colla piastrelle spatola dentata doppia spalmatura tutorial', [
        'Il dente della spatola è pieno?',
        'Le grandi lastre sono imburrate anche sul retro?',
        'Non stai posando su colla già filmata?',
      ]),
      phase('pavimentazione', 'posa', 'Posa', 'Assesta ogni pezzo e controlla spesso la planarità.\nMantieni la fuga col distanziatore.\nLascia il perimetro libero.', 'posa piastrelle pavimento tutorial', [
        'Le fughe sono regolari?',
        'Non ci sono denti tra una lastra e l’altra?',
        'Il perimetro non è a battuta?',
      ]),
      phase('pavimentazione', 'fuga', 'Fugatura', 'Stucca a collante maturo.\nPulisci in diagonale e cambia l’acqua spesso.\nSigilla il perimetro a parte.', 'fugatura pavimento e pulizia velo stucco tutorial', [
        'Le fughe sono piene?',
        'Il velo di stucco è stato tolto in tempo?',
        'Il silicone perimetrale è stato lasciato per ultimo?',
      ]),
    ],
    checklist: checks('pavimentazione', [
      'Nessuna piastrella suona a vuoto in modo diffuso.',
      'Le fughe sono piene e del colore previsto.',
      'I tagli contro gli stipiti sono puliti.',
      'Il giunto perimetrale è elastico.',
      'Le porte e i sanitari tornano al loro posto senza forzare.',
      'Il pavimento è pulito dal velo di stucco.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.pavimentazione, LABOR_NOTE),
    areaM2: area,
  })
}

function drywallJob(draft: JobDraft): JobBody {
  const kind = str(draft.inputs, 'kind', 'parete')
  const ceiling = kind === 'controsoffitto'
  const area = Math.max(0, num(draft.inputs, 'areaM2'))
  const height = num(draft.inputs, 'heightM', 2.7)
  const layers = Math.max(1, Math.round(num(draft.inputs, 'layers', 1)))
  const wastePct = num(draft.inputs, 'wastePercent', 10)
  const waste = wasteFraction(wastePct)
  const boards = boardCount(area, layers, BOARD_AREA_M2, waste)
  const length = ceiling ? 0 : wallLengthM(area, height)
  const studs = ceiling ? 0 : studCount(length, 0.6)
  const tracks = ceiling ? 0 : trackPieces(length, 3)
  const metalM = ceiling ? ceilingMetalMeters(area) : 0
  const profiles = ceiling ? profilePieces(metalM, 3) : 0
  const hangers = ceiling ? hangerCount(area) : 0
  const screws = screwCount(area, layers)
  const boxes = screwBoxes(screws)
  const mud = jointCompoundKg(area, layers)
  const tapeM = round2(area * layers * 1.3)
  const hours = drywallLaborHours(area, layers, ceiling)
  const materials: MaterialLine[] = [
    mat('mat:cartongesso:lastre', 'Lastre di cartongesso 120×200 cm', boards, 'pz', PRICE.board, `sfrido ${numIt(wastePct, 0)}% e ${layers} ${layers === 1 ? 'strato' : 'strati'} già compresi`, 'Le lastre da 120×300 cambiano il conteggio: qui l’area lastra è 2,4 m².', 'Regola pratica di taglio. Da verificare in cantiere sul formato che compri.'),
    mat('mat:cartongesso:viti', 'Viti autofilettanti per cartongesso', boxes, 'scatole', PRICE.screwsBox, `circa ${screws} viti, scatole da 1000`, 'Una vite ogni 20–25 cm circa sui montanti, senza rompere il cartone.', 'Regola pratica: 22 viti a m² per strato.'),
    mat('mat:cartongesso:stucco', 'Stucco per giunti', mud, 'kg', PRICE.jointCompoundPerKg, 'nessuno sfrido extra oltre gli strati', 'Servono più passate, non un solo spolvero.', `${VERIFY} ${JOINT_COMPOUND_KG_PER_M2} kg/m² per strato, intervallo tipico 0,4–0,5 kg/m².`),
    mat('mat:cartongesso:nastro', 'Nastro per giunti', tapeM, 'm', PRICE.jointTapePerM, 'stima 1,3 m di giunto a m² per strato', 'Misura i giunti reali se la trama delle lastre è diversa.', 'Regola pratica.'),
  ]
  if (ceiling) {
    materials.splice(
      1,
      0,
      mat('mat:cartongesso:profili', 'Profili metallici per orditura', profiles, 'pz', PRICE.stud, 'pezzi da 3 m ricavati da 3,2 ml/m²', 'L’interasse reale si decide in opera, spesso 40–50 cm per l’orditura secondaria.', 'Regola pratica: 3,2 metri lineari di profilo a m². Da verificare in cantiere.'),
      mat('mat:cartongesso:pendini', 'Pendini o ganci di sospensione', hangers, 'pz', PRICE.hanger, 'circa uno ogni 0,8 m²', 'Verifica il fissaggio al solaio: laterizio, calcestruzzo o legno non usano lo stesso tassello.', 'Regola pratica.'),
    )
  } else {
    materials.splice(
      1,
      0,
      mat('mat:cartongesso:montanti', 'Montanti verticali, passo 60 cm', studs, 'pz', PRICE.stud, 'conteggio geometrico, senza scorta', `Lunghezza parete ricavata: ${numIt(length)} m (m² / altezza). I montanti si ordinano dell’altezza giusta.`, 'Regola pratica. Da verificare in cantiere se l’altezza costringe a giuntare.'),
      mat('mat:cartongesso:guide', 'Guide a pavimento e soffitto', tracks, 'pz', PRICE.track, 'pezzi da 3 m, perimetro alto e basso', 'Le guide si fissano su un sottofondo solido, non sul solo pavimento flottante.', 'Regola pratica.'),
    )
  }

  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} il lavoro è un ${ceiling ? 'controsoffitto' : 'una parete'} in cartongesso.`,
    currentState: ceiling
      ? `Controsoffitto ${numIt(area)} m², ${layers} ${layers === 1 ? 'strato' : 'strati'}.`
      : `Parete ${numIt(area)} m², altezza ${numIt(height)} m, sviluppo ${numIt(length)} m, ${layers} ${layers === 1 ? 'strato' : 'strati'}.`,
    difficulty: ceiling || area >= 25 || layers > 1 ? 'media' : 'bassa',
    criticalPoints: [
      ceiling
        ? 'Il fissaggio al solaio vale più della lastra: un pendino sbagliato non si “sistema” con lo stucco.'
        : 'Guide storte diventano una parete storta. Controlla filo e piombo prima di chiudere.',
      'Impianti dentro la parete: foto e misure prima di chiudere le lastre.',
      'I giunti senza nastro si rivedono alla prima luce radente.',
      'Un cartongesso non è una struttura portante.',
    ],
    tools: ['Avvitatore', 'Cesoia per profili', 'Cutter', 'Livella e filo', 'Spatole per giunti', 'Tasselli adatti al fondo', 'Metro'],
    safety: [
      'Occhiali quando tagli i profili: le bave di lamiera tagliano.',
      'Verifica cosa c’è dentro muro e solaio prima di forare: cavi e tubi.',
      'Scala o trabattello in piano. Non montare le lastre in equilibrio.',
      'La polvere di stucco e di lastra si respira: maschera nel taglio e nella carteggiatura.',
    ],
    notes: [
      note('Lastre 120×200 = 2,4 m². Numero = arrotondamento per eccesso di (m² × strati × (1+sfrido) / 2,4).', 'regola pratica'),
      note(ceiling ? 'Orditura controsoffitto stimata a 3,2 ml di profilo a m² e un pendino ogni 0,8 m².' : 'Montanti = sviluppo / 0,60 m, più la testata. Guide = due volte lo sviluppo, in barre da 3 m.', 'regola pratica'),
      note('Passo, spessore della lastra (qui non distinto tra standard e idro) e tipo di tassello si scelgono sul posto e sul locale (bagno, fuoco, acustica).', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Lastre', `pezzi = tetto( m² × strati × (1+${numIt(wastePct, 0)}%) / ${BOARD_AREA_M2} )`, `${boards} pz`),
      step(ceiling ? 'Profili' : 'Montanti', ceiling ? 'pezzi da 3 m su 3,2 ml/m²' : 'montanti = tetto(lunghezza / 0,60) + 1', ceiling ? `${profiles} pz` : `${studs} pz`),
      step('Viti', 'viti = m² × strati × 22', `${screws} viti, ${boxes} scatole`),
      step('Tempo', ceiling ? 'ore ≈ m² × 0,75 × fattore strati' : 'ore ≈ m² × 0,55 × fattore strati', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('cartongesso', 'tracciamento', 'Tracciamento', 'Segna a terra e a soffitto l’ingombro finito, compreso lo spessore.\nControlla gli angoli della stanza: raramente sono retti.\nSegna porte e punti dove non può cadere un montante.', 'tracciamento parete cartongesso tutorial', [
        'Il filo a terra e quello a soffitto coincidono?',
        'Porte e impianti sono segnati?',
        'Hai verificato che la parete non finisca sopra un tubo nascosto?',
      ]),
      phase('cartongesso', 'struttura', ceiling ? 'Orditura' : 'Struttura metallica', ceiling
        ? 'Fissa le guide perimetrali e sospendi l’orditura. I pendini vanno nel solaio vero, non nell’intonaco.\nControlla la quota finita in più punti.\nGli impianti passano prima della chiusura.'
        : 'Fissa le guide, poi i montanti a passo 60 cm, piombati.\nIrrigidisci stipiti delle porte.\nFai passare cavi e tubi adesso, con foto, prima delle lastre.',
      ceiling ? 'orditura metallica controsoffitto cartongesso tutorial' : 'struttura metallica parete cartongesso montanti tutorial', [
        'La struttura è in bolla e in quota?',
        'I fissaggi entrano nel supporto vero?',
        'Gli impianti sono fotografati prima della chiusura?',
      ]),
      phase('cartongesso', 'lastre', 'Lastre', `Avvita ${layers} ${layers === 1 ? 'strato' : 'strati'}, sfalsando i giunti tra uno strato e l’altro.\nLe viti affondano appena sotto il cartone, senza strapparlo.\nLascia qualche millimetro da pavimento: la lastra non sta nell’acqua.`, 'montaggio lastre cartongesso viti tutorial', [
        'I giunti degli strati sono sfalsati?',
        'Le viti non hanno rotto il cartone?',
        'La lastra non poggia nel bagnato del pavimento?',
      ]),
      phase('cartongesso', 'giunti', 'Giunti e stucco', 'Nastro nei giunti, poi stucco in più passate.\nStucca anche le teste delle viti.\nCarteggia solo quando è asciutto, con luce radente.', 'stucco giunti cartongesso nastro tutorial', [
        'Ogni giunto ha il nastro?',
        'Le teste delle viti sono coperte?',
        'Alla luce radente non si legge la lastra?',
      ]),
    ],
    checklist: checks('cartongesso', [
      'La parete o il soffitto è in piano e non “onda” alla luce.',
      'I giunti sono nastrati e le viti coperte.',
      'Porte e botole, se previste, aprono senza toccare.',
      'Gli impianti interni sono stati fotografati e misurati prima della chiusura.',
      'Non ci sono lastre rotte o cartone strappato lasciato in vista.',
      'Il locale è pulito dalla polvere di stucco.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.cartongesso, LABOR_NOTE),
    areaM2: area,
  })
}

function plumbingJob(draft: JobDraft): JobBody {
  const point = str(draft.inputs, 'leakPoint', 'sifone')
  const fixtures = Math.max(1, Math.round(num(draft.inputs, 'fixtures', 1)))
  const kit = plumbingKit(point, fixtures)
  const hours = plumbingLaborHours(fixtures)
  const where: Record<string, string> = {
    sifone: 'sul sifone',
    rubinetto: 'sul rubinetto o sul vitone',
    flessibili: 'sui flessibili',
    scarico_lavabo: 'sullo scarico del lavabo',
    non_so: 'in un punto ancora da isolare',
  }
  const materials: MaterialLine[] = [
    mat('mat:idraulica:ptfe', 'Nastro PTFE', kit.ptfeRolls, 'rotoli', PRICE.ptfe, 'un rotolo a punto più un rotolo di scorta', 'Poche spire tirate, nel senso di avvitamento. Non farne un gomitolo.', 'Regola pratica di cantiere.'),
    mat('mat:idraulica:guarnizioni', 'Guarnizioni di ricambio, misure da rilevare', kit.gaskets, 'pz', PRICE.gasket, 'due a punto: una di lavoro e una di scorta immediata', 'Porta la guarnizione vecchia in negozio. Il diametro non si indovina.', 'Da verificare in cantiere.'),
  ]
  if (kit.traps > 0) {
    materials.push(mat('mat:idraulica:sifone', 'Sifone di scarico lavabo, attacco da verificare', kit.traps, 'pz', PRICE.trap, 'uno a punto se il corpo è incrinato o la filettatura è rovinata', 'Misura diametro scarico e passo. Non forzare la plastica cromata.', 'Prezzo di un sifone generico. Da verificare in cantiere.'))
  }
  if (kit.hoses > 0) {
    materials.push(mat('mat:idraulica:flessibili', 'Flessibili di collegamento acqua', kit.hoses, 'pz', PRICE.hose, 'coppia per punto quando il flessibile è il sospettato', 'Controlla lunghezza e attacco 3/8 o 1/2 sul posto. Sostituisci se la guaina è gonfia.', 'Da verificare in cantiere. Non è un codice prodotto.'))
  }
  if (point === 'rubinetto' || point === 'non_so') {
    materials.push(mat('mat:idraulica:corpo', 'Corpo rubinetto di ricambio, solo se il corpo è da sostituire', 0, 'pz', PRICE.faucetBody, 'quantità 0: portala a 1 solo se guarnizione e vitone non bastano', 'Il prezzo è un miscelatore generico. Aggiornalo col pezzo reale.', 'Prezzo indicativo modificabile.'))
  }

  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} la perdita va cercata ${where[point] ?? 'sul sanitario'}. Non è ancora una diagnosi di tubo murato.`,
    currentState: `${fixtures} ${fixtures === 1 ? 'punto' : 'punti'} da aprire, ipotesi attuale: ${where[point] ?? point}.`,
    difficulty: point === 'non_so' ? 'media' : 'bassa',
    criticalPoints: [
      'Chiudi l’acqua prima di svitare qualsiasi cosa. Poi apri il rubinetto per togliere la pressione.',
      'Se l’acqua esce dal muro, dal soffitto o da sotto il massetto, fermati: non è un sifone.',
      'Non stringere “finché tiene” un raccordo che gira a vuoto: si spacca il filetto.',
      'Una guarnizione schiacciata o un flessibile gonfio si sostituiscono, non si riparano col nastro.',
    ],
    tools: ['Chiave a pappagallo o a nastro', 'Bacinella', 'Stracci', 'Torcia', 'Cacciavite', 'Nastro PTFE'],
    safety: [
      'Chiudi il rubinetto di intercettazione sotto il sanitario. Se non c’è, chiudi l’acqua generale e avvisa chi è in casa.',
      'Apri il miscelatore dopo la chiusura, finché il flusso si ferma.',
      'Acqua calda: aspetta che il flessibile sia tiepido prima di smontarlo.',
      'Se la perdita è elettrica vicino all’acqua (presa sotto il lavabo), togli tensione prima di mettere le mani nel bagnato.',
    ],
    notes: [
      note('PTFE: un rotolo per punto più uno di scorta. Non è un consumo al metro, è una dotazione.', 'regola pratica'),
      note('Diametri di sifone, flessibile e guarnizione si copiano dal pezzo smontato.', 'da verificare in cantiere'),
      note('Questo fascicolo non calcola una nuova distribuzione di adduzione. Un tubo che perde nel muro è un altro lavoro.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('PTFE', 'rotoli = punti + 1 di scorta', `${kit.ptfeRolls} rotoli`),
      step('Guarnizioni', 'pezzi = punti × 2', `${kit.gaskets} pz`),
      step('Tempo', 'ore = 1,2 + 0,6 × (punti − 1)', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('idraulica', 'chiusura', 'Chiusura acqua', 'Cerca la valvola sotto il lavabo o il sanitario. Chiudila.\nSe non c’è, chiudi il generale.\nApri il rubinetto e verifica che l’acqua si fermi davvero. Metti la bacinella.', 'chiudere acqua sotto lavandino prima di smontare sifone tutorial', [
        'L’acqua è chiusa?',
        'Aprendo il rubinetto non esce più flusso?',
        'La bacinella è sotto il punto?',
      ]),
      phase('idraulica', 'diagnosi', 'Diagnosi del punto', 'Asciuga tutto. Poi osserva se la goccia nasce dal sifone, dal flessibile, dalla base del rubinetto o dal muro.\nUn foglio di carta asciutto aiuta a vedere da che lato arriva.\nSe il muro è bagnato in alto, non smontare il sifone sperando che basti.', 'trovare perdita lavandino sifone o flessibile tutorial', [
        'Hai asciugato prima di giudicare?',
        'La goccia nasce da un raccordo visibile?',
        'Hai escluso che l’acqua arrivi dal muro?',
      ]),
      phase('idraulica', 'smontaggio', 'Smontaggio', 'Svitare con una chiave che non morda il cromo, o con un panno in mezzo.\nTieni i pezzi nell’ordine in cui escono.\nButta la guarnizione vecchia: non si rigira.', 'smontare sifone lavandino tutorial', [
        'I pezzi sono stati tenuti in ordine?',
        'Non hai spanato il filetto?',
        'La guarnizione vecchia è stata scartata?',
      ]),
      phase('idraulica', 'ricambio', 'Ricambio', 'Sostituisci guarnizione, sifone o flessibile secondo ciò che è davvero rovinato.\nIl PTFE va su filetti metallici, poche spire, non sulle guarnizioni piane che devono restare pulite.\nNon usare pasta a caso su plastica e gomma.', 'cambiare guarnizione rubinetto o sifone nastro ptfe tutorial', [
        'Il pezzo nuovo è della misura del vecchio?',
        'Il PTFE, se serve, è solo sul filetto metallico?',
        'Le sedi delle guarnizioni sono pulite?',
      ]),
      phase('idraulica', 'prova', 'Prova di tenuta', 'Riapri l’acqua piano.\nAsciuga e guarda per qualche minuto, poi passa un dito di carta.\nControlla anche sotto, non solo il punto che hai stretto.', 'prova tenuta dopo sostituzione sifone tutorial', [
        'Aperto l’acqua, il punto resta asciutto?',
        'Hai controllato anche i raccordi vicini?',
        'Lo scarico, tappando il lavabo e svuotandolo, non perde?',
      ]),
    ],
    checklist: checks('idraulica', [
      'Con l’acqua aperta il punto smontato resta asciutto per diversi minuti.',
      'Lo scarico del lavabo, una volta riempito e svuotato, non gocciola.',
      'I flessibili non sono tesi né piegati a gomito.',
      'Le valvole sotto il sanitario riaprono e richiudono.',
      'Non restano attrezzi o guarnizioni vecchie nella bacinella sotto il mobile.',
      'Se la perdita era nel muro, il lavoro è stato fermato e non “chiuso” col nastro.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.idraulica, 'Per un idraulico il tempo include lo spostamento minimo già dentro l’ora. Tariffa indicativa modificabile.'),
    areaM2: undefined,
  })
}

function electricJob(draft: JobDraft): JobBody {
  const work = str(draft.inputs, 'workType', 'sostituzione_frutto')
  const points = Math.max(1, Math.round(num(draft.inputs, 'points', 1)))
  const declared = Math.max(0, num(draft.inputs, 'cableMeters'))
  const measured = declared > 0
  const meters = measured ? declared : points * 8
  const newPoint = work === 'nuovo_punto'
  const hours = newPoint ? points * 3.5 : work === 'guasto' ? Math.max(2, points * 1.5) : points * 1.2
  const labels: Record<string, string> = {
    sostituzione_frutto: 'sostituzione di frutti o placche su punti esistenti',
    illuminazione: 'controllo di punti luce esistenti',
    nuovo_punto: 'predisposizione di punti nuovi, da eseguire solo con impresa abilitata',
    guasto: 'ricerca guasto, senza lavorare sotto tensione',
  }
  const materials: MaterialLine[] = [
    mat('mat:elettrica:frutti', 'Frutti o placche di ricambio, serie da scegliere in opera', points, 'pz', 8.5, 'uno a punto, senza scorta di serie diversa', 'La serie civile si copia da quella già a muro. Non mischiare a caso.', 'Prezzo indicativo di un frutto generico. Da verificare in cantiere.'),
    mat('mat:elettrica:cavo', measured ? 'Cavo, metri misurati (sezione non scelta dall’app)' : 'Cavo, stima 8 m a punto (sezione non scelta dall’app)', meters, 'm', 1.35, measured ? 'metri dichiarati, senza sfrido di scorta' : 'stima da sostituire col percorso reale, più un po’ di scorta in opera', 'Misura il percorso. La sezione in mm² dipende da carico, lunghezza, posa e norma: la decide l’elettricista.', 'Da verificare in cantiere. Nessuna sezione è prescritta da questo fascicolo.'),
    mat('mat:elettrica:nastro', 'Nastro isolante', 1, 'rotoli', 1.6, 'un rotolo di dotazione', 'Non è un sistema per “aggiustare” un cavo nudo lasciato in servizio.', 'Regola pratica.'),
  ]
  if (newPoint) {
    materials.push(mat('mat:elettrica:scatole', 'Scatole da incasso o da parete', points, 'pz', 2.4, 'una a punto nuovo', 'Profondità e tipo (incasso, cartongesso, esterna) si vedono sul muro.', 'Da verificare in cantiere.'))
  }

  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} l’intervento elettrico è: ${labels[work] ?? work}.`,
    currentState: `${points} ${points === 1 ? 'punto' : 'punti'}. Cavo: ${measured ? `${numIt(meters)} m misurati` : `${numIt(meters)} m stimati, da misurare`}.`,
    difficulty: 'alta',
    criticalPoints: [
      'Si toglie tensione dal magnetotermico del circuito, o dal generale se non sei certo del circuito.',
      'Si verifica l’assenza di tensione con uno strumento idoneo, su ogni conduttore, prima di aprire il frutto.',
      'Gli impianti fissi negli edifici, in Italia, sono in genere riservati a impresa abilitata (DM 37/2008) e chiedono la dichiarazione di conformità.',
      'Questo fascicolo non descrive come collegare i morsetti e non autorizza lavoro sotto tensione.',
    ],
    tools: ['Cercafase o multimetro usato da chi sa leggerlo', 'Cacciaviti isolati', 'Nastro per segnalare il circuito aperto', 'Torcia'],
    safety: [
      'Togli tensione. Non fidarti solo della posizione della placca o di un interruttore di comando.',
      'Verifica l’assenza di tensione. Uno strumento che non sai usare non è una verifica.',
      'Non lavorare con le mani bagnate, su un pavimento bagnato, o su un circuito che “a volte” torna.',
      'Se il quadro è senza etichette, o se ci sono fili sciolti, bruciature, odore di caldo: fermati e chiama un elettricista.',
      'Un punto nuovo, una linea nuova o una modifica dell’impianto fisso non è un lavoro da chiudere senza dichiarazione di conformità.',
    ],
    notes: [
      note('La sezione del cavo, l’interruttore di protezione e la portata non si ricavano da un numero di punti. Li definisce un abilitato sul carico reale.', 'da verificare in cantiere'),
      note('8 m a punto è solo una stima di percorso quando i metri non sono stati misurati. Va sostituita dal rilievo.', 'regola pratica'),
      note('Riferimento di inquadramento, non una consulenza: DM 37/2008 per gli impianti negli edifici e dichiarazione di conformità dell’impresa abilitata.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Punti', 'ogni punto porta un frutto o una placca da abbinare alla serie esistente', `${points} pz`),
      step('Cavo', measured ? 'metri inseriti da te' : 'metri = punti × 8, stima da buttare appena misuri', `${numIt(meters)} m`),
      step('Tempo indicativo', newPoint ? 'ore = punti × 3,5, solo come ordine di grandezza di un abilitato' : 'ore di smontaggio, verifica e rimontaggio a tensione assente', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('elettrica', 'spegnimento', 'Identificazione e spegnimento', 'Individua il circuito nel quadro. Abbassa il magnetotermico.\nSe non sei certo, abbassa il generale.\nMetti un avviso sul quadro perché nessuno riattivi mentre lavori.', 'togliere tensione quadro elettrico magnetotermico tutorial sicurezza', [
        'Il circuito giusto è aperto, oppure è aperto il generale?',
        'C’è un avviso sul quadro?',
        'Le altre persone in casa sono state avvisate?',
      ]),
      phase('elettrica', 'verifica', 'Verifica assenza di tensione', 'Con uno strumento idoneo controlla che non ci sia tensione sui conduttori del punto.\nControlla anche un punto vicino se il circuito non è etichettato.\nSe non sai fare questa misura, il lavoro si ferma qui.', 'verificare assenza tensione tester prima di aprire presa tutorial', [
        'Lo strumento è stato usato su ogni conduttore?',
        'La lettura è coerente con un circuito aperto?',
        'In caso di dubbio ti sei fermato?',
      ]),
      phase('elettrica', 'ispezione', 'Ispezione a tensione assente', 'Solo a tensione assente, togli la placca e guarda bruciature, morsetti allentati, fili corti.\nNon tirare i conduttori per “fare spazio”.\nFotografa prima di muovere qualsiasi cosa.', 'controllare presa elettrica bruciata a tensione assente', [
        'Hai fotografato prima di muovere i fili?',
        'Non ci sono segni di bruciatura ignorati?',
        'Sei ancora certo che la tensione sia assente?',
      ]),
      phase('elettrica', 'intervento', 'Limite dell’intervento', newPoint
        ? 'Un punto nuovo, una traccia e una linea sono impianto. Li fa un’impresa abilitata, che rilascia la dichiarazione di conformità.\nQui ti fermi alla predisposizione organizzativa: percorsi, foto, materiali da far confermare.\nNon posare un cavo “provvisorio” lasciato in servizio.'
        : 'La sostituzione di un frutto, a tensione assente, va rifatta come lo schema del costruttore di quel frutto e come l’impianto che trovi.\nNon indovinare i colori: negli impianti vecchi possono non seguire la convenzione attuale.\nSe i fili sono corti, anneriti o diversi da come ti aspetti, chiama un elettricista invece di allungarli di fortuna.',
      'quando serve elettricista dichiarazione conformita impianto', [
        'Sei dentro il limite di un punto esistente, a tensione assente?',
        'Se il lavoro è una linea nuova, lo sta facendo un abilitato?',
        'Non hai inventato i collegamenti?',
      ]),
      phase('elettrica', 'ripristino', 'Richiusura e prova', 'Rimonta la placca senza pizzicare i conduttori.\nSolo allora rialimenta il circuito.\nProva la funzione. Se scatta la protezione, rimetti tutto aperto e chiama un abilitato: non insistere.', 'rimontare placca presa dopo aver tolto tensione', [
        'La placca è chiusa senza fili pizzicati?',
        'La protezione non scatta alla prova?',
        'Il quadro è stato lasciato etichettato meglio di come l’hai trovato?',
      ]),
    ],
    checklist: checks('elettrica', [
      'Il lavoro è stato fatto a tensione assente, verificata, non “a occhio”.',
      'Nessun conduttore è rimasto scoperto o pizzicato dalla placca.',
      'La protezione del circuito non scatta senza motivo dopo la prova.',
      'Il quadro è richiuso e, se possibile, il circuito è riconoscibile.',
      'Per linee nuove o modifiche di impianto fisso c’è un abilitato e la dichiarazione di conformità, oppure il lavoro non è stato fatto.',
      'Non restano attrezzi metallici dentro la scatola.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.elettrica, 'La tariffa oraria è un ordine di grandezza da elettricista, modificabile. Non include la dichiarazione di conformità come voce a parte: aggiungila se serve.'),
    areaM2: undefined,
  })
}

function masonryJob(draft: JobDraft): JobBody {
  const work = str(draft.inputs, 'workType', 'intonaco')
  const area = Math.max(0, num(draft.inputs, 'areaM2'))
  const thickness = Math.max(0, num(draft.inputs, 'thicknessCm', 1.5))
  const waste = 0.1
  const isWall = work === 'tramezzo'
  const kg = isWall ? area * 12 * (1 + waste) : area * thickness * 15 * (1 + waste)
  const bags = Math.ceil(kg / 25 - 1e-9)
  const hours = isWall ? area * 0.9 : area * 0.45
  const materials: MaterialLine[] = []
  if (isWall) {
    materials.push(mat('mat:muratura:blocchi', 'Blocchi o forati, fornitura a m² di parete', area * 1.05, 'm²', 22, '5% di sfrido pezzi già compreso sulla quantità', 'Il numero di pezzi si conta sul formato scelto in magazzino. L’app non fissa un blocco.', 'Prezzo a m² indicativo di sola fornitura. Da verificare in cantiere.'))
  }
  materials.push(
    mat(
      'mat:muratura:malta',
      isWall ? 'Malta per giunti di allettamento' : 'Malta per intonaco o ripristino',
      kg,
      'kg',
      PRICE.mortarPerKg,
      `sfrido 10% già compreso, circa ${bags} sacchi da 25 kg`,
      isWall
        ? 'I giunti si vedono in opera. 12 kg/m² è un ordine di grandezza, non una ricetta. Compra i kg oppure i sacchi, non entrambi.'
        : `Ipotesi ${numIt(thickness, 1)} cm × 15 kg/m² per cm. Se il fondo chiede più spessore, ricalcola. I sacchi da 25 kg sono solo l’equivalente, non una seconda fornitura.`,
      `${VERIFY} 15 kg/m² per centimetro è un ordine di grandezza pubblicato per intonaci cementizi. La scheda del sacco comanda.`,
    ),
  )
  const title = work === 'intonaco' ? 'un intonaco' : work === 'ripristino' ? 'un ripristino di muratura' : 'un tramezzo'
  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} il lavoro è ${title}.`,
    currentState: `${numIt(area)} m²${isWall ? '' : `, spessore medio ${numIt(thickness, 1)} cm`}. Malta stimata ${numIt(kg)} kg, circa ${bags} sacchi da 25 kg.`,
    difficulty: isWall ? 'alta' : 'media',
    criticalPoints: [
      'Un intonaco su fondo che suona a vuoto non dura: prima si picchetta ciò che è incoerente.',
      'Lo spessore si misura, non si “riempie finché viene bello”.',
      isWall ? 'Un tramezzo nuovo carica il solaio e può intercettare impianti. Non è un mobile.' : 'Angoli e guide vanno messi prima di tirare la malta, non dopo.',
      'La malta ha un tempo. Non reimpastare con altra acqua ciò che ha già tirato.',
    ],
    tools: ['Mazzuola e scalpello o piccone leggero', 'Cazzuola e frattazzo', 'Staggia e livella', 'Secchio e miscelatore', 'Spugna', 'Guanti'],
    safety: [
      'Occhiali e guanti: schegge e calce irritano.',
      'Non picchiare vicino a tubi e cavi. Cerca gli impianti prima.',
      'Polvere: maschera, e non in una stanza dove altri respirano accanto.',
      'Un tramezzo o una demolizione che interessa la struttura si ferma: serve un tecnico, non solo più malta.',
    ],
    notes: [
      note(isWall ? 'Malta giunti tramezzo: circa 12 kg/m² più 10%, regola pratica. I blocchi sono in m² perché il formato non è stato scelto.' : `Malta intonaco: m² × cm × 15 kg/m²/cm × 1,10. ${VERIFY}`, isWall ? 'regola pratica' : 'scheda tecnica'),
      note(`I kg di malta equivalgono a circa ${bags} sacchi da 25 kg. Nel preventivo è prezzata solo la riga in kg.`, 'regola pratica'),
      note('Umidità di risalita, sali e fondi deboli cambiano il prodotto. Un sacco “universale” non è sempre la risposta.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Malta', isWall ? 'kg = m² × 12 × 1,10' : `kg = m² × ${numIt(thickness, 1)} cm × 15 × 1,10`, `${numIt(kg)} kg`),
      step('Sacchi', 'sacchi = tetto(kg / 25)', `${bags} sacchi da 25 kg`),
      step('Tempo', isWall ? 'ore ≈ m² × 0,9' : 'ore ≈ m² × 0,45', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('muratura', 'demolizione', 'Rimozione del fondo incoerente', 'Picchetta solo ciò che è già distaccato o cavo.\nFermati se compare un ferro strutturale, un tubo, o una crepa che prosegue oltre la zona.\nBagna poco il bordo sano, non annegare il muro.', 'picchettare intonaco distaccato tutorial', [
        'Hai tolto solo le parti incoerenti?',
        'Non sono comparsi impianti o ferri inattesi?',
        'Il bordo rimasto è solido?',
      ]),
      phase('muratura', 'fondo', 'Preparazione', 'Pulisci la polvere.\nBagna il fondo come chiede la malta che hai comprato, di solito senza velo d’acqua.\nMetti guide o riferimenti per lo spessore.', 'bagnare muro prima dell intonaco tutorial', [
        'Il fondo è pulito?',
        'Lo spessore è segnato con riferimenti?',
        'Hai letto l’acqua di impasto sul sacco?',
      ]),
      phase('muratura', 'malta', isWall ? 'Allettamento e posa' : 'Stesura della malta', isWall
        ? 'Posa i corsi a livello, giunti sfalsati, e controlla il piombo spesso.\nNon alzare troppo in un giorno se la malta è ancora morbida.\nLascia i passaggi impianti che hai già tracciato.'
        : 'Stendi entro lo spessore deciso, senza “rinforzare” a caso.\nTira con la staggia.\nNon lisciare aggiungendo acqua in superficie.',
      'stendere intonaco con staggia tutorial', [
        'Lo spessore è quello misurato?',
        'Piombo e piano sono controllati?',
        'Non hai reimpastato malta già tirata?',
      ]),
      phase('muratura', 'stagionatura', 'Stagionatura', 'Proteggi da sole diretto, gelo e asciugatura violenta.\nNon pitturare sopra una malta giovane: i tempi sono sulla scheda.\nLe fessure sottili da ritiro si leggono dopo, non la sera stessa.', 'stagionatura intonaco prima di pitturare', [
        'La malta è protetta da gelo e sole diretto?',
        'Hai annotato i giorni prima di pitturare?',
        'Non ci sono distacchi nuovi?',
      ]),
    ],
    checklist: checks('muratura', [
      'Il piano è continuo, senza orecchie di malta.',
      'Non suona a vuoto nella zona appena rifatta.',
      'Gli spigoli, se previsti, sono dritti.',
      'I tempi prima di pitturare o piastrellare sono stati rispettati.',
      'Gli impianti incontrati sono stati sistemati, non murati alla cieca.',
      'La stanza è stata pulita dalla polvere di demolizione.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.muratura, LABOR_NOTE),
    areaM2: area,
  })
}

function roofJob(draft: JobDraft): JobBody {
  const work = str(draft.inputs, 'workType', 'ispezione')
  const area = Math.max(0, num(draft.inputs, 'areaM2'))
  const broken = Math.max(0, Math.round(num(draft.inputs, 'brokenTiles')))
  const gutter = Math.max(0, num(draft.inputs, 'gutterM'))
  const tiles = broken > 0 ? Math.ceil(broken * 1.15 - 1e-9) : 0
  const hangers = gutter > 0 ? Math.ceil(gutter / 0.8 - 1e-9) : 0
  const hours = work === 'grondaie' ? Math.max(2, gutter / 4) : work === 'tegole' ? Math.max(2, tiles * 0.35 + area / 30) : Math.max(1.5, area / 25)
  const materials: MaterialLine[] = []
  if (work === 'tegole' && tiles > 0) {
    materials.push(mat('mat:tetti:tegole', 'Tegole di ricambio, stesso tipo di quelle in opera', tiles, 'pz', PRICE.tileRoof, '15% in più sulle rotte contate, per i pezzi che si spezzano in smontaggio', 'Porta un campione. Forma, colore e passo non si indovinano da una foto lontana.', 'Prezzo indicativo di una tegola generica. Da verificare in cantiere.'))
  }
  if (work === 'grondaie' && gutter > 0) {
    materials.push(
      mat('mat:tetti:gronda', 'Canale di gronda, sviluppo misurato', gutter, 'm', PRICE.gutterPerM, 'senza sfrido di angoli: conta gli angoli a parte in negozio', 'Misura anche pluviali e angoli, non solo il tratto dritto.', 'Prezzo al metro indicativo, materiale non scelto. Da verificare in cantiere.'),
      mat('mat:tetti:staffe', 'Staffe di gronda', hangers, 'pz', PRICE.gutterHanger, 'una ogni 80 cm circa', 'Il passo si adatta anche al vento e al materiale del canale.', 'Regola pratica.'),
    )
  }
  const difficulty: Difficulty = work === 'ispezione' ? 'alta' : 'critica'
  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} l’intervento in copertura è limitato e parte dalla sicurezza, non dalla tegola.`,
    currentState: work === 'grondaie'
      ? `Grondaia ${numIt(gutter)} m, circa ${hangers} staffe.`
      : work === 'tegole'
        ? `Tegole rotte contate: ${broken}. Ordine con scorta: ${tiles}. Falda indicata: ${numIt(area)} m².`
        : `Ispezione su ${numIt(area)} m², da un punto che non chiede di camminare sulla falda.`,
    difficulty,
    criticalPoints: [
      'Senza parapetto, linea vita o un sistema anticaduta che sai usare, non si sale sulla falda.',
      'Coperture in cemento-amianto non si tagliano, non si spazzolano, non si demoliscono in proprio. Se sospetti amianto, ti fermi.',
      'Una tegola rotta può essere il sintomo di un’orditura marcia. Se il piano flette, non è più un ricambio.',
      'Grondaie e scale: lontano da linee elettriche aeree, scala legata, terreno fermo.',
    ],
    tools: ['Scala idonea e legata', 'Imbrago solo se il sistema è reale e sai usarlo', 'Guanti', 'Contenitore per i detriti', 'Macchina fotografica', 'Non una smerigliatrice “per sistemare l’eternit”'],
    safety: [
      'Il rischio principale è la caduta, non la tegola. Se non hai un sistema anticaduta, il lavoro in falda non si inizia.',
      'Non camminare su coppi bagnati, muschio o lastre che non conosci.',
      'Scala: appoggio stabile, inclinazione corretta, tre punti di contatto, una persona a terra se serve.',
      'Amianto: stop. Si chiama un’impresa autorizzata, non si “bagna e si taglia”.',
      'Non lavorare con vento, pioggia o vicino a linee elettriche.',
    ],
    notes: [
      note('Scorta tegole: pezzi = tetto(rotte × 1,15). È uno sfrido di maneggio, non una resa.', 'regola pratica'),
      note('Staffe di gronda: circa una ogni 0,80 m. Angoli e pluviali non sono inclusi nel metro lineare.', 'regola pratica'),
      note('Lo stato dell’orditura, la presenza di amianto e il sistema anticaduta si giudicano sul posto, non dalla quantità.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Tegole', broken > 0 ? 'pezzi = tetto(rotte × 1,15)' : 'Nessun conteggio: conta i pezzi rotti sul posto', tiles > 0 ? `${tiles} pz` : '0'),
      step('Grondaia', gutter > 0 ? 'staffe = tetto(metri / 0,80)' : 'Non è il lavoro scelto, oppure i metri sono 0', hangers > 0 ? `${hangers} staffe` : '0'),
      step('Tempo', 'ore minime di sicurezza comprese, non un tempo di “giro veloce in falda”', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('tetti', 'rischio', 'Decisione di salire o no', 'Guarda da terra o da un punto già sicuro: abbaini, finestre, trabattello in piano se la quota è davvero bassa e stabile.\nSe per vedere il difetto devi camminare sulla falda e non hai anticaduta, il fascicolo si chiude qui e chiami un’impresa.\nCerca anche i segni dell’amianto: lastre ondulate grigie vecchie non si toccano.', 'sicurezza lavori in quota copertura cadute tutorial', [
        'Puoi vedere il difetto senza camminare sulla falda?',
        'Se devi salire, c’è un sistema anticaduta vero?',
        'Hai escluso il sospetto amianto?',
      ]),
      phase('tetti', 'ispezione', 'Ispezione', 'Fotografa tegole spostate, converse, camini e gronde intasate.\nSegna se l’acqua entra sempre nello stesso punto interno: quello è il punto da inseguire.\nNon spostare tegole “per vedere sotto” se non sei in sicurezza.', 'ispezione tetto da punto sicuro infiltrazione', [
        'Le foto mostrano il punto, non solo la falda intera?',
        'Hai collegato la macchia interna al punto esterno?',
        'Non hai camminato su un piano che flette?',
      ]),
      phase('tetti', 'intervento', 'Intervento solo se è ancora piccolo', work === 'grondaie'
        ? 'Pulisci la gronda da una posizione stabile. Sostituisci solo i tratti che hai misurato.\nGli angoli e i pluviali si comprano dopo averli contati.\nSe la gronda è in quota e senza protezione, la pulizia non è “un’oretta in scala”.'
        : 'Sostituisci solo le tegole già rotte, agganciandole come quelle vicine, e solo da una posizione sicura.\nSe sotto manca il listello o il piano cede, ti fermi.\nNon sigillare una conversa con un silicone a caso sperando che tenga l’inverno.',
      'sostituire tegola rotta oppure pulire grondaia in sicurezza', [
        'Sei ancora nella condizione sicura del primo passo?',
        'Il pezzo nuovo è uguale a quelli in opera?',
        'Sotto la tegola il supporto è sano?',
      ]),
      phase('tetti', 'deflusso', 'Controllo del deflusso', 'Alla prima pioggia, o con un getto controllato se non allaga l’interno, verifica che l’acqua prenda la gronda e non rientri dal bordo.\nRicontrolla la macchia interna a distanza di ore, non solo subito.\nAnnota cosa è stato sostituito.', 'controllo grondaia dopo pulizia deflusso acqua', [
        'L’acqua esce dal pluviale e non trabocca?',
        'La macchia interna non cresce?',
        'Hai scritto cosa è stato cambiato?',
      ]),
    ],
    checklist: checks('tetti', [
      'Nessuno è salito in falda senza un sistema anticaduta adeguato.',
      'Il sospetto amianto, se c’era, ha fermato il lavoro.',
      'Le tegole sostituite sono dello stesso tipo e stanno in sede.',
      'La gronda, se era il lavoro, scarica senza traboccare.',
      'La macchia interna è stata ricontrollata dopo, non solo a lavoro appena finito.',
      'Se il supporto era marcio o la lamiera strutturale cedeva, è stata chiamata un’impresa.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.tetti, 'Tempo e tariffa includono la prudenza, non un “salire e scendere”. Modificabili. Se il lavoro diventa impresa specializzata, il prezzo a corpo sostituisce queste ore.'),
    areaM2: area || undefined,
  })
}

function gardenJob(draft: JobDraft): JobBody {
  const work = str(draft.inputs, 'workType', 'prato')
  const area = Math.max(0, num(draft.inputs, 'areaM2'))
  const linear = Math.max(0, num(draft.inputs, 'linearM'))
  const materials: MaterialLine[] = []
  let hours = 2
  let state = ''
  if (work === 'prato') {
    const seed = area * 0.035 * 1.1
    const soil = area * 0.02
    hours = Math.max(2, area / 20)
    state = `Prato ${numIt(area)} m². Seme circa ${numIt(seed)} kg, terriccio di riporto circa ${numIt(soil, 2)} m³ se porti 2 cm.`
    materials.push(
      mat('mat:giardino:seme', 'Seme per prato, miscuglio da scegliere sul clima', seed, 'kg', PRICE.seedPerKg, '10% in più sui 35 g/m²', '35 g/m² è un ordine di grandezza. La confezione del miscuglio può dire 25–40 g/m².', `${VERIFY} Dose usata: 35 g/m².`),
      mat('mat:giardino:terriccio', 'Terriccio o sabbia di riporto, 2 cm', soil, 'm³', PRICE.soilPerM3, 'spessore assunto 2 cm, non un riporto strutturale', 'Se il terreno è già buono, porta la quantità verso lo zero.', 'Regola pratica. Da verificare in cantiere.'),
    )
  } else if (work === 'aiuole') {
    const soil = area * 0.05
    hours = Math.max(2, area / 8)
    state = `Aiuole ${numIt(area)} m², riporto assunto 5 cm = ${numIt(soil, 2)} m³.`
    materials.push(mat('mat:giardino:terriccio', 'Terriccio per aiuole, 5 cm', soil, 'm³', PRICE.soilPerM3, 'spessore assunto, modificabile', 'Misura lo spessore che vuoi davvero. Le piante non sono conteggiate: dipendono dalla specie.', 'Regola pratica.'))
  } else if (work === 'irrigazione') {
    hours = Math.max(2, linear / 12)
    state = `Ala gocciolante ${numIt(linear)} m, più 10% di sfrido.`
    materials.push(
      mat('mat:giardino:ala', 'Ala gocciolante', linear * 1.1, 'm', PRICE.dripPerM, 'sfrido 10% già compreso', 'Misura le file reali, non il perimetro del giardino se non è quello il percorso.', 'Da verificare in cantiere sul passo dei gocciolatori.'),
      mat('mat:giardino:raccordi', 'Kit minimo di raccordi e tappi', 1, 'kit', 14, 'un kit di partenza, aggiungi gomiti se il percorso gira', 'Conta i gomiti sul disegno del tubo, non a memoria.', 'Prezzo indicativo di minuteria generica.'),
    )
  } else {
    const plants = Math.round(linear * 3)
    hours = Math.max(2, linear / 6)
    state = `Siepe ${numIt(linear)} m. Ipotesi 3 piante a metro = ${plants} piante. Il sesto reale è sulla specie.`
    materials.push(mat('mat:giardino:piante', 'Piante da siepe, specie da scegliere', plants, 'pz', 4.5, 'sesto assunto 3 a metro, senza scorta', 'Leggi il sesto sulla scheda della specie. Aggiorna prezzo e quantità.', 'Prezzo di una pianta generica, modificabile. Da verificare in cantiere.'))
  }
  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} il lavoro di giardino è stato ridotto a misure, non a un progetto botanico.`,
    currentState: state,
    difficulty: work === 'irrigazione' ? 'media' : 'bassa',
    criticalPoints: [
      'Prima di scavare, anche 30 cm, verifica che non ci siano cavi, tubi o irrigazioni già interrate.',
      'Il seme senza acqua nei primi giorni non nasce. Programma l’acqua prima di seminare.',
      'Non portare terra contro il muro della casa: tieni il giardino più basso del piano interno.',
      'Una siepe al confine ha distanze da rispettare. Non è solo un gusto.',
    ],
    tools: ['Vanga e rastrello', 'Rullo o tavola per il seme', 'Metro', 'Guanti', 'Tubo dell’acqua'],
    safety: [
      'Chiama o verifica i sottoservizi prima di piantare paletti e di scavare.',
      'Occhiali se usi un decespugliatore. I sassi partono.',
      'Non lasciare buche aperte se in casa passano altri.',
      'Prodotti fitosanitari: solo se sai cosa sono e come smaltirli. Questo fascicolo non ne prescrive.',
    ],
    notes: [
      note('Prato: 35 g/m² di seme più 10%. È un consumo di riferimento, la bustina del miscuglio comanda.', 'scheda tecnica'),
      note('2 cm di riporto sul prato e 5 cm in aiuola sono ipotesi di spessore, facili da cambiare moltiplicando i m³.', 'regola pratica'),
      note('Specie, esposizione e distanze dal confine non si calcolano dai metri quadri.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Misura guida', work === 'irrigazione' || work === 'siepi' ? 'metri lineari inseriti' : 'm² inseriti', work === 'irrigazione' || work === 'siepi' ? `${numIt(linear)} m` : `${numIt(area)} m²`),
      step('Quantità principale', work === 'prato' ? 'kg seme = m² × 0,035 × 1,10' : work === 'siepi' ? 'piante = metri × 3' : work === 'irrigazione' ? 'm = metri × 1,10' : 'm³ = m² × 0,05', materials[0] ? `${qtyLabel(materials[0])}` : '0'),
      step('Tempo', 'ore a ritmo ordinario, terreno già accessibile', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('giardino', 'rilievo', 'Rilievo e sottoservizi', 'Segna la zona e le quote verso la casa.\nPrima di scavare controlla botole, pozzetti e ogni segno di impianto interrato.\nNon accumulare terra contro l’intonaco esterno.', 'prima di scavare in giardino sottoservizi', [
        'Hai escluso cavi e tubi nella zona di scavo?',
        'Il terreno resta più basso del piano di casa?',
        'La zona è misurata, non stimata a passi?',
      ]),
      phase('giardino', 'preparazione', 'Preparazione', 'Togli erbacce grosse e sassi in superficie.\nLivella senza creare una conca contro il muro.\nSe porti terriccio, fallo nello spessore che hai deciso, non “finché sembra tanto”.', 'preparare terreno prato o aiuola tutorial', [
        'Il piano è livellato?',
        'Lo spessore del riporto è quello del calcolo?',
        'Non hai coperto pozzetti o scarichi?',
      ]),
      phase('giardino', 'opera', 'Esecuzione', work === 'prato'
        ? 'Semina incrociando due passate, poi rastrello leggero e una pressione uniforme.\nLa dose è quella della bustina se è diversa dai 35 g/m².\nBagna a pioggia fine, senza ruscellare il seme.'
        : work === 'irrigazione'
          ? 'Stendi l’ala senza strozzature e fissa il percorso. I raccordi si stringono a mano quanto chiede il pezzo, senza spanare.\nProva l’acqua prima di coprire qualsiasi tratto.\nNon collegare di fortuna a un tubo interrato che non conosci.'
          : 'Metti a dimora secondo il sesto della specie, non secondo il numero tondo del fascicolo se la scheda dice altro.\nInnaffia all’impianto.\nLascia il colletto fuori, non sotterrato.',
      'semina prato oppure ala gocciolante tutorial', [
        'La dose o il sesto seguono la scheda del prodotto o della pianta?',
        'L’acqua non ruscella via il lavoro appena fatto?',
        'I raccordi, se ci sono, sono stati provati scoperti?',
      ]),
      phase('giardino', 'acqua', 'Acqua di assestamento', 'I primi giorni il prato nuovo non deve seccare né restare una pozza.\nLe piante nuove si controllano al colletto: né secco né marcio.\nSegna cosa hai seminato o piantato, marca inclusa.', 'irrigazione prato appena seminato', [
        'Il terreno è umido e non allagato?',
        'Il seme non è stato lavato in un angolo?',
        'Hai annotato miscuglio o specie?',
      ]),
    ],
    checklist: checks('giardino', [
      'Nessuno scavo è stato fatto sopra un impianto sconosciuto.',
      'La quota del giardino non supera il piano interno della casa.',
      'Seme, terriccio o piante corrispondono a ciò che hai davvero comprato.',
      'L’irrigazione, se c’è, è stata provata prima di coprirla.',
      'Le nuove piante hanno il colletto fuori terra.',
      'Gli attrezzi e i sacchi vuoti sono stati tolti.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.giardino, LABOR_NOTE),
    areaM2: area || undefined,
  })
}

function qtyLabel(line: MaterialLine): string {
  return `${numIt(line.quantity)} ${line.unit}`
}

function climateJob(draft: JobDraft): JobBody {
  const splits = Math.max(1, Math.round(num(draft.inputs, 'splits', 1)))
  const rooms = Math.max(1, Math.round(num(draft.inputs, 'rooms', 1)))
  const pipes = Math.max(0, num(draft.inputs, 'pipeMeters', 4))
  const drain = splits * 3
  const hours = splits * 5
  const materials: MaterialLine[] = [
    mat('mat:clima:staffe', 'Staffe per unità esterna o interna, coppia di supporto', splits * 2, 'pz', PRICE.bracket, 'due staffe a macchina, ipotesi semplice', 'Il tipo di staffa dipende da parete, balcone o tetto. Falla vedere a chi installa.', 'Prezzo indicativo di una staffa generica.'),
    mat('mat:clima:canalina', 'Canalina di copertura del percorso', pipes, 'm', PRICE.trunkingPerM, 'metri che hai inserito, senza pezzi speciali', 'Aggiungi curve e tappi quando vedi gli angoli. Non sono nel metro lineare.', 'Da verificare in cantiere.'),
    mat('mat:clima:condensa', 'Tubo di scarico condensa', drain, 'm', 1.4, 'stima 3 m a unità, solo discesa', 'Lo scarico condensa va in discesa continua, verso un punto che può riceverla. Non in un vaso.', 'Regola pratica. Da verificare in cantiere.'),
  ]
  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} si predispone un clima split. La carica del refrigerante non fa parte del lavoro descrivibile qui.`,
    currentState: `${splits} unità interne, ${rooms} locali, percorso canalina ${numIt(pipes)} m, scarico condensa stimato ${drain} m.`,
    difficulty: 'alta',
    criticalPoints: [
      'Vuoto, carica e manipolazione del refrigerante sono riservati a tecnici certificati F-gas. Non si “rabbocca” un split in proprio.',
      'Lo scarico condensa in salita non funziona: o scende, o serve una pompa scelta da chi installa.',
      'L’unità esterna ha bisogno di aria e di un supporto che regga peso e vibrazioni, non di una mensola decorativa.',
      'Il collegamento elettrico dedicato si fa a tensione assente e, se è una nuova linea, da un abilitato.',
    ],
    tools: ['Trapano con punte adatte', 'Livella', 'Metro', 'Scala stabile', 'Non un manometro “per provare il gas”'],
    safety: [
      'Non aprire le valvole del circuito frigorifero e non tagliare i tubi di un impianto già caricato.',
      'Fori su facciata: verifica cosa attraversi e se il condominio o il vincolo lo consentono.',
      'Scala e parapetto per l’unità esterna. Non sporgerti dal balcone con la macchina in mano.',
      'Elettricità: stessa regola del fascicolo elettrico, tensione assente e verifica, oppure elettricista.',
    ],
    notes: [
      note('I metri di canalina sono quelli inseriti. Curve e staffe speciali non sono nel prezzo al metro.', 'da verificare in cantiere'),
      note('3 m di scarico condensa a unità è una stima per arrivare a una discesa. Il percorso reale comanda.', 'regola pratica'),
      note('La scelta della potenza e il regolamento europeo sui gas fluorurati si applicano al modello e a chi lo mette in servizio, non a questo calcolo.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Staffe', 'pezzi = unità × 2', `${splits * 2} pz`),
      step('Canalina', 'metri inseriti', `${numIt(pipes)} m`),
      step('Condensa', 'metri = unità × 3', `${drain} m`),
      step('Tempo', 'ore = unità × 5, ordine di grandezza di installazione, senza presentare la carica come fai-da-te', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('climatizzazione', 'posizione', 'Posizione', 'Scegli l’unità interna lontano da ostacoli e da un getto diretto sul letto o sulla scrivania.\nL’esterna deve respirare e non scaricare sul vicino.\nDecidi dove va la condensa prima di forare.', 'dove installare split posizione unita esterna tutorial', [
        'La condensa ha una discesa reale?',
        'L’esterna ha aria libera e un supporto credibile?',
        'Il foro non attraversa un impianto o un punto vietato?',
      ]),
      phase('climatizzazione', 'staffaggio', 'Staffaggio', 'Segna e fissa le staffe nel supporto vero, non nel solo cappotto.\nControlla il livello.\nNon appendere la macchina finché i tasselli non sono quelli giusti per quel muro.', 'staffare unita esterna condizionatore tutorial', [
        'I tasselli sono adatti al muro che hai trovato?',
        'La staffa è in bolla?',
        'Il peso non è affidato al solo isolamento a cappotto?',
      ]),
      phase('climatizzazione', 'percorso', 'Canalina e scarico', 'Traccia il percorso più corto e con curve larghe.\nLo scarico condensa scende sempre.\nI tubi frigoriferi, se li prepari, non si piegano a gomito: ma il circuito lo chiude il tecnico certificato.', 'canalina condizionatore scarico condensa in pendenza', [
        'La condensa scende in ogni tratto?',
        'Le curve della canalina sono larghe?',
        'Non hai aperto un circuito già caricato?',
      ]),
      phase('climatizzazione', 'elettrico', 'Elettricità', 'Una presa dedicata o una linea nuova si valutano sul carico.\nTensione assente e verifica, come per ogni punto elettrico.\nSe serve una linea nuova, è lavoro da dichiarazione di conformità.', 'linea dedicata condizionatore elettricista', [
        'La tensione è stata tolta e verificata prima di qualsiasi collegamento?',
        'La linea è adeguata, secondo un abilitato?',
        'Non hai usato una ciabatta come soluzione definitiva?',
      ]),
      phase('climatizzazione', 'avviamento', 'Avviamento', 'Vuoto, tenuta e carica li fa il tecnico certificato.\nTu puoi controllare che la condensa esca dove deve e che non vibri tutto il balcone.\nConserva il libretto dell’intervento.', 'avviamento split solo tecnico certificato f-gas', [
        'La carica è stata fatta da un certificato, oppure non è stata fatta?',
        'La condensa scarica davvero?',
        'Vibrazioni e staffe sono state ricontrollate a macchina accesa dal tecnico?',
      ]),
    ],
    checklist: checks('climatizzazione', [
      'Nessuna valvola del circuito frigorifero è stata aperta da personale non certificato.',
      'Lo scarico condensa è in discesa e non gocciola nel muro.',
      'Le staffe sono nel supporto strutturale, in bolla.',
      'L’alimentazione elettrica è dedicata e fatta in sicurezza.',
      'Il libretto o il rapporto del tecnico è stato conservato.',
      'Interna ed esterna non sono ostruite da mobili o coperture chiuse.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.climatizzazione, 'Le ore sono un ordine di grandezza di installazione. La certificazione F-gas e l’eventuale dichiarazione elettrica non sono nascoste dentro il tubo della canalina: concordale a parte.'),
    areaM2: undefined,
  })
}

function woodJob(draft: JobDraft): JobBody {
  const work = str(draft.inputs, 'workType', 'porta')
  const pieces = Math.max(1, Math.round(num(draft.inputs, 'pieces', 1)))
  const width = num(draft.inputs, 'widthCm', 80)
  const height = num(draft.inputs, 'heightCm', 210)
  const hinges = work === 'porta' ? pieces * 3 : work === 'mensola' ? pieces * 2 : pieces * 2
  const hingeName = work === 'mensola' ? 'Reggimensola' : 'Cerniere'
  const hours = pieces * (work === 'porta' ? 2.8 : 2)
  const materials: MaterialLine[] = [
    mat('mat:falegnameria:ferramenta', hingeName, hinges, 'pz', work === 'mensola' ? 2.5 : PRICE.hinge, work === 'porta' ? 'tre cerniere a porta, ipotesi ordinaria' : 'due pezzi a elemento', 'Controlla il diametro della sede e il senso di apertura prima di comprare.', 'Prezzo di ferramenta generica. Da verificare in cantiere.'),
    mat('mat:falegnameria:viti', 'Viti e minuteria', Math.max(1, Math.ceil(pieces / 3)), 'scatole', PRICE.screwBoxSmall, 'una scatola ogni 3 pezzi circa', 'La lunghezza della vite deve entrare nel supporto, non solo nell’impiallacciatura.', 'Regola pratica.'),
    mat('mat:falegnameria:carta', 'Carta abrasiva', pieces * 4, 'fogli', PRICE.sheetSand, 'quattro fogli a pezzo, grane da alternare', 'Parti dalla grana che serve, non dalla più grossa per abitudine.', 'Regola pratica.'),
  ]
  if (work === 'ripristino') {
    materials.push(mat('mat:falegnameria:stucco', 'Stucco per legno', Math.max(0.25, pieces * 0.2), 'kg', 6, 'stima per scheggiature, non per ricostruire un montante', 'Il colore si prova su un angolo nascosto.', 'Da verificare in cantiere.'))
  }
  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} il lavoro di falegnameria parte dal rilievo del pezzo, non dal taglio.`,
    currentState: `${pieces} ${pieces === 1 ? 'pezzo' : 'pezzi'}, tipo ${work}, luce o ingombro ${numIt(width, 0)}×${numIt(height, 0)} cm.`,
    difficulty: work === 'porta' ? 'media' : 'bassa',
    criticalPoints: [
      'Misura in più punti: larghezza alta, centro e bassa. I vani non sono rettangoli.',
      'Una porta che striscia spesso ha il telaio fuori squadra o le cerniere consumate, non “bisogno di pialla a caso”.',
      'Il senso di apertura si decide prima della ferramenta.',
      'Non tagliare il telaio murato per far entrare un’anta: prima capisci il fuorisquadra.',
    ],
    tools: ['Metro e squadra', 'Cacciavite e avvitatore', 'Pialla o carta', 'Cunei', 'Matita'],
    safety: [
      'Utensili da taglio: pezzo fermo, mani fuori dalla linea, occhiali.',
      'Una porta è pesante. Due persone se l’anta è piena.',
      'Non lavorare sotto un’anta sorretta solo dal ginocchio.',
      'Polvere di carteggiatura: maschera, specie su vernici vecchie.',
    ],
    notes: [
      note('Tre cerniere per una porta ordinaria e due per un’anta sono una regola pratica, non una scheda del produttore dell’anta.', 'regola pratica'),
      note('Le misure del fascicolo sono quelle che hai inserito. Il taglio, se serve, si fa sulla misura minima del vano meno il gioco.', 'da verificare in cantiere'),
      note('Gioco tipico di una porta interna spesso nell’ordine di pochi millimetri per lato: si legge sul posto, non si fissa qui al millimetro.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Ferramenta', work === 'porta' ? 'cerniere = pezzi × 3' : 'pezzi ferramenta = elementi × 2', `${hinges} pz`),
      step('Ingombro inserito', 'larghezza × altezza dichiarate', `${numIt(width, 0)} × ${numIt(height, 0)} cm`),
      step('Tempo', work === 'porta' ? 'ore = pezzi × 2,8' : 'ore = pezzi × 2', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('falegnameria', 'rilievo', 'Rilievo', 'Misura il vano in tre altezze e tre larghezze, e le diagonali.\nSegna il verso di apertura e gli ostacoli: interruttori, battiscopa, piastrelle.\nScrivi i numeri sul posto, non a memoria in cucina.', 'come misurare vano porta tutorial', [
        'Hai le tre larghezze e le diagonali?',
        'Il senso di apertura è deciso?',
        'Gli ostacoli sono segnati?',
      ]),
      phase('falegnameria', 'smontaggio', 'Smontaggio', 'Sostieni l’anta prima di togliere i perni.\nAppoggiala in piano, non contro un calorifero.\nConserva le viti vecchie solo se sono ancora intere: di solito si cambiano.', 'smontare anta porta cerniere tutorial', [
        'L’anta era sostenuta prima di levare i perni?',
        'Le viti spanate sono state scartate?',
        'Hai segnato alto e basso?',
      ]),
      phase('falegnameria', 'adattamento', 'Adattamento', 'Pialla o carteggia solo il materiale che avanza rispetto al rilievo, un poco per volta.\nProva nel vano più volte.\nNon togliere materiale dal lato delle cerniere se il problema è il telaio.', 'registrare porta che striscia tutorial', [
        'Stai togliendo materiale dal lato giusto?',
        'Hai riprovato nel vano prima di toglierne altro?',
        'Le cerniere sono ancora in sede sana?',
      ]),
      phase('falegnameria', 'ferramenta', 'Ferramenta e registro', 'Monta cerniere o reggimensola nelle sedi, viti della lunghezza giusta.\nRegistra finché il gioco è simile sui lati e l’anta non si apre da sola.\nStringi senza spanare il legno.', 'montare cerniere porta interna tutorial', [
        'Le viti mordono legno sano?',
        'Il gioco sui lati è regolare?',
        'L’anta resta dove la lasci?',
      ]),
      phase('falegnameria', 'finitura', 'Finitura', 'Carteggia la ripresa e rifinisci solo la zona toccata, oppure tutto il fronte se il colore non torna.\nProva il colore su un bordo nascosto.\nRimonta maniglie e controlla la chiusura.', 'carteggiare e ritoccare porta legno tutorial', [
        'Il ritocco è stato provato in un punto nascosto?',
        'La maniglia chiude senza forzare?',
        'Non restano viti che sporgono?',
      ]),
    ],
    checklist: checks('falegnameria', [
      'L’anta non striscia a terra né sullo stipite.',
      'I giochi sono simili e la chiusura torna.',
      'Le cerniere e le viti sono in legno sano.',
      'Il senso di apertura è quello deciso in rilievo.',
      'La finitura di ritocco non stona in modo evidente, oppure è stata rifatta tutta la faccia.',
      'Il vano è pulito da trucioli e polvere.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.falegnameria, LABOR_NOTE),
    areaM2: undefined,
  })
}

function careJob(draft: JobDraft): JobBody {
  const focus = str(draft.inputs, 'focus', 'generale')
  const rooms = Math.max(1, Math.round(num(draft.inputs, 'rooms', 3)))
  const silicone = focus === 'infissi' ? Math.max(1, Math.ceil(rooms / 2)) : 1
  const hours = rooms * 0.7 + (focus === 'umidita' ? 1.5 : 0.8)
  const focusLabel: Record<string, string> = {
    generale: 'un giro generale della casa',
    umidita: 'un controllo di umidità e ventilazione',
    infissi: 'un giro su infissi e sigillature',
    stagionale: 'un controllo stagionale',
  }
  const materials: MaterialLine[] = [
    mat('mat:manutenzione:silicone', 'Silicone neutro', silicone, 'cartucce', PRICE.neutralSilicone, focus === 'infissi' ? 'una cartuccia ogni due locali circa' : 'una cartuccia di dotazione', 'Il silicone acetico macchia alcune pietre. In dubbio, neutro, e prova.', 'Da verificare in cantiere.'),
    mat('mat:manutenzione:ptfe', 'Nastro PTFE', 1, 'rotoli', PRICE.ptfe, 'dotazione, non un consumo calcolato', 'Serve se trovi un filetto che piange. Prima chiudi l’acqua.', 'Regola pratica.'),
    mat('mat:manutenzione:lampade', 'Lampade di ricambio', rooms, 'pz', PRICE.lamp, 'una a locale, attacco da copiare dalla vecchia', 'Leggi attacco e lumen sulla lampada tolta, a corrente tolta.', 'Prezzo indicativo.'),
    mat('mat:manutenzione:stucco', 'Stucco leggero per piccoli buchi', 0.5, 'kg', PRICE.fillerKg, 'dotazione per fori di tassello, non per crepe strutturali', 'Una crepa che prosegue o che si rivede ogni anno non è un foro di quadro.', 'Regola pratica.'),
  ]
  return pack(draft, {
    problem: `Dal testo ${quoted(draft)} la manutenzione è ${focusLabel[focus] ?? 'un giro di casa'}, con l’ordine di non trasformare ogni segno in un cantiere.`,
    currentState: `${rooms} locali. Focus: ${focusLabel[focus] ?? focus}.`,
    difficulty: focus === 'umidita' ? 'media' : 'bassa',
    criticalPoints: [
      'Una macchia di umidità si insegue fino alla causa. Coprirla è il modo di rivederla.',
      'Prima di forare o di smontare una placca: impianti. Prima di una lampada: tensione tolta.',
      'Il silicone sopra il silicone vecchio staccato non tiene. Si toglie il vecchio.',
      'Se senti odore di gas, non è una voce di checklist: si chiude il rubinetto, si arieggia, si esce e si chiama il pronto intervento.',
    ],
    tools: ['Scala stabile', 'Cacciavite', 'Pistola per silicone', 'Torcia', 'Straccio', 'Metro', 'Taccuino'],
    safety: [
      'Scala in piano, niente sedie.',
      'Elettricità delle lampade: interruttore aperto e, se smonti il portalampada, tensione tolta e verificata.',
      'Odore di gas: stop, rubinetto, aria, fuori, numero di pronto intervento. Non cercare la perdita con una fiamma.',
      'Muffa estesa: maschera, e prima la causa (aria, ponte, perdita), non solo la candeggina.',
    ],
    notes: [
      note('Le quantità di questa manutenzione sono dotazioni, non rese di scheda. Si alzano se il giro trova più difetti.', 'regola pratica'),
      note('Una cartuccia di silicone copre molti metri di giunto sottile, ma il vecchio sigillante va rimosso. Il metro reale si vede sull’infisso.', 'da verificare in cantiere'),
      note('Umidità: senza capire se è condensa, infiltrazione o perdita, il materiale del fascicolo non risolve.', 'da verificare in cantiere'),
    ],
    materials,
    calcSteps: [
      step('Locali', 'ogni locale è un punto del giro e una lampada di scorta possibile', `${rooms}`),
      step('Silicone', focus === 'infissi' ? 'cartucce = tetto(locali / 2)' : 'una cartuccia di dotazione', `${silicone} cartucce`),
      step('Tempo', 'ore ≈ locali × 0,7 più un fisso per il focus', `${numIt(hours, 1)} h`),
    ],
    phases: [
      phase('manutenzione', 'giro', 'Giro di ispezione', 'Stanza per stanza: macchie, infissi, rubinetti, prese calde, scarichi lenti, lampade.\nScrivi, non fidarti della memoria.\nQuello che è strutturale o puzza di gas esce da questa lista.', 'checklist ispezione manutenzione casa', [
        'Hai guardato anche soffitti e sotto i lavabi?',
        'Hai scritto i difetti?',
        'Gas, scintille o crepe grosse ti hanno fatto fermare?',
      ]),
      phase('manutenzione', 'piccoli', 'Piccoli interventi', 'Stucca solo fori piccoli su fondo sano.\nCambia le lampade a corrente tolta se apri il punto.\nNon allargare il lavoro a una demolizione “già che ci sei”.', 'piccole riparazioni casa stucco e lampade', [
        'I fori stuccati sono davvero piccoli e su fondo sano?',
        'Le lampade sono state sostituite in sicurezza?',
        'Non hai aperto un cantiere più grande senza un fascicolo dedicato?',
      ]),
      phase('manutenzione', 'infissi', 'Infissi e sigilli', 'Togli il silicone vecchio staccato.\nPulisci, asciuga, poi stendi il nuovo in un cordolo continuo.\nControlla che l’anta chiuda e che i fori di scarico dell’infisso non siano tappati dal silicone.', 'sostituire silicone finestre tutorial', [
        'Il vecchio sigillante è stato tolto?',
        'Il cordolo nuovo è continuo?',
        'Gli scarichi dell’infisso sono aperti?',
      ]),
      phase('manutenzione', 'umidita', 'Umidità e aria', 'Segna se la macchia è fredda, se compare dopo la doccia, o se è sempre bagnata.\nArieggia e controlla le estrazioni del bagno.\nSe la macchia viene da un tubo o dal tetto, apri il fascicolo di quel mestiere invece di pitturare.', 'capire muffa condensa o infiltrazione', [
        'Hai distinto condensa, perdita e infiltrazione, almeno come ipotesi scritta?',
        'Le estrazioni funzionano?',
        'Non hai coperto una perdita attiva?',
      ]),
      phase('manutenzione', 'chiusura', 'Chiusura del giro', 'Rileggi la lista e segna cosa è fatto, cosa è rinviato e cosa chiede un altro mestiere.\nRimuovi scala e materiali.\nUna foto del prima e del dopo vale più di una frase generica.', 'report fine manutenzione casa', [
        'Ogni voce è fatta, rinviata o passata a un altro fascicolo?',
        'La casa è stata lasciata sicura (scala tolta, acqua aperta solo dove deve)?',
        'Hai le foto dei punti critici?',
      ]),
    ],
    checklist: checks('manutenzione', [
      'Ogni locale previsto è stato visto, soffitto incluso.',
      'Non ci sono sigillature nuove sopra sigillante già staccato.',
      'Le lampade sostituite sono fredde e dell’attacco giusto.',
      'Rubinetti e sifoni visibili non gocciolano.',
      'Le macchie di umidità hanno una causa scritta, oppure un rinvio esplicito.',
      'Gas, elettricità danneggiata e crepe strutturali non sono state “sistemate” con questa lista.',
    ]),
    quote: moneyQuote(materials, hours, PRICE.laborRate.manutenzione, LABOR_NOTE),
    areaM2: undefined,
  })
}
