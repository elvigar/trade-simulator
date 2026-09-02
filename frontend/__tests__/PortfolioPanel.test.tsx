import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PortfolioPanel from '@/components/PortfolioPanel'
import { computePositionMetrics } from '@/lib/portfolio'

describe('PortfolioPanel', () => {
  it('shows an empty state with no positions', () => {
    render(<PortfolioPanel positions={[]} />)
    expect(screen.getByText(/No open positions yet/)).toBeInTheDocument()
    expect(screen.getByText(/No open positions. Place a trade/)).toBeInTheDocument()
  })

  it('defaults to the largest holding and shows its stats in the detail card', () => {
    const positions = [
      computePositionMetrics({ ticker: 'AAPL', quantity: 2, avg_cost: 100 }, 110),
      computePositionMetrics({ ticker: 'MSFT', quantity: 20, avg_cost: 400 }, 380),
    ]
    render(<PortfolioPanel positions={positions} />)

    expect(screen.getByText(/Showing MSFT/)).toBeInTheDocument()
    expect(screen.getAllByText('MSFT').length).toBeGreaterThan(0)
    expect(screen.getAllByText('-$400.00').length).toBeGreaterThan(0)
  })

  it('cross-filters: clicking a different position row updates the selection', async () => {
    const user = userEvent.setup()
    const positions = [
      computePositionMetrics({ ticker: 'AAPL', quantity: 2, avg_cost: 100 }, 110),
      computePositionMetrics({ ticker: 'MSFT', quantity: 20, avg_cost: 400 }, 380),
    ]
    render(<PortfolioPanel positions={positions} />)

    expect(screen.getByText(/Showing MSFT/)).toBeInTheDocument()

    const aaplRow = screen.getByText('AAPL').closest('tr')
    expect(aaplRow).not.toBeNull()
    await user.click(aaplRow as HTMLElement)

    expect(screen.getByText(/Showing AAPL/)).toBeInTheDocument()
    expect(screen.getAllByText('+$20.00').length).toBeGreaterThan(0)
  })
})
