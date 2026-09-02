import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import type { PricePoint } from '@/hooks/usePriceStream'

export default function Sparkline({ data }: { data: PricePoint[] }) {
  if (data.length < 2) {
    return <div className="h-8 w-24 text-[10px] text-ink-faint flex items-center justify-center">accumulating…</div>
  }

  const first = data[0]?.price ?? 0
  const last = data[data.length - 1]?.price ?? 0
  const color = last >= first ? '#2fbf71' : '#ef4a5f'

  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
