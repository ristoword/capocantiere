import { FIELDS } from '../domain/fields'
import type { InputValue, TradeId } from '../domain/types'

export function InputsForm({
  trade,
  inputs,
  onChange,
}: {
  trade: TradeId
  inputs: Record<string, InputValue>
  onChange: (key: string, value: InputValue) => void
}) {
  const fields = FIELDS[trade].filter((field) => !field.showIf || field.showIf(inputs))
  return (
    <div className="form-grid">
      {fields.map((field) => {
        const value = inputs[field.key] ?? field.defaultValue
        return (
          <label key={field.key} className={field.type === 'boolean' ? 'field field-bool' : 'field'}>
            <span className="field-label">
              {field.label}
              {field.unit ? <small> {field.unit}</small> : null}
            </span>
            {field.type === 'number' ? (
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step ?? 1}
                value={typeof value === 'number' ? value : Number(value) || 0}
                onChange={(event) => onChange(field.key, event.target.value === '' ? 0 : Number(event.target.value))}
              />
            ) : null}
            {field.type === 'select' ? (
              <select value={String(value)} onChange={(event) => onChange(field.key, event.target.value)}>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
            {field.type === 'boolean' ? (
              <button
                type="button"
                className={value === true ? 'switch on' : 'switch'}
                aria-pressed={value === true}
                onClick={() => onChange(field.key, value !== true)}
              >
                {value === true ? 'Sì' : 'No'}
              </button>
            ) : null}
            {field.help ? <small className="help">{field.help}</small> : null}
          </label>
        )
      })}
    </div>
  )
}
