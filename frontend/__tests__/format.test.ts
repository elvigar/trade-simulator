import { describe, expect, it } from 'vitest'
import { formatDualCurrency, formatSignedDualCurrency } from '@/lib/format'

const RATES = { EUR: 0.92, GBP: 0.79 }

describe('formatDualCurrency', () => {
  it('returns USD-only when the display currency is USD', () => {
    expect(formatDualCurrency(100, 'USD', RATES)).toBe('$100.00')
  })

  it('returns USD-only when rates have not loaded yet', () => {
    expect(formatDualCurrency(100, 'EUR', null)).toBe('$100.00')
    expect(formatDualCurrency(100, 'EUR', undefined)).toBe('$100.00')
  })

  it('returns USD-only when the display currency has no rate', () => {
    expect(formatDualCurrency(100, 'CHF', RATES)).toBe('$100.00')
  })

  it('renders the "$X · €Y" shape when a rate is available', () => {
    expect(formatDualCurrency(100, 'EUR', RATES)).toBe('$100.00 · €92.00')
  })

  it('never throws or shows NaN for zero or negative values', () => {
    expect(formatDualCurrency(0, 'EUR', RATES)).toBe('$0.00 · €0.00')
    expect(() => formatDualCurrency(-50, 'EUR', RATES)).not.toThrow()
    expect(formatDualCurrency(-50, 'EUR', RATES)).not.toContain('NaN')
  })
})

describe('formatSignedDualCurrency', () => {
  it('prefixes a plus sign and converts positive values', () => {
    expect(formatSignedDualCurrency(100, 'EUR', RATES)).toBe('+$100.00 · €92.00')
  })

  it('prefixes a minus sign and converts negative values', () => {
    expect(formatSignedDualCurrency(-100, 'EUR', RATES)).toBe('-$100.00 · €92.00')
  })

  it('has no sign for zero', () => {
    expect(formatSignedDualCurrency(0, 'EUR', RATES)).toBe('$0.00 · €0.00')
  })

  it('falls back to USD-only when rates are missing', () => {
    expect(formatSignedDualCurrency(100, 'EUR', null)).toBe('+$100.00')
  })
})
