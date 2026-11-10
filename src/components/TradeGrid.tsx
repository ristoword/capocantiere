import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { TRADES, tradeStyle } from '../domain/trades'
import type { TradeId } from '../domain/types'

/** Card dei mestieri. Con `to` aprono la pagina del mestiere; con `onChange` selezionano. */
export function TradeGrid({
  value,
  onChange,
  link,
  compact,
}: {
  value?: TradeId | null
  onChange?: (trade: TradeId) => void
  link?: boolean
  compact?: boolean
}) {
  return (
    <div className={compact ? 'trade-grid compact-grid' : 'trade-grid'}>
      {TRADES.map((trade) => {
        const style = tradeStyle(trade.id)
        const css = { '--c': style.color } as CSSProperties
        const inner = (
          <>
            <span className="trade-ico">{style.icon}</span>
            <span>
              <strong>{trade.name}</strong>
              {compact ? null : <em style={{ display: 'block' }}>{trade.short}</em>}
            </span>
          </>
        )
        const cls = `trade-card${compact ? ' compact' : ''}${value === trade.id ? ' selected' : ''}`
        if (link) {
          return (
            <Link key={trade.id} to={`/mestiere/${trade.id}`} className={cls} style={css}>
              {inner}
            </Link>
          )
        }
        return (
          <button
            key={trade.id}
            type="button"
            className={cls}
            style={css}
            aria-pressed={value === trade.id}
            onClick={() => onChange?.(trade.id)}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}
