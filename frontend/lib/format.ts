export function formatCurrency(value: number, currency: string = 'USD'): string {
  return value.toLocaleString('en-US', { style: 'currency', currency })
}

export function formatCurrencyCompact(value: number, currency: string = 'USD'): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatSignedCurrency(value: number, currency: string = 'USD'): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatCurrency(Math.abs(value), currency)}`
}

/**
 * Single choke point for dual-currency display: USD is always the ledger
 * currency, so this renders "$X · €Y" once a display currency and its rate
 * are available, and falls back to USD-only otherwise (USD selected, or
 * rates not loaded yet) — no component reimplements this fallback logic.
 */
export function formatDualCurrency(
  usdValue: number,
  displayCurrency: string,
  rates: Record<string, number> | null | undefined,
): string {
  const usdPart = formatCurrency(usdValue, 'USD')
  const rate = displayCurrency !== 'USD' ? rates?.[displayCurrency] : undefined
  if (!rate) return usdPart
  return `${usdPart} · ${formatCurrency(usdValue * rate, displayCurrency)}`
}

export function formatSignedDualCurrency(
  usdValue: number,
  displayCurrency: string,
  rates: Record<string, number> | null | undefined,
): string {
  const sign = usdValue > 0 ? '+' : usdValue < 0 ? '-' : ''
  return `${sign}${formatDualCurrency(Math.abs(usdValue), displayCurrency, rates)}`
}

export function formatQuantity(value: number): string {
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

export function formatClockTime(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
