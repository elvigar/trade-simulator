import ConnectionDot from './ConnectionDot'
import type { ConnectionStatus } from '@/hooks/usePriceStream'
import { formatCurrency, formatSignedCurrency, formatSignedPercent } from '@/lib/format'

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'blue' | 'up' | 'down' | 'accent'
}) {
  const toneClass = {
    neutral: 'text-ink',
    blue: 'text-brand-blue',
    up: 'text-up',
    down: 'text-down',
    accent: 'text-accent',
  }[tone]

  return (
    <div className="min-w-[92px] border-l border-line/80 pl-3 text-right first:border-l-0 first:pl-0">
      <div className="text-[10px] uppercase tracking-widest text-ink-faint">{label}</div>
      <div className={`font-mono tabular text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  )
}

export default function Header({
  totalValue,
  cashBalance,
  investedValue,
  totalUnrealizedPnl,
  status,
}: {
  totalValue: number
  cashBalance: number
  investedValue: number
  totalUnrealizedPnl: number
  status: ConnectionStatus
}) {
  const pnlTone = totalUnrealizedPnl > 0 ? 'up' : totalUnrealizedPnl < 0 ? 'down' : 'neutral'
  const cashAllocation = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0

  return (
    <header className="flex items-center justify-between border-b border-line bg-base-panel/95 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-accent/50 bg-accent/10 font-mono text-sm font-bold text-accent">
          FA
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-ink">FinAlly</span>
            <span className="hidden text-[10px] uppercase tracking-widest text-accent sm:inline">Live Desk</span>
          </div>
          <div className="hidden text-[11px] text-ink-faint md:block">
            AI trading workstation with simulated capital
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-4">
        <div className="hidden items-center gap-0 rounded-sm border border-line bg-base/70 px-3 py-1.5 lg:flex">
          <Metric label="Total Value" value={formatCurrency(totalValue)} tone="accent" />
          <Metric label="Unrealized" value={formatSignedCurrency(totalUnrealizedPnl)} tone={pnlTone} />
          <Metric label="Invested" value={formatCurrency(investedValue)} tone="neutral" />
          <Metric label="Cash" value={formatCurrency(cashBalance)} tone="blue" />
          <Metric label="Cash %" value={formatSignedPercent(cashAllocation).replace('+', '')} tone="neutral" />
        </div>
        <div className="text-right lg:hidden">
          <div className="text-[10px] uppercase tracking-widest text-ink-faint">Total Value</div>
          <div className="font-mono tabular text-base font-semibold text-accent">{formatCurrency(totalValue)}</div>
        </div>
        <ConnectionDot status={status} />
      </div>
    </header>
  )
}
