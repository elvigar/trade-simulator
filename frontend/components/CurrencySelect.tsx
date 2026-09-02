import type { CurrencyMeta } from '@/lib/types'

export default function CurrencySelect({
  currencies,
  value,
  onChange,
}: {
  currencies: CurrencyMeta[]
  value: string
  onChange: (code: string) => void
}) {
  return (
    <select
      aria-label="Display currency"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-sm border border-line bg-base/70 px-2 py-1.5 font-mono text-xs uppercase text-ink-muted focus:border-brand-blue focus:outline-none"
    >
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code}
        </option>
      ))}
    </select>
  )
}
