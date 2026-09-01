import type { ActionResult, ChatMessage } from '@/lib/types'

function ActionResultBadge({ result }: { result: ActionResult }) {
  const ok = result.status === 'ok'
  const label =
    result.type === 'trade'
      ? `${(result.request as { side: string }).side} ${(result.request as { quantity: number }).quantity} ${
          (result.request as { ticker: string }).ticker
        }`
      : `${(result.request as { action: string }).action} ${(result.request as { ticker: string }).ticker}`

  return (
    <div
      className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-mono ${
        ok ? 'border-up/40 bg-up/10 text-up' : 'border-down/40 bg-down/10 text-down'
      }`}
    >
      <span>{ok ? '✓' : '✕'}</span>
      <span className="capitalize">{label}</span>
      {!ok && result.error_code && <span className="text-ink-faint">({result.error_code})</span>}
    </div>
  )
}

export default function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[92%] rounded-sm px-2.5 py-1.5 text-sm ${
          isUser
            ? 'bg-brand-blue/20 text-ink'
            : message.isError
              ? 'bg-down/10 text-down'
              : 'bg-base-raised text-ink'
        }`}
      >
        {message.pending ? (
          <span className="inline-flex items-center gap-1 text-ink-faint" aria-label="AI is thinking">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ink-faint" />
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ink-faint [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-ink-faint [animation-delay:300ms]" />
          </span>
        ) : (
          message.content
        )}
      </div>
      {message.actionResults && message.actionResults.length > 0 && (
        <div className="flex max-w-[92%] flex-col gap-1">
          {message.actionResults.map((r, i) => (
            <ActionResultBadge key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}
