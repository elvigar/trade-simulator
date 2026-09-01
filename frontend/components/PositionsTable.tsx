import PanelHeader from './PanelHeader'
import type { PositionMetrics } from '@/lib/portfolio'
import { formatCurrency, formatQuantity, formatSignedCurrency, formatSignedPercent } from '@/lib/format'

export default function PositionsTable({ positions }: { positions: PositionMetrics[] }) {
  const marketValue = positions.reduce((sum, position) => sum + position.marketValue, 0)
  const unrealizedPnl = positions.reduce((sum, position) => sum + position.unrealizedPnl, 0)
  const pnlColor = unrealizedPnl > 0 ? 'text-up' : unrealizedPnl < 0 ? 'text-down' : 'text-ink-muted'

  return (
    <section className="flex h-full flex-col border border-line bg-base-panel/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <PanelHeader
        title="Positions"
        accent="purple"
        right={
          positions.length ? (
            <div className="flex gap-3 font-mono text-[11px] tabular">
              <span className="text-ink-faint">{formatCurrency(marketValue)}</span>
              <span className={pnlColor}>{formatSignedCurrency(unrealizedPnl)}</span>
            </div>
          ) : null
        }
      />
      <div className="flex-1 overflow-auto">
        {positions.length === 0 ? (
          <p className="px-1 py-4 text-sm text-ink-faint">No open positions. Place a trade to get started.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-ink-faint">
                <th className="py-1 font-medium">Ticker</th>
                <th className="py-1 font-medium text-right">Qty</th>
                <th className="py-1 font-medium text-right">Avg Cost</th>
                <th className="py-1 font-medium text-right">Price</th>
                <th className="py-1 font-medium text-right">Value</th>
                <th className="py-1 font-medium text-right">P&amp;L</th>
                <th className="py-1 font-medium text-right">%</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {positions.map((p) => {
                const pnlColor = p.unrealizedPnl > 0 ? 'text-up' : p.unrealizedPnl < 0 ? 'text-down' : 'text-ink-muted'
                return (
                  <tr key={p.ticker} className="border-t border-line/60">
                    <td className="py-1.5 font-sans font-semibold text-ink">{p.ticker}</td>
                    <td className="py-1.5 text-right">{formatQuantity(p.quantity)}</td>
                    <td className="py-1.5 text-right text-ink-muted">{formatCurrency(p.avgCost)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(p.currentPrice)}</td>
                    <td className="py-1.5 text-right text-ink-muted">{formatCurrency(p.marketValue)}</td>
                    <td className={`py-1.5 text-right ${pnlColor}`}>{formatSignedCurrency(p.unrealizedPnl)}</td>
                    <td className={`py-1.5 text-right ${pnlColor}`}>{formatSignedPercent(p.unrealizedPnlPercent)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
