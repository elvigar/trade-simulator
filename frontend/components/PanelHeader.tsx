type Accent = 'accent' | 'blue' | 'purple'

const ACCENT_BORDER: Record<Accent, string> = {
  accent: 'border-l-accent',
  blue: 'border-l-brand-blue',
  purple: 'border-l-brand-purple',
}

export default function PanelHeader({
  title,
  accent = 'accent',
  right,
}: {
  title: string
  accent?: Accent
  right?: React.ReactNode
}) {
  return (
    <div className={`mb-2 flex items-center justify-between border-l-2 border-b border-b-line/70 ${ACCENT_BORDER[accent]} pb-1.5 pl-2 pr-1 pt-0.5`}>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">{title}</h2>
      {right}
    </div>
  )
}
