import { test, expect } from '@playwright/test'
import { CHAT_PROMPTS, actionBadges, sendChat, watchlistRow } from './fixtures'

// Exercises every LLM_MOCK=true fixture in backend/app/llm/mock.py. Chat
// history isn't restored on reload (backend-only persistence per
// DECISIONS.md), so each test starts from a clean message list via
// page.goto('/'). "watchlist" trigger is reserved here for PYPL — the
// manual watchlist spec (02) uses a different ticker to avoid a
// duplicate_ticker collision if these ever run out of order.
test.describe('AI chat assistant (LLM_MOCK)', () => {
  test('portfolio question returns analysis with no actions', async ({ page }) => {
    await page.goto('/')
    await sendChat(page, CHAT_PROMPTS.other)

    await expect(page.getByText(/diversified/i)).toBeVisible({ timeout: 10_000 })
    await expect(actionBadges(page)).toHaveCount(0)
  })

  test('buy trigger executes a buy trade inline', async ({ page }) => {
    await page.goto('/')
    await sendChat(page, CHAT_PROMPTS.buy)

    await expect(page.getByText('Buying 10 shares of AAPL.')).toBeVisible({ timeout: 10_000 })
    const badge = actionBadges(page).first()
    await expect(badge).toContainText(/buy 10 aapl/i)
    await expect(badge).toContainText('✓')
  })

  test('sell trigger executes a sell trade inline', async ({ page }) => {
    await page.goto('/')
    await sendChat(page, CHAT_PROMPTS.sell)

    await expect(page.getByText('Selling 5 shares of AAPL.')).toBeVisible({ timeout: 10_000 })
    const badge = actionBadges(page).first()
    await expect(badge).toContainText(/sell 5 aapl/i)
    await expect(badge).toContainText('✓')
  })

  test('watchlist trigger adds PYPL inline and to the watchlist panel', async ({ page }) => {
    await page.goto('/')
    await sendChat(page, CHAT_PROMPTS.watchlist)

    await expect(page.getByText('Added PYPL to your watchlist.')).toBeVisible({ timeout: 10_000 })
    const badge = actionBadges(page).first()
    await expect(badge).toContainText(/add pypl/i)
    await expect(badge).toContainText('✓')
    await expect(watchlistRow(page, 'PYPL')).toBeVisible()
  })

  test('insufficient-cash trigger surfaces an error result inline', async ({ page }) => {
    await page.goto('/')
    await sendChat(page, CHAT_PROMPTS.insufficient)

    await expect(page.getByText('Buying 100,000 shares of NVDA as requested.')).toBeVisible({ timeout: 10_000 })
    const badge = actionBadges(page).first()
    await expect(badge).toContainText(/buy 100000 nvda/i)
    await expect(badge).toContainText('✕')
    await expect(badge).toContainText('insufficient_cash')
  })
})
