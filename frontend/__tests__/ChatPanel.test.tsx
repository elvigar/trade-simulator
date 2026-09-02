import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ChatPanel from '@/components/ChatPanel'
import type { ChatMessage } from '@/lib/types'

describe('ChatPanel', () => {
  it('shows a collapsed toggle button when closed', () => {
    render(<ChatPanel open={false} onToggle={vi.fn()} messages={[]} sending={false} onSend={vi.fn()} />)
    expect(screen.getByLabelText('Open AI chat')).toBeInTheDocument()
  })

  it('renders conversation history and action result badges', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Buy 10 AAPL' },
      {
        id: '2',
        role: 'assistant',
        content: 'Done, bought 10 AAPL.',
        actionResults: [
          { type: 'trade', request: { ticker: 'AAPL', side: 'buy', quantity: 10 }, status: 'ok' },
        ],
      },
    ]
    render(<ChatPanel open onToggle={vi.fn()} messages={messages} sending={false} onSend={vi.fn()} />)
    expect(screen.getByText('Buy 10 AAPL')).toBeInTheDocument()
    expect(screen.getByText('Done, bought 10 AAPL.')).toBeInTheDocument()
    expect(screen.getByText(/buy 10 AAPL/)).toBeInTheDocument()
  })

  it('shows a loading indicator for a pending assistant message', () => {
    const messages: ChatMessage[] = [{ id: '1', role: 'assistant', content: '', pending: true }]
    render(<ChatPanel open onToggle={vi.fn()} messages={messages} sending onSend={vi.fn()} />)
    expect(screen.getByLabelText('AI is thinking')).toBeInTheDocument()
  })

  it('sends a message and clears the input', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatPanel open onToggle={vi.fn()} messages={[]} sending={false} onSend={onSend} />)

    const input = screen.getByLabelText('Chat message') as HTMLInputElement
    await user.type(input, 'What is my portfolio worth?')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(onSend).toHaveBeenCalledWith('What is my portfolio worth?')
    expect(input.value).toBe('')
  })
})
