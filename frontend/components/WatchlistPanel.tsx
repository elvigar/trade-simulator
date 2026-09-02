'use client'

import { useState } from 'react'
import PanelHeader from './PanelHeader'
import WatchlistRow from './WatchlistRow'
import type { PricePoint } from '@/hooks/usePriceStream'
import { computeSessionChangePercent } from '@/lib/portfolio'
import type { PriceUpdate, WatchlistEntry } from '@/lib/types'

export default function WatchlistPanel({
  watchlist,
  prices,
  getHistory,
  selectedTicker,
  displayCurrency = 'USD',
  rates = null,
  onSelect,
  onAdd,
  onRemove,
}: {
  watchlist: WatchlistEntry[]
  prices: Record<string, PriceUpdate>
  getHistory: (ticker: string) => PricePoint[]
  selectedTicker: string | null
  displayCurrency?: string
  rates?: Record<string, number> | null
  onSelect: (ticker: string) => void
  onAdd: (ticker: string) => Promise<{ ok: boolean; message?: string } | undefined>
  onRemove: (ticker: string) => void
}) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || submitting) return
    setSubmitting(true)
    const result = await onAdd(input)
    setSubmitting(false)
    if (result?.ok) {
      setInput('')
      setError(null)
    } else {
      setError(result?.message ?? 'Failed to add ticker')
    }
  }

  return (
    <section className="flex h-full flex-col border border-line bg-base-panel/95 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <PanelHeader
        title="Watchlist"
        accent="accent"
        right={<span className="font-mono text-[11px] text-ink-faint">{watchlist.length} symbols</span>}
      />

      <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-line px-3 pb-2 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        <span>Symbol</span>
        <span>Last</span>
        <span>Session</span>
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        {watchlist.map((entry) => {
          const history = getHistory(entry.ticker)
          return (
            <WatchlistRow
              key={entry.ticker}
              ticker={entry.ticker}
              price={prices[entry.ticker]}
              history={history}
              sessionChangePercent={computeSessionChangePercent(history, entry.daily_change_percent)}
              selected={selectedTicker === entry.ticker}
              displayCurrency={displayCurrency}
              rates={rates}
              onSelect={() => onSelect(entry.ticker)}
              onRemove={() => onRemove(entry.ticker)}
            />
          )
        })}
        {watchlist.length === 0 && (
          <p className="px-2 py-4 text-xs text-ink-faint">No tickers yet. Add one below.</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-1.5 border-t border-line bg-base/55 p-2">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          placeholder="Add ticker…"
          aria-label="Add ticker to watchlist"
          className="min-w-0 flex-1 rounded-sm border border-line bg-base px-2 py-1 font-mono text-xs uppercase text-ink placeholder:text-ink-faint focus:border-brand-blue focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-brand-blue px-2.5 py-1 text-xs font-semibold text-base shadow-[0_0_18px_rgba(32,157,215,0.22)] disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && <p className="px-2 pb-2 text-xs text-down">{error}</p>}
    </section>
  )
}
