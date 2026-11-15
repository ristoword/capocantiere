import type { CalcStep, MaterialLine, Quote, SlopeInfo, TechNote } from '../../domain/types'
import { euro, numIt, qty } from '../../lib/format'
import { Tx } from '../../lib/translate'


export function Notes({ notes }: { notes: TechNote[] }) {
  return (
    <ul className="notes">
      {notes.map((item) => (
        <li key={item.text}>
          <span className="source"><Tx>{item.source}</Tx></span>
          <p><Tx>{item.text}</Tx></p>
        </li>
      ))}
    </ul>
  )
}

export function SlopeCard({ slope }: { slope: SlopeInfo }) {
  return (
    <section className="slope">
      <h3><Tx>Pendenza</Tx></h3>
      <p className="formula"><Tx>{slope.formula}</Tx></p>
      <p>{slope.example}</p>
      <dl className="metrics">
        <div>
          <dt><Tx>Pendenza</Tx></dt>
          <dd>{numIt(slope.percent, 1)}%</dd>
        </div>
        <div>
          <dt><Tx>Dislivello per metro</Tx></dt>
          <dd>{numIt(slope.cmPerMeter, 1)} <Tx>cm/m</Tx></dd>
        </div>
        <div>
          <dt><Tx>Sulla lunghezza di</Tx> {numIt(slope.lengthM, 1)} <Tx>m</Tx></dt>
          <dd>{numIt(slope.totalCm, 1)} <Tx>cm</Tx></dd>
        </div>
      </dl>
      <p>
        <Tx>Sul rilievo di questo fascicolo:</Tx> {numIt(slope.percent, 1)}% = {numIt(slope.cmPerMeter, 1)} <Tx>cm per metro. Su</Tx>{' '}
        {numIt(slope.lengthM, 1)} <Tx>m il dislivello è</Tx> {numIt(slope.totalCm, 1)} <Tx>cm.</Tx>
      </p>
    </section>
  )
}

export function CalcList({ steps }: { steps: CalcStep[] }) {
  return (
    <ol className="calc-list">
      {steps.map((item) => (
        <li key={item.label}>
          <strong><Tx>{item.label}</Tx></strong>
          <span className="formula"><Tx>{item.formula}</Tx></span>
          <b>{item.result}</b>
        </li>
      ))}
    </ol>
  )
}

function readNumber(raw: string): number | null {
  const value = Number(raw.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

export function MaterialsTable({
  lines,
  editable,
  onQuantity,
  onPrice,
}: {
  lines: MaterialLine[]
  editable?: boolean
  onQuantity?: (id: string, quantity: number) => void
  onPrice?: (id: string, unitPrice: number) => void
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th><Tx>Voce</Tx></th>
            <th><Tx>Quantità</Tx></th>
            <th><Tx>Prezzo</Tx></th>
            <th><Tx>Importo</Tx></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                <strong><Tx>{line.name}</Tx></strong>
                <small className="help">
                  <Tx>Sfrido:</Tx> <Tx>{line.wasteLabel}</Tx><Tx>. Da misurare:</Tx> <Tx>{line.measureNote}</Tx> <Tx>{line.sourceNote}</Tx>
                </small>
              </td>
              <td>
                {editable ? (
                  <input
                    className="tiny"
                    type="number"
                    min={0}
                    step="0.01"
                    key={`${line.id}-q-${line.quantity}`}
                    defaultValue={line.quantity}
                    aria-label={`Quantità ${line.name}`}
                    onBlur={(event) => {
                      const next = readNumber(event.target.value)
                      if (next === null || next === line.quantity) return
                      onQuantity?.(line.id, next)
                    }}
                  />
                ) : (
                  qty(line.quantity)
                )}{' '}
                <Tx>{line.unit}</Tx>
              </td>
              <td>
                {editable ? (
                  <input
                    className="tiny"
                    type="number"
                    min={0}
                    step="0.01"
                    key={`${line.id}-p-${line.unitPrice}`}
                    defaultValue={line.unitPrice}
                    aria-label={`Prezzo ${line.name}`}
                    onBlur={(event) => {
                      const next = readNumber(event.target.value)
                      if (next === null || next === line.unitPrice) return
                      onPrice?.(line.id, next)
                    }}
                  />
                ) : (
                  euro(line.unitPrice)
                )}
              </td>
              <td className="num">{euro(line.quantity * line.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function QuoteBox({
  quote,
  areaM2,
  editable,
  onHours,
  onRate,
}: {
  quote: Quote
  areaM2?: number
  editable?: boolean
  onHours?: (hours: number) => void
  onRate?: (rate: number) => void
}) {
  const perM2 = areaM2 && areaM2 > 0 ? quote.totalEuro / areaM2 : null
  return (
    <div className="quote">
      <div className="quote-grid">
        <div>
          <span><Tx>Materiali</Tx></span>
          <strong>{euro(quote.materialsEuro)}</strong>
        </div>
        <div>
          <span><Tx>Manodopera</Tx></span>
          <strong>{euro(quote.laborEuro)}</strong>
        </div>
        <div className="total">
          <span><Tx>Totale</Tx></span>
          <strong>{euro(quote.totalEuro)}</strong>
        </div>
      </div>
      <div className="labor-edit">
        <label>
          <Tx>Ore stimate</Tx>
          {editable ? (
            <input
              type="number"
              min={0}
              step="0.1"
              key={`h-${quote.laborHours}`}
              defaultValue={quote.laborHours}
              onBlur={(event) => {
                const next = readNumber(event.target.value)
                if (next === null || next === quote.laborHours) return
                onHours?.(next)
              }}
            />
          ) : (
            <b> {numIt(quote.laborHours, 1)} <Tx>h</Tx></b>
          )}
        </label>
        <label>
          <Tx>Tariffa €/h</Tx>
          {editable ? (
            <input
              type="number"
              min={0}
              step="0.5"
              key={`r-${quote.hourlyRate}`}
              defaultValue={quote.hourlyRate}
              onBlur={(event) => {
                const next = readNumber(event.target.value)
                if (next === null || next === quote.hourlyRate) return
                onRate?.(next)
              }}
            />
          ) : (
            <b> {euro(quote.hourlyRate)}</b>
          )}
        </label>
        {perM2 !== null ? (
          <p>
            <Tx>Equivalente sul totale:</Tx> {euro(perM2)} <Tx>/ m², su</Tx> {numIt(areaM2 ?? 0)} <Tx>m².</Tx>
          </p>
        ) : null}
      </div>
      <p className="help"><Tx>{quote.laborNote}</Tx></p>
      <p className="help"><Tx>{quote.assumptions}</Tx></p>
    </div>
  )
}
