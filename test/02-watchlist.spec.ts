import { test, expect } from '@playwright/test'
import { watchlistRow } from './fixtures'

// Uses "DIS" (not a default ticker, and distinct from PYPL which the chat
// spec's watchlist-trigger fixture adds — avoids a duplicate_ticker clash).
const TICKER = 'DIS'

test.describe('Watchlist management', () => {
  test('adds and removes a ticker', async ({ page }) => {
    await page.goto('/')

    await expect(watchlistRow(page, TICKER)).toHaveCount(0)

    await page.getByLabel('Add ticker to watchlist').fill(TICKER)
    await page.getByRole('button', { name: 'Add' }).click()

    const row = watchlistRow(page, TICKER)
    await expect(row).toBeVisible()
    await expect(row).not.toContainText('—', { timeout: 10_000 })

    await page.getByLabel(`Remove ${TICKER} from watchlist`).click()
    await expect(row).toHaveCount(0)
  })
})
