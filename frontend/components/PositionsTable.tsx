import PanelHeader from './PanelHeader'
import type { PositionMetrics } from '@/lib/portfolio'
import { formatDualCurrency, formatQuantity, formatSignedDualCurrency, formatSignedPercent } from '@/lib/format'

export default function PositionsTable({
  positions,
  displayCurrency = 'USD',
  rates = null,
  selectedTicker = null,
  onSelectTicker,
  bare = false,
}: {
  positions: PositionMetrics[]
  displayCurrency?: string
  rates?: Record<string, number> | null
  /** Ticker to visually highlight, e.g. when cross-filtered with another view. */
  selectedTicker?: string | null
  /** Makes rows clickable/keyboard-focusable and reports the clicked ticker. */
  onSelectTicker?: (ticker: string) => void
  /** Skip the outer panel chrome (border + "Positions" header) for embedding inside another panel. */
  bare?: boolean
}) {
  const marketValue = positions.reduce((sum, position) => sum + position.marketValue, 0)
  const unrealizedPnl = positions.reduce((sum, position) => sum + position.unrealizedPnl, 0)
  const pnlColor = unrealizedPnl > 0 ? 'text-up' : unrealizedPnl < 0 ? 'text-down' : 'text-ink-muted'

  const table = (
    <div className="min-w-0 flex-1 overflow-x-auto overflow-y-auto">
      {positions.length === 0 ? (
        <p className="px-1 py-4 text-sm text-ink-faint">No open positions. Place a trade to get started.</p>
      ) : (
        <table className="min-w-[680px] w-full text-left text-xs">
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
              const selected = p.ticker === selectedTicker
              return (
                <tr
                  key={p.ticker}
                  role={onSelectTicker ? 'button' : undefined}
                  tabIndex={onSelectTicker ? 0 : undefined}
                  onClick={onSelectTicker ? () => onSelectTicker(p.ticker) : undefined}
                  onKeyDown={
                    onSelectTicker
                      ? (e) => (e.key === 'Enter' || e.key === ' ') && onSelectTicker(p.ticker)
                      : undefined
                  }
                  className={`border-t border-line/60 ${
                    onSelectTicker
                      ? `cursor-pointer transition-colors ${selected ? 'bg-accent/10' : 'hover:bg-base-raised/70'}`
                      : ''
                  }`}
                >
                  <td
                    className={`py-1.5 border-l-2 pl-1.5 font-sans font-semibold text-ink ${
                      selected ? 'border-l-accent' : 'border-l-transparent'
                    }`}
                  >
                    {p.ticker}
                  </td>
                  <td className="py-1.5 text-right">{formatQuantity(p.quantity)}</td>
                  <td className="py-1.5 text-right text-ink-muted">{formatDualCurrency(p.avgCost, displayCurrency, rates)}</td>
                  <td className="py-1.5 text-right">{formatDualCurrency(p.currentPrice, displayCurrency, rates)}</td>
                  <td className="py-1.5 text-right text-ink-muted">
                    {formatDualCurrency(p.marketValue, displayCurrency, rates)}
                  </td>
                  <td className={`py-1.5 text-right ${pnlColor}`}>
                    {formatSignedDualCurrency(p.unrealizedPnl, displayCurrency, rates)}
                  </td>
                  <td className={`py-1.5 text-right ${pnlColor}`}>{formatSignedPercent(p.unrealizedPnlPercent)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )

  if (bare) return table

  return (
    <section className="flex h-full flex-col border border-line bg-base-panel/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <PanelHeader
        title="Positions"
        accent="purple"
        right={
          positions.length ? (
            <div className="flex gap-3 font-mono text-[11px] tabular">
              <span className="text-ink-faint">{formatDualCurrency(marketValue, displayCurrency, rates)}</span>
              <span className={pnlColor}>{formatSignedDualCurrency(unrealizedPnl, displayCurrency, rates)}</span>
            </div>
          ) : null
        }
      />
      {table}
    </section>
  )
}
