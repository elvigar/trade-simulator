import ConnectionDot from './ConnectionDot'
import type { ConnectionStatus } from '@/hooks/usePriceStream'
import { formatCurrency } from '@/lib/format'

export default function Header({
  totalValue,
  cashBalance,
  status,
}: {
  totalValue: number
  cashBalance: number
  status: ConnectionStatus
}) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-base-panel px-4 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold tracking-tight text-accent">FinAlly</span>
        <span className="hidden text-xs uppercase tracking-widest text-ink-faint sm:inline">
          AI Trading Workstation
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-ink-faint">Total Value</div>
          <div className="font-mono tabular text-base font-semibold text-ink">{formatCurrency(totalValue)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-ink-faint">Cash</div>
          <div className="font-mono tabular text-base text-brand-blue">{formatCurrency(cashBalance)}</div>
        </div>
        <ConnectionDot status={status} />
      </div>
    </header>
  )
}
