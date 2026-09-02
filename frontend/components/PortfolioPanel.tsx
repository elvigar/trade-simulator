'use client'

import { useMemo, useState } from 'react'
import PanelHeader from './PanelHeader'
import PortfolioHeatmap from './PortfolioHeatmap'
import PositionsTable from './PositionsTable'
import type { PositionMetrics } from '@/lib/portfolio'
import { formatDualCurrency, formatQuantity, formatSignedDualCurrency, formatSignedPercent } from '@/lib/format'

export default function PortfolioPanel({
  positions,
  displayCurrency = 'USD',
  rates = null,
}: {
  positions: PositionMetrics[]
  displayCurrency?: string
  rates?: Record<string, number> | null
}) {
  const [clickedTicker, setClickedTicker] = useState<string | null>(null)

  const largestTicker = useMemo(
    () =>
      positions.reduce<PositionMetrics | null>(
        (current, p) => (!current || p.marketValue > current.marketValue ? p : current),
        null,
      )?.ticker ?? null,
    [positions],
  )

  // Default to the largest holding; fall back if the clicked ticker was sold.
  const selectedTicker =
    clickedTicker && positions.some((p) => p.ticker === clickedTicker) ? clickedTicker : largestTicker
  const selected = positions.find((p) => p.ticker === selectedTicker) ?? null
  const invested = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const weight = selected && invested > 0 ? (selected.marketValue / invested) * 100 : 0

  return (
    <section className="flex h-full flex-col border border-line bg-base-panel/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <PanelHeader
        title="Portfolio"
        accent="purple"
        right={
          selected ? (
            <span className="font-mono text-[11px] text-ink-faint">
              Showing {selected.ticker} &middot; click another tile or row to switch
            </span>
          ) : null
        }
      />
      <div className="grid min-h-[18rem] flex-1 grid-cols-1 gap-3 sm:grid-cols-[1.15fr_1fr]">
        <div className="flex min-h-0 flex-col gap-2">
          <PortfolioHeatmap
            bare
            positions={positions}
            displayCurrency={displayCurrency}
            rates={rates}
            selectedTicker={selectedTicker}
            onSelectTicker={setClickedTicker}
          />
          {selected && (
            <div className="rounded-sm border border-line bg-base/80 px-2.5 py-2 text-[11px]">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="font-mono text-sm font-bold text-accent">{selected.ticker}</span>
                <span className="font-mono text-[10px] text-ink-faint">{weight.toFixed(1)}% of invested</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-ink-faint">Qty</div>
                  <div className="font-mono tabular">{formatQuantity(selected.quantity)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-ink-faint">Avg Cost</div>
                  <div className="font-mono tabular">{formatDualCurrency(selected.avgCost, displayCurrency, rates)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-ink-faint">Price</div>
                  <div className="font-mono tabular">{formatDualCurrency(selected.currentPrice, displayCurrency, rates)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-ink-faint">Value</div>
                  <div className="font-mono tabular">{formatDualCurrency(selected.marketValue, displayCurrency, rates)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-ink-faint">P&amp;L</div>
                  <div className={`font-mono tabular ${selected.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>
                    {formatSignedDualCurrency(selected.unrealizedPnl, displayCurrency, rates)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-ink-faint">P&amp;L %</div>
                  <div className={`font-mono tabular ${selected.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>
                    {formatSignedPercent(selected.unrealizedPnlPercent)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="min-h-0 overflow-auto">
          <PositionsTable
            bare
            positions={positions}
            displayCurrency={displayCurrency}
            rates={rates}
            selectedTicker={selectedTicker}
            onSelectTicker={setClickedTicker}
          />
        </div>
      </div>
    </section>
  )
}
