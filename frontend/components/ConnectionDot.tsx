import type { ConnectionStatus } from '@/hooks/usePriceStream'

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; label: string; pulse: boolean }> = {
  connected: { color: 'bg-up', label: 'Connected', pulse: false },
  reconnecting: { color: 'bg-accent', label: 'Reconnecting', pulse: true },
  disconnected: { color: 'bg-down', label: 'Disconnected', pulse: false },
}

export default function ConnectionDot({ status }: { status: ConnectionStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <div className="flex items-center gap-2" role="status" aria-label={`Market data: ${cfg.label}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.color} ${cfg.pulse ? 'animate-pulse-soft' : ''}`} />
      <span className="text-xs uppercase tracking-wider text-ink-muted">{cfg.label}</span>
    </div>
  )
}
