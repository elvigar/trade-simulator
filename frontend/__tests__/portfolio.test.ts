import { describe, expect, it } from 'vitest'
import { computePositionMetrics, computeSessionChangePercent, computeTotalValue } from '@/lib/portfolio'
import type { Position } from '@/lib/types'

describe('computePositionMetrics', () => {
  const position: Position = { ticker: 'AAPL', quantity: 10, avg_cost: 100 }

  it('uses the live SSE price when available', () => {
    const metrics = computePositionMetrics(position, 110)
    expect(metrics.currentPrice).toBe(110)
    expect(metrics.marketValue).toBe(1100)
    expect(metrics.unrealizedPnl).toBe(100)
    expect(metrics.unrealizedPnlPercent).toBeCloseTo(10)
  })

  it('falls back to the backend current_price when no live price is present', () => {
    const metrics = computePositionMetrics({ ...position, current_price: 120 }, undefined)
    expect(metrics.currentPrice).toBe(120)
    expect(metrics.unrealizedPnl).toBe(200)
  })

  it('falls back to avg_cost when nothing else is available', () => {
    const metrics = computePositionMetrics(position, undefined)
    expect(metrics.currentPrice).toBe(100)
    expect(metrics.unrealizedPnl).toBe(0)
    expect(metrics.unrealizedPnlPercent).toBe(0)
  })

  it('computes a loss correctly', () => {
    const metrics = computePositionMetrics(position, 90)
    expect(metrics.unrealizedPnl).toBe(-100)
    expect(metrics.unrealizedPnlPercent).toBeCloseTo(-10)
  })
})

describe('computeTotalValue', () => {
  it('sums cash and market value of all positions', () => {
    const metrics = [
      computePositionMetrics({ ticker: 'AAPL', quantity: 10, avg_cost: 100 }, 110),
      computePositionMetrics({ ticker: 'MSFT', quantity: 5, avg_cost: 400 }, 420),
    ]
    expect(computeTotalValue(5000, metrics)).toBe(5000 + 1100 + 2100)
  })

  it('returns cash balance alone with no positions', () => {
    expect(computeTotalValue(10000, [])).toBe(10000)
  })
})

describe('computeSessionChangePercent', () => {
  it('falls back to the backend-provided value before two SSE ticks exist', () => {
    expect(computeSessionChangePercent([], 1.23)).toBe(1.23)
    expect(computeSessionChangePercent([{ t: 1, price: 100 }], 1.23)).toBe(1.23)
  })

  it('defaults to 0 with no history and no fallback', () => {
    expect(computeSessionChangePercent([], undefined)).toBe(0)
  })

  it('computes change from the first accumulated point, not the latest tick delta', () => {
    const history = [
      { t: 1, price: 100 },
      { t: 2, price: 100.01 }, // a tiny tick-over-tick move
      { t: 3, price: 110 }, // but a meaningful move since page load
    ]
    expect(computeSessionChangePercent(history, undefined)).toBeCloseTo(10)
  })
})
