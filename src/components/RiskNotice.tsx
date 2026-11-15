import type { TradeId } from '../domain/types'
import { TRADE_RISK } from '../domain/trades'
import { Tx } from '../lib/translate'

/** Avviso di sicurezza del mestiere, visibile anche in stampa. */
export function RiskNotice({ trade }: { trade: TradeId }) {
  const text = TRADE_RISK[trade]
  if (!text) return null
  return (
    <aside className="risk" role="note">
      <strong><Tx>⚠️ Attenzione alla sicurezza</Tx></strong>
      <Tx>{text}</Tx>
    </aside>
  )
}
