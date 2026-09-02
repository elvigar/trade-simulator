import { test, expect } from '@playwright/test'

// Depends on 03-trading.spec.ts having left an open AAPL position behind so
// the heatmap and P&L chart have non-empty data to render.
test.describe('Portfolio visualization', () => {
  test('heatmap renders colored cells for open positions', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('No open positions yet.')).toHaveCount(0)

    // Recharts Treemap draws one <rect fill="hsl(...)"> per position, colored
    // by P&L (PortfolioHeatmap.tsx pnlColor()).
    const cells = page.locator('svg rect[fill^="hsl("]')
    await expect(cells.first()).toBeVisible()
  })

  test('P&L chart shows a value line with data points', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Snapshots will appear as trades happen and time passes.')).toHaveCount(0)

    // Recharts <Line> renders its curve as an SVG path with this class.
    const line = page.getByTestId('pnl-chart').locator('svg path.recharts-line-curve')
    await expect(line).toBeVisible()
  })

  test('positions table lists the open AAPL position with metrics', async ({ page }) => {
    await page.goto('/')
    const row = page.locator('table tbody tr').filter({ has: page.locator('td:text-is("AAPL")') })
    await expect(row).toBeVisible()
    // Ticker, qty, avg cost, price, market value, P&L $, P&L % — seven cells.
    await expect(row.locator('td')).toHaveCount(7)
  })
})
