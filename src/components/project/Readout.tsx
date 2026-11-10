import type { CalcStep, MaterialLine, Quote, SlopeInfo, TechNote } from '../../domain/types'
import { euro, numIt, qty } from '../../lib/format'

export function Notes({ notes }: { notes: TechNote[] }) {
  return (
    <ul className="notes">
      {notes.map((item) => (
        <li key={item.text}>
          <span className="source">{item.source}</span>
          <p>{item.text}</p>
        </li>
      ))}
    </ul>
  )
}

export function SlopeCard({ slope }: { slope: SlopeInfo }) {
  return (
    <section className="slope">
      <h3>Pendenza</h3>
      <p className="formula">{slope.formula}</p>
      <p>{slope.example}</p>
      <dl className="metrics">
        <div>
          <dt>Pendenza</dt>
          <dd>{numIt(slope.percent, 1)}%</dd>
        </div>
        <div>
          <dt>Dislivello per metro</dt>
          <dd>{numIt(slope.cmPerMeter, 1)} cm/m</dd>
        </div>
        <div>
          <dt>Sulla lunghezza di {numIt(slope.lengthM, 1)} m</dt>
          <dd>{numIt(slope.totalCm, 1)} cm</dd>
        </div>
      </dl>
      <p>
        Sul rilievo di questo fascicolo: {numIt(slope.percent, 1)}% = {numIt(slope.cmPerMeter, 1)} cm per metro. Su{' '}
        {numIt(slope.lengthM, 1)} m il dislivello è {numIt(slope.totalCm, 1)} cm.
      </p>
    </section>
  )
}

export function CalcList({ steps }: { steps: CalcStep[] }) {
  return (
    <ol className="calc-list">
      {steps.map((item) => (
        <li key={item.label}>
          <strong>{item.label}</strong>
          <span className="formula">{item.formula}</span>
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
            <th>Voce</th>
            <th>Quantità</th>
            <th>Prezzo</th>
            <th>Importo</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                <strong>{line.name}</strong>
                <small className="help">
                  Sfrido: {line.wasteLabel}. Da misurare: {line.measureNote} {line.sourceNote}
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
                {line.unit}
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
          <span>Materiali</span>
          <strong>{euro(quote.materialsEuro)}</strong>
        </div>
        <div>
          <span>Manodopera</span>
          <strong>{euro(quote.laborEuro)}</strong>
        </div>
        <div className="total">
          <span>Totale</span>
          <strong>{euro(quote.totalEuro)}</strong>
        </div>
      </div>
      <div className="labor-edit">
        <label>
          Ore stimate
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
            <b> {numIt(quote.laborHours, 1)} h</b>
          )}
        </label>
        <label>
          Tariffa €/h
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
            Equivalente sul totale: {euro(perM2)} / m², su {numIt(areaM2 ?? 0)} m².
          </p>
        ) : null}
      </div>
      <p className="help">{quote.laborNote}</p>
      <p className="help">{quote.assumptions}</p>
    </div>
  )
}
