'use client'

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PanelHeader from './PanelHeader'
import type { PricePoint } from '@/hooks/usePriceStream'
import { computeSessionChangePercent } from '@/lib/portfolio'
import type { PriceUpdate } from '@/lib/types'
import { formatClockTime, formatSignedPercent } from '@/lib/format'

export default function MainChart({
  ticker,
  price,
  history,
}: {
  ticker: string | null
  price: PriceUpdate | undefined
  history: PricePoint[]
}) {
  const sessionChangePercent = computeSessionChangePercent(history, undefined)
  const changeColor = sessionChangePercent > 0 ? 'text-up' : sessionChangePercent < 0 ? 'text-down' : 'text-ink-muted'
  const lineColor = sessionChangePercent >= 0 ? '#2fbf71' : '#ef4a5f'

  return (
    <section className="flex h-full flex-col bg-base-panel border border-line rounded-sm p-2">
      <PanelHeader
        title={ticker ? `${ticker} — Price` : 'Select a ticker'}
        accent="blue"
        right={
          ticker && price ? (
            <div className="flex items-baseline gap-2 font-mono tabular">
              <span className="text-lg font-semibold text-ink">{price.price.toFixed(2)}</span>
              <span className={`text-xs ${changeColor}`} title="Change since page load">
                {formatSignedPercent(sessionChangePercent)}
              </span>
            </div>
          ) : null
        }
      />

      <div className="flex-1 min-h-[220px]">
        {!ticker ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            Click a ticker in the watchlist to see its chart.
          </div>
        ) : history.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            Waiting for price data since page load…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="t"
                tickFormatter={formatClockTime}
                stroke="#5c6472"
                tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#5c6472"
                tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
                width={56}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
              <Tooltip
                contentStyle={{ background: '#171d28', border: '1px solid #242b38', fontSize: 12 }}
                labelFormatter={(v: number) => formatClockTime(v)}
                formatter={(value: number) => [value.toFixed(2), 'Price']}
              />
              <Line type="monotone" dataKey="price" stroke={lineColor} strokeWidth={1.75} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
