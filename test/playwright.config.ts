import { defineConfig, devices } from '@playwright/test'

/**
 * FinAlly E2E suite (PLAN.md section 12). Runs serially against a single
 * shared app instance / SQLite DB — tests are ordered (numeric file
 * prefixes) and some intentionally build on state left by earlier tests
 * (e.g. 03-trading leaves an open AAPL position for 04-portfolio-viz).
 * Do not parallelize workers or reorder files without checking dependencies
 * in each spec's top comment.
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
