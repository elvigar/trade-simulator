'use client'

import { ResponsiveContainer, Tooltip, Treemap } from 'recharts'
import PanelHeader from './PanelHeader'
import type { PositionMetrics } from '@/lib/portfolio'
import { formatCurrency, formatDualCurrency, formatSignedPercent } from '@/lib/format'

interface TreemapNode {
  name: string
  size: number
  pnlPercent: number
}

function pnlColor(pnlPercent: number): string {
  const clamped = Math.max(-15, Math.min(15, pnlPercent))
  if (clamped >= 0) {
    const t = clamped / 15
    const lightness = 42 - t * 12
    return `hsl(150, 60%, ${lightness}%)`
  }
  const t = -clamped / 15
  const lightness = 48 - t * 14
  return `hsl(353, 70%, ${lightness}%)`
}

function CellContent(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  pnlPercent?: number
  selectedTicker?: string | null
  onSelect?: (ticker: string) => void
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, pnlPercent = 0, selectedTicker, onSelect } = props
  if (width < 2 || height < 2) return null
  const selected = name !== undefined && name === selectedTicker
  return (
    <g onClick={onSelect && name ? () => onSelect(name) : undefined} style={onSelect ? { cursor: 'pointer' } : undefined}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={pnlColor(pnlPercent)}
        stroke={selected ? '#ecad0a' : '#0d1117'}
        strokeWidth={selected ? 3 : 2}
      />
      {width > 46 && height > 28 && (
        <>
          <text x={x + 6} y={y + 16} fill="#0d1117" fontSize={11} fontWeight={700} fontFamily="var(--font-mono)">
            {name}
          </text>
          <text x={x + 6} y={y + 30} fill="#0d1117" fontSize={10} fontFamily="var(--font-mono)">
            {formatSignedPercent(pnlPercent)}
          </text>
        </>
      )}
    </g>
  )
}

export default function PortfolioHeatmap({
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
  /** Ticker to visually ring, e.g. when cross-filtered with another view. */
  selectedTicker?: string | null
  /** Makes cells clickable and reports the clicked ticker. */
  onSelectTicker?: (ticker: string) => void
  /** Skip the outer panel chrome (border + "Exposure Map" header) for embedding inside another panel. */
  bare?: boolean
}) {
  const data: TreemapNode[] = positions
    .filter((p) => p.marketValue > 0)
    .map((p) => ({ name: p.ticker, size: p.marketValue, pnlPercent: p.unrealizedPnlPercent }))
  const largest = positions.reduce<PositionMetrics | null>(
    (current, position) => (!current || position.marketValue > current.marketValue ? position : current),
    null,
  )

  const treemap = (
    <div className="flex-1 min-h-[180px]">
      {data.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-ink-faint">No open positions yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            stroke="#0d1117"
            content={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <CellContent selectedTicker={selectedTicker} onSelect={onSelectTicker} /> as any
            }
            isAnimationActive={false}
          >
            <Tooltip
              contentStyle={{ background: '#171d28', border: '1px solid #242b38', fontSize: 12 }}
              formatter={(value: number) => [formatCurrency(value), 'Market value']}
            />
          </Treemap>
        </ResponsiveContainer>
      )}
    </div>
  )

  if (bare) return treemap

  return (
    <section className="flex h-full flex-col border border-line bg-base-panel/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <PanelHeader
        title="Exposure Map"
        accent="purple"
        right={
          largest ? (
            <span className="font-mono text-[11px] text-ink-faint">
              Top {largest.ticker} {formatDualCurrency(largest.marketValue, displayCurrency, rates)}
            </span>
          ) : null
        }
      />
      {treemap}
    </section>
  )
}
