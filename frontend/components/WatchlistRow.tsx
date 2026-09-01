import Sparkline from './Sparkline'
import { usePriceFlash } from '@/hooks/usePriceFlash'
import type { PricePoint } from '@/hooks/usePriceStream'
import type { PriceUpdate } from '@/lib/types'
import { formatCurrency, formatSignedPercent } from '@/lib/format'

const FLASH_CLASS: Record<'up' | 'down' | 'flat', string> = {
  up: 'animate-flash-up',
  down: 'animate-flash-down',
  flat: '',
}

export default function WatchlistRow({
  ticker,
  price,
  history,
  sessionChangePercent,
  selected,
  displayCurrency = 'USD',
  rates = null,
  onSelect,
  onRemove,
}: {
  ticker: string
  price: PriceUpdate | undefined
  history: PricePoint[]
  sessionChangePercent: number
  selected: boolean
  displayCurrency?: string
  rates?: Record<string, number> | null
  onSelect: () => void
  onRemove: () => void
}) {
  const flash = usePriceFlash(price?.price)
  const changeColor =
    sessionChangePercent > 0 ? 'text-up' : sessionChangePercent < 0 ? 'text-down' : 'text-ink-muted'
  const usdPrice = price ? formatCurrency(price.price, 'USD') : null
  const rate = displayCurrency !== 'USD' ? rates?.[displayCurrency] : undefined
  // The watchlist column is fixed-width — show the converted value alone
  // (with USD in a tooltip) rather than the full dual "$X · €Y" string, which
  // doesn't fit next to the sparkline.
  const priceText = price ? (rate ? formatCurrency(price.price * rate, displayCurrency) : usdPrice!) : '—'
  const priceTitle = rate ? (usdPrice ?? undefined) : undefined

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      data-testid={`watchlist-row-${ticker}`}
      className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-2 py-2 cursor-pointer border-l-2 transition-colors ${
        selected
          ? 'border-l-accent bg-accent/10 shadow-[inset_0_0_0_1px_rgba(236,173,10,0.12)]'
          : 'border-l-transparent hover:bg-base-raised/70'
      }`}
    >
      <div className="flex flex-col">
        <span className="font-mono text-sm font-semibold text-ink">{ticker}</span>
      </div>

      <div className={`font-mono tabular text-sm text-right px-1 rounded-sm ${FLASH_CLASS[flash]}`} title={priceTitle}>
        {priceText}
      </div>

      <div className={`font-mono tabular text-xs text-right w-14 ${changeColor}`} title="Change since page load">
        {price ? formatSignedPercent(sessionChangePercent) : '—'}
      </div>

      <Sparkline data={history} />

      <button
        type="button"
        aria-label={`Remove ${ticker} from watchlist`}
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="text-ink-faint hover:text-down text-xs px-1 justify-self-end"
      >
        ✕
      </button>
    </div>
  )
}
