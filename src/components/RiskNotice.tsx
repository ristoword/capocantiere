import type { TradeId } from '../domain/types'
import { TRADE_RISK } from '../domain/trades'

/** Avviso di sicurezza del mestiere, visibile anche in stampa. */
export function RiskNotice({ trade }: { trade: TradeId }) {
  const text = TRADE_RISK[trade]
  if (!text) return null
  return (
    <aside className="risk" role="note">
      <strong>⚠️ Attenzione alla sicurezza</strong>
      {text}
    </aside>
  )
}
