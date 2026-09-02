import { test, expect } from '@playwright/test'
import { DEFAULT_TICKERS, cashValueLocator, connectionStatusLocator, watchlistRow } from './fixtures'

test.describe('Fresh start', () => {
  test('shows default watchlist, $10,000 cash, and streaming prices', async ({ page }) => {
    await page.goto('/')

    for (const ticker of DEFAULT_TICKERS) {
      await expect(watchlistRow(page, ticker)).toBeVisible()
    }

    await expect(cashValueLocator(page)).toHaveText('$10,000.00')

    await expect(connectionStatusLocator(page)).toHaveAttribute(
      'aria-label',
      'Market data: Connected',
      { timeout: 15_000 },
    )

    // First SSE batch should replace the "—" price placeholder.
    const firstRow = watchlistRow(page, DEFAULT_TICKERS[0])
    await expect(firstRow).not.toContainText('—', { timeout: 10_000 })

    // Prices genuinely stream (simulator updates ~every 500ms) rather than
    // being a static snapshot rendered once.
    const initial = await firstRow.textContent()
    await expect
      .poll(async () => (await firstRow.textContent()) !== initial, {
        timeout: 8_000,
        intervals: [500],
      })
      .toBe(true)
  })
})
