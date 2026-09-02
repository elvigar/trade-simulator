import { test, expect } from '@playwright/test'
import { connectionStatusLocator } from './fixtures'

test.describe('SSE resilience', () => {
  // Note: `context.setOffline(true)` does NOT interrupt an already-open SSE
  // response on Chromium/loopback — data kept flowing to the client and the
  // status stayed "Connected" (verified locally). Instead, block the stream
  // endpoint via route interception *before* the connection is ever made to
  // simulate an outage, then unblock it and rely on EventSource's native
  // retry (server sends "retry: 1000") to recover — this is reliably
  // controllable from the client side in both local and Docker Compose runs.
  test('shows disconnected status during an outage and recovers once available', async ({ page }) => {
    await page.route('**/api/stream/prices', (route) => route.abort())
    await page.goto('/')

    await expect(connectionStatusLocator(page)).not.toHaveAttribute(
      'aria-label',
      'Market data: Connected',
      { timeout: 8_000 },
    )

    await page.unroute('**/api/stream/prices')
    await expect(connectionStatusLocator(page)).toHaveAttribute(
      'aria-label',
      'Market data: Connected',
      { timeout: 15_000 },
    )
  })
})
