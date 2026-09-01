import { test, expect } from '@playwright/test'
import { cashValueLocator, positionRow, readCurrency, tradeFeedback, waitForPortfolioLoaded } from './fixtures'

async function trade(page: import('@playwright/test').Page, ticker: string, qty: string, side: 'Buy' | 'Sell') {
  await page.locator('#trade-ticker').fill(ticker)
  await page.locator('#trade-qty').fill(qty)
  await page.getByRole('button', { name: side, exact: true }).click()
  await expect(tradeFeedback(page)).toContainText(side === 'Buy' ? 'Bought' : 'Sold', { timeout: 10_000 })
}

// Order matters: this spec leaves an open AAPL position (qty 5) behind for
// 04-portfolio-viz.spec.ts to assert against.
test.describe('Trading', () => {
  test('buying AAPL decreases cash and creates a position', async ({ page }) => {
    await page.goto('/')
    await waitForPortfolioLoaded(page)
    const cashBefore = await readCurrency(cashValueLocator(page))

    await trade(page, 'AAPL', '10', 'Buy')

    const cashAfter = await readCurrency(cashValueLocator(page))
    expect(cashAfter).toBeLessThan(cashBefore)

    const row = positionRow(page, 'AAPL')
    await expect(row).toBeVisible()
    await expect(row).toContainText('10')
  })

  test('selling part of a position increases cash and updates quantity', async ({ page }) => {
    await page.goto('/')
    await waitForPortfolioLoaded(page)
    const cashBefore = await readCurrency(cashValueLocator(page))

    await trade(page, 'AAPL', '5', 'Sell')

    const cashAfter = await readCurrency(cashValueLocator(page))
    expect(cashAfter).toBeGreaterThan(cashBefore)

    await expect(positionRow(page, 'AAPL')).toContainText('5')
  })

  test('selling an entire position removes it from the table', async ({ page }) => {
    await page.goto('/')

    await trade(page, 'MSFT', '3', 'Buy')
    await expect(positionRow(page, 'MSFT')).toBeVisible()

    await trade(page, 'MSFT', '3', 'Sell')
    await expect(positionRow(page, 'MSFT')).toHaveCount(0)
  })
})
