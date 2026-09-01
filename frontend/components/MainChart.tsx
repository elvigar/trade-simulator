'use client'

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PanelHeader from './PanelHeader'
import type { PricePoint } from '@/hooks/usePriceStream'
import { computeSessionChangePercent } from '@/lib/portfolio'
import type { PriceUpdate } from '@/lib/types'
import { formatClockTime, formatCurrency, formatSignedPercent } from '@/lib/format'

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'up' | 'down' }) {
  const toneClass = tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink'
  return (
    <div className="border-l border-line/70 pl-3 first:border-l-0 first:pl-0">
      <div className="text-[10px] uppercase tracking-widest text-ink-faint">{label}</div>
      <div className={`font-mono tabular text-xs font-semibold ${toneClass}`}>{value}</div>
    </div>
  )
}

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
  const latestPrice = price?.price
  const tickChange = price?.change ?? 0
  const tickTone = tickChange > 0 ? 'up' : tickChange < 0 ? 'down' : 'neutral'
  const sessionHigh = history.length ? Math.max(...history.map((point) => point.price)) : latestPrice
  const sessionLow = history.length ? Math.min(...history.map((point) => point.price)) : latestPrice

  return (
    <section className="flex h-full flex-col border border-line bg-base-panel/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
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

      {ticker && (
        <div className="mb-2 grid grid-cols-5 gap-0 rounded-sm border border-line bg-base/75 px-3 py-2">
          <Stat label="Last" value={latestPrice ? formatCurrency(latestPrice) : '--'} />
          <Stat label="Tick" value={price ? formatSignedPercent(price.change_percent) : '--'} tone={tickTone} />
          <Stat label="Session" value={formatSignedPercent(sessionChangePercent)} tone={sessionChangePercent > 0 ? 'up' : sessionChangePercent < 0 ? 'down' : 'neutral'} />
          <Stat label="Range" value={sessionHigh && sessionLow ? `${sessionLow.toFixed(2)}-${sessionHigh.toFixed(2)}` : '--'} />
          <Stat label="Samples" value={String(history.length)} />
        </div>
      )}

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
