'use client'

import { useEffect, useRef, useState } from 'react'
import ChatMessageBubble from './ChatMessageBubble'
import type { ChatMessage } from '@/lib/types'

export default function ChatPanel({
  open,
  onToggle,
  messages,
  sending,
  onSend,
}: {
  open: boolean
  onToggle: () => void
  messages: ChatMessage[]
  sending: boolean
  onSend: (text: string) => void
}) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight })
    }
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Open AI chat"
        className="flex h-full w-10 flex-col items-center justify-center gap-2 border border-line bg-base-panel/95 text-brand-blue shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-base-raised"
      >
        <span className="[writing-mode:vertical-rl] text-xs uppercase tracking-widest">AI Assistant</span>
      </button>
    )
  }

  return (
    <section className="flex h-full w-full flex-col border border-line border-l-brand-blue bg-base-alt/95 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-blue">AI Assistant</h2>
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">Ready</div>
        </div>
        <button type="button" onClick={onToggle} aria-label="Collapse AI chat" className="text-ink-faint hover:text-ink text-xs">
          x
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="rounded-sm border border-line bg-base/65 p-3">
            <p className="text-xs text-ink-faint">Portfolio analysis and order actions will appear here.</p>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessageBubble key={m.id} message={m} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-1.5 border-t border-line p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask FinAlly…"
          aria-label="Chat message"
          disabled={sending}
          className="min-w-0 flex-1 rounded-sm border border-line bg-base px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand-blue focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-sm bg-brand-purple px-3 py-1.5 text-sm font-semibold text-ink disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  )
}
