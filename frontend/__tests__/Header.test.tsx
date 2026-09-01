import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Header from '@/components/Header'

const currencies = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
]

describe('Header', () => {
  it('shows USD-only figures when the display currency is USD', () => {
    render(
      <Header
        totalValue={10000}
        cashBalance={5000}
        investedValue={5000}
        totalUnrealizedPnl={250}
        status="connected"
        displayCurrency="USD"
        currencies={currencies}
        rates={{ EUR: 0.92 }}
        onCurrencyChange={vi.fn()}
      />,
    )

    expect(screen.getAllByText('$10,000.00').length).toBeGreaterThan(0)
    expect(screen.getByText('+$250.00')).toBeInTheDocument()
  })

  it('renders dual-currency figures when a non-USD display currency is selected', () => {
    render(
      <Header
        totalValue={10000}
        cashBalance={5000}
        investedValue={5000}
        totalUnrealizedPnl={250}
        status="connected"
        displayCurrency="EUR"
        currencies={currencies}
        rates={{ EUR: 0.92 }}
        onCurrencyChange={vi.fn()}
      />,
    )

    expect(screen.getAllByText('$10,000.00 · €9,200.00').length).toBeGreaterThan(0)
    expect(screen.getByText('+$250.00 · €230.00')).toBeInTheDocument()
  })

  it('reflects the current value in the currency select and calls onCurrencyChange', async () => {
    const user = userEvent.setup()
    const onCurrencyChange = vi.fn()
    render(
      <Header
        totalValue={10000}
        cashBalance={5000}
        investedValue={5000}
        totalUnrealizedPnl={250}
        status="connected"
        displayCurrency="EUR"
        currencies={currencies}
        rates={{ EUR: 0.92 }}
        onCurrencyChange={onCurrencyChange}
      />,
    )

    const select = screen.getByLabelText('Display currency') as HTMLSelectElement
    expect(select.value).toBe('EUR')

    await user.selectOptions(select, 'USD')
    expect(onCurrencyChange).toHaveBeenCalledWith('USD')
  })
})
