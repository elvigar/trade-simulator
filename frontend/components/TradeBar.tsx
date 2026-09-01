'use client'

import { useState } from 'react'
import PanelHeader from './PanelHeader'
import { ApiError, api } from '@/lib/api'
import type { TradeSide } from '@/lib/types'

export default function TradeBar({
  defaultTicker,
  onTraded,
}: {
  defaultTicker: string | null
  onTraded: () => void
}) {
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [submitting, setSubmitting] = useState<TradeSide | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  const effectiveTicker = (ticker || defaultTicker || '').trim().toUpperCase()

  async function submit(side: TradeSide) {
    const qty = Number(quantity)
    if (!effectiveTicker) {
      setFeedback({ ok: false, text: 'Enter a ticker.' })
      return
    }
    if (!qty || qty <= 0) {
      setFeedback({ ok: false, text: 'Enter a quantity greater than 0.' })
      return
    }

    setSubmitting(side)
    setFeedback(null)
    try {
      const { trade } = await api.trade({ ticker: effectiveTicker, side, quantity: qty })
      setFeedback({ ok: true, text: `${side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${effectiveTicker} @ ${trade.price.toFixed(2)}` })
      setQuantity('')
      onTraded()
    } catch (e) {
      const text = e instanceof ApiError ? e.message : 'Trade failed.'
      setFeedback({ ok: false, text })
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <section className="bg-base-panel border border-line rounded-sm p-2">
      <PanelHeader title="Trade" accent="purple" />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="trade-ticker" className="text-[10px] uppercase tracking-widest text-ink-faint">
            Ticker
          </label>
          <input
            id="trade-ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder={defaultTicker ?? 'AAPL'}
            className="w-24 rounded-sm border border-line bg-base px-2 py-1 font-mono text-sm uppercase text-ink placeholder:text-ink-faint focus:border-brand-blue focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="trade-qty" className="text-[10px] uppercase tracking-widest text-ink-faint">
            Quantity
          </label>
          <input
            id="trade-qty"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="10"
            className="w-24 rounded-sm border border-line bg-base px-2 py-1 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-brand-blue focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => submit('buy')}
          disabled={submitting !== null}
          className="rounded-sm bg-up px-4 py-1.5 text-sm font-semibold text-base disabled:opacity-50"
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => submit('sell')}
          disabled={submitting !== null}
          className="rounded-sm bg-down px-4 py-1.5 text-sm font-semibold text-base disabled:opacity-50"
        >
          Sell
        </button>
        {feedback && (
          <span className={`text-xs ${feedback.ok ? 'text-up' : 'text-down'}`} role="status">
            {feedback.text}
          </span>
        )}
      </div>
    </section>
  )
}
