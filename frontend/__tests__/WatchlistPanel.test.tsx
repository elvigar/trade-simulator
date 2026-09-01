import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import WatchlistPanel from '@/components/WatchlistPanel'
import type { PriceUpdate, WatchlistEntry } from '@/lib/types'

const watchlist: WatchlistEntry[] = [{ ticker: 'AAPL' }, { ticker: 'MSFT' }]

const prices: Record<string, PriceUpdate> = {
  AAPL: { ticker: 'AAPL', price: 190.5, previous_price: 189.0, timestamp: 1, change: 1.5, change_percent: 0.79, direction: 'up' },
  MSFT: { ticker: 'MSFT', price: 420.0, previous_price: 421.0, timestamp: 1, change: -1, change_percent: -0.24, direction: 'down' },
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof WatchlistPanel>> = {}) {
  const onSelect = vi.fn()
  const onAdd = vi.fn().mockResolvedValue({ ok: true })
  const onRemove = vi.fn()
  const utils = render(
    <WatchlistPanel
      watchlist={watchlist}
      prices={prices}
      getHistory={() => []}
      selectedTicker={null}
      onSelect={onSelect}
      onAdd={onAdd}
      onRemove={onRemove}
      {...overrides}
    />,
  )
  return { onSelect, onAdd, onRemove, ...utils }
}

describe('WatchlistPanel', () => {
  it('renders each ticker with its live price', () => {
    renderPanel()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('MSFT')).toBeInTheDocument()
    expect(screen.getByText('$190.50')).toBeInTheDocument()
    expect(screen.getByText('$420.00')).toBeInTheDocument()
  })

  it('selects a ticker when its row is clicked', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPanel()
    await user.click(screen.getByTestId('watchlist-row-AAPL'))
    expect(onSelect).toHaveBeenCalledWith('AAPL')
  })

  it('removes a ticker when its remove button is clicked', async () => {
    const user = userEvent.setup()
    const { onRemove } = renderPanel()
    await user.click(screen.getByLabelText('Remove AAPL from watchlist'))
    expect(onRemove).toHaveBeenCalledWith('AAPL')
  })

  it('adds a ticker via the input form', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderPanel()
    await user.type(screen.getByLabelText('Add ticker to watchlist'), 'nflx')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('nflx'))
  })

  it('shows an error message when adding fails', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue({ ok: false, message: 'duplicate ticker' })
    renderPanel({ onAdd })
    await user.type(screen.getByLabelText('Add ticker to watchlist'), 'AAPL')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('duplicate ticker')).toBeInTheDocument()
  })
})
