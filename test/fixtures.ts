import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** Default seed watchlist (PLAN.md section 7 / backend/app/market/seed_prices.py). */
export const DEFAULT_TICKERS = [
  'AAPL',
  'GOOGL',
  'MSFT',
  'AMZN',
  'TSLA',
  'NVDA',
  'META',
  'JPM',
  'V',
  'NFLX',
]

/**
 * LLM_MOCK=true trigger keywords (backend/app/llm/mock.py), case-insensitive
 * substring match, first match wins: insufficient -> sell -> buy -> watchlist -> other.
 * "watchlist" is reserved here for the chat spec (adds PYPL) — the manual
 * watchlist spec uses a different ticker to avoid a duplicate_ticker collision.
 */
export const CHAT_PROMPTS = {
  insufficient: 'This is an insufficient cash test, please buy a huge amount.',
  sell: 'Please sell some of my shares.',
  buy: 'Please buy some shares for me.',
  watchlist: 'Please update my watchlist.',
  other: 'How is my portfolio looking today?',
}

export function watchlistRow(page: Page, ticker: string): Locator {
  return page.getByTestId(`watchlist-row-${ticker}`)
}

export function cashValueLocator(page: Page): Locator {
  return page.locator('header div:text-is("Cash") + div')
}

export function totalValueLocator(page: Page): Locator {
  return page.locator('header div:text-is("Total Value") + div')
}

export function connectionStatusLocator(page: Page): Locator {
  return page.locator('[aria-label^="Market data:"]')
}

export function positionRow(page: Page, ticker: string): Locator {
  return page.locator('table tbody tr').filter({ has: page.locator(`td:text-is("${ticker}")`) })
}

export function tradeFeedback(page: Page): Locator {
  return page.locator('section', { has: page.locator('#trade-ticker') }).getByRole('status')
}

export function chatSection(page: Page): Locator {
  return page.locator('section', { has: page.getByLabel('Chat message') })
}

/** ActionResultBadge divs (backend/app/llm action_results rendered inline). */
export function actionBadges(page: Page): Locator {
  return chatSection(page).locator('.border-up\\/40, .border-down\\/40')
}

export async function sendChat(page: Page, text: string): Promise<void> {
  const input = page.getByLabel('Chat message')
  await input.fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

/** Parses a formatted currency string like "$10,000.00" into a number. */
export function parseCurrency(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ''))
}

export async function readCurrency(locator: Locator): Promise<number> {
  const text = await locator.textContent()
  return parseCurrency(text ?? '')
}

/**
 * Header renders cash as $0.00 until GET /api/portfolio resolves
 * (portfolio?.cash_balance ?? 0). Callers that read a "before" balance right
 * after navigation must wait past that placeholder first.
 */
export async function waitForPortfolioLoaded(page: Page): Promise<void> {
  await expect(cashValueLocator(page)).not.toHaveText('$0.00')
}
