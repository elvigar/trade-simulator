'use client'

import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PanelHeader from './PanelHeader'
import type { PortfolioSnapshot } from '@/lib/types'
import { formatCurrency, formatDualCurrency } from '@/lib/format'

const BASELINE = 10000

export default function PnLChart({
  history,
  displayCurrency = 'USD',
  rates = null,
}: {
  history: PortfolioSnapshot[]
  displayCurrency?: string
  rates?: Record<string, number> | null
}) {
  const data = history.map((s) => ({
    t: new Date(s.recorded_at).getTime(),
    value: s.total_value,
  }))
  const latest = data.at(-1)?.value
  const change = latest !== undefined ? latest - BASELINE : 0
  const changeColor = change > 0 ? 'text-up' : change < 0 ? 'text-down' : 'text-ink-muted'

  return (
    <section
      data-testid="pnl-chart"
      className="flex h-full flex-col border border-line bg-base-panel/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
    >
      <PanelHeader
        title="Equity Curve"
        accent="blue"
        right={
          <span className={`font-mono text-[11px] tabular ${changeColor}`}>
            {formatDualCurrency(change, displayCurrency, rates)}
          </span>
        }
      />
      <div className="flex-1 min-h-[160px]">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            Snapshots will appear as trades happen and time passes.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="t"
                tickFormatter={(v: number) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                stroke="#5c6472"
                tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#5c6472"
                tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
                width={64}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <ReferenceLine y={BASELINE} stroke="#5c6472" strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{ background: '#171d28', border: '1px solid #242b38', fontSize: 12 }}
                labelFormatter={(v: number) => new Date(v).toLocaleTimeString()}
                formatter={(value: number) => [formatCurrency(value), 'Total value']}
              />
              <Line type="monotone" dataKey="value" stroke="#ecad0a" strokeWidth={1.75} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
