'use client'

import { ResponsiveContainer, Tooltip, Treemap } from 'recharts'
import PanelHeader from './PanelHeader'
import type { PositionMetrics } from '@/lib/portfolio'
import { formatCurrency, formatSignedPercent } from '@/lib/format'

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
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, pnlPercent = 0 } = props
  if (width < 2 || height < 2) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={pnlColor(pnlPercent)} stroke="#0d1117" strokeWidth={2} />
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

export default function PortfolioHeatmap({ positions }: { positions: PositionMetrics[] }) {
  const data: TreemapNode[] = positions
    .filter((p) => p.marketValue > 0)
    .map((p) => ({ name: p.ticker, size: p.marketValue, pnlPercent: p.unrealizedPnlPercent }))

  return (
    <section className="flex h-full flex-col bg-base-panel border border-line rounded-sm p-2">
      <PanelHeader title="Portfolio Heatmap" accent="purple" />
      <div className="flex-1 min-h-[180px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">No open positions yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={data}
              dataKey="size"
              stroke="#0d1117"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={<CellContent /> as any}
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
    </section>
  )
}
