import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PositionsTable from '@/components/PositionsTable'
import { computePositionMetrics } from '@/lib/portfolio'

describe('PositionsTable', () => {
  it('shows an empty state with no positions', () => {
    render(<PositionsTable positions={[]} />)
    expect(screen.getByText(/No open positions/)).toBeInTheDocument()
  })

  it('renders computed metrics for each position', () => {
    const metrics = [
      computePositionMetrics({ ticker: 'AAPL', quantity: 10, avg_cost: 100 }, 110),
      computePositionMetrics({ ticker: 'MSFT', quantity: 2, avg_cost: 400 }, 380),
    ]
    render(<PositionsTable positions={metrics} />)

    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('MSFT')).toBeInTheDocument()
    expect(screen.getByText('+$100.00')).toBeInTheDocument()
    expect(screen.getByText('-$40.00')).toBeInTheDocument()
  })
})
