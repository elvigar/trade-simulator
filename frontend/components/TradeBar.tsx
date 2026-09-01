'use client'

import { useState } from 'react'
import PanelHeader from './PanelHeader'
import { ApiError, api } from '@/lib/api'
import type { TradeSide } from '@/lib/types'
import { formatDualCurrency, formatQuantity } from '@/lib/format'

export default function TradeBar({
  defaultTicker,
  currentPrice,
  cashBalance,
  heldQuantity,
  displayCurrency = 'USD',
  rates = null,
  onTraded,
}: {
  defaultTicker: string | null
  currentPrice?: number
  cashBalance: number
  heldQuantity: number
  displayCurrency?: string
  rates?: Record<string, number> | null
  onTraded: () => void
}) {
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [submitting, setSubmitting] = useState<TradeSide | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  const effectiveTicker = (ticker || defaultTicker || '').trim().toUpperCase()
  const numericQuantity = Number(quantity)
  const validQuantity = Number.isFinite(numericQuantity) && numericQuantity > 0
  const estimatedNotional = validQuantity && currentPrice ? numericQuantity * currentPrice : null
  const cashAfterBuy = estimatedNotional !== null ? cashBalance - estimatedNotional : null
  const cashAfterSell = estimatedNotional !== null ? cashBalance + estimatedNotional : null
  const sharesAfterBuy = validQuantity ? heldQuantity + numericQuantity : heldQuantity
  const sharesAfterSell = validQuantity ? heldQuantity - numericQuantity : heldQuantity

  async function submit(side: TradeSide) {
    if (!effectiveTicker) {
      setFeedback({ ok: false, text: 'Enter a ticker.' })
      return
    }
    if (!validQuantity) {
      setFeedback({ ok: false, text: 'Enter a quantity greater than 0.' })
      return
    }

    setSubmitting(side)
    setFeedback(null)
    try {
      const { trade } = await api.trade({ ticker: effectiveTicker, side, quantity: numericQuantity })
      setFeedback({
        ok: true,
        text: `${side === 'buy' ? 'Bought' : 'Sold'} ${numericQuantity} ${effectiveTicker} @ ${trade.price.toFixed(2)}`,
      })
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
    <section className="border border-line bg-base-panel/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <PanelHeader
        title="Order Ticket"
        accent="purple"
        right={
          effectiveTicker ? (
            <span className="font-mono text-[11px] text-ink-faint">
              {effectiveTicker}
              {currentPrice ? ` @ ${formatDualCurrency(currentPrice, displayCurrency, rates)}` : ''}
            </span>
          ) : null
        }
      />
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 xl:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto]">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="trade-ticker" className="text-[10px] uppercase tracking-widest text-ink-faint">
            Ticker
          </label>
          <input
            id="trade-ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder={defaultTicker ?? 'AAPL'}
            className="w-full rounded-sm border border-line bg-base px-2 py-1.5 font-mono text-sm uppercase text-ink placeholder:text-ink-faint focus:border-brand-blue focus:outline-none xl:w-24"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
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
            className="w-full rounded-sm border border-line bg-base px-2 py-1.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-brand-blue focus:outline-none xl:w-24"
          />
        </div>
        <div className="col-span-1 grid min-w-0 grid-cols-2 gap-1 rounded-sm border border-line bg-base/80 px-2 py-1.5 text-[11px] sm:col-span-2 sm:grid-cols-4 xl:col-span-1">
          <div>
            <div className="uppercase tracking-widest text-ink-faint">Notional</div>
            <div className="font-mono tabular text-ink">
              {estimatedNotional === null ? '--' : formatDualCurrency(estimatedNotional, displayCurrency, rates)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-widest text-ink-faint">Cash Buy</div>
            <div className={`font-mono tabular ${cashAfterBuy !== null && cashAfterBuy < 0 ? 'text-down' : 'text-ink'}`}>
              {cashAfterBuy === null ? '--' : formatDualCurrency(cashAfterBuy, displayCurrency, rates)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-widest text-ink-faint">Cash Sell</div>
            <div className="font-mono tabular text-ink">
              {cashAfterSell === null ? '--' : formatDualCurrency(cashAfterSell, displayCurrency, rates)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-widest text-ink-faint">Shares</div>
            <div className={`font-mono tabular ${sharesAfterSell < 0 ? 'text-down' : 'text-ink'}`}>
              {formatQuantity(sharesAfterBuy)} / {formatQuantity(sharesAfterSell)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => submit('buy')}
          disabled={submitting !== null}
          className="w-full rounded-sm bg-up px-4 py-1.5 text-sm font-semibold text-base disabled:opacity-50 xl:w-auto"
        >
          <span aria-hidden="true" className="mr-1 rounded-[1px] bg-base/25 px-1 font-mono text-[10px]">
            B
          </span>
          <span>Buy</span>
        </button>
        <button
          type="button"
          onClick={() => submit('sell')}
          disabled={submitting !== null}
          className="w-full rounded-sm bg-down px-4 py-1.5 text-sm font-semibold text-base disabled:opacity-50 xl:w-auto"
        >
          <span aria-hidden="true" className="mr-1 rounded-[1px] bg-base/25 px-1 font-mono text-[10px]">
            S
          </span>
          <span>Sell</span>
        </button>
        {feedback && (
          <span className={`min-w-0 text-xs ${feedback.ok ? 'text-up' : 'text-down'}`} role="status">
            {feedback.text}
          </span>
        )}
      </div>
    </section>
  )
}
