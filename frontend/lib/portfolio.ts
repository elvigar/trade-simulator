import type { PricePoint } from '@/hooks/usePriceStream'
import type { Position } from './types'

/**
 * "Daily change %" per DECISIONS.md's "Price metrics semantics" is a
 * session-since-launch proxy, distinct from the SSE stream's tick-over-tick
 * change_percent. The backend anchors its session to process start; the
 * frontend anchors to page load using the same accumulated history the
 * sparklines already build, so the figure keeps live-updating without
 * extra polling. `fallback` (the backend's daily_change_percent from
 * GET /api/watchlist) covers the brief window before two SSE ticks exist.
 */
export function computeSessionChangePercent(history: PricePoint[], fallback: number | undefined): number {
  if (history.length < 2) return fallback ?? 0
  const first = history[0]?.price
  const last = history[history.length - 1]?.price
  if (!first || last === undefined) return fallback ?? 0
  return ((last - first) / first) * 100
}

export interface PositionMetrics {
  ticker: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
}

/**
 * Recomputes a position's live metrics from the SSE price cache rather than
 * trusting only the REST snapshot, so the UI stays live between portfolio
 * refetches. Falls back to the backend-provided current_price, then avg_cost,
 * if no live price has arrived yet for the ticker.
 */
export function computePositionMetrics(position: Position, livePrice: number | undefined): PositionMetrics {
  const currentPrice = livePrice ?? position.current_price ?? position.avg_cost
  const marketValue = position.quantity * currentPrice
  const costBasis = position.quantity * position.avg_cost
  const unrealizedPnl = marketValue - costBasis
  const unrealizedPnlPercent =
    position.avg_cost !== 0 ? ((currentPrice - position.avg_cost) / position.avg_cost) * 100 : 0

  return {
    ticker: position.ticker,
    quantity: position.quantity,
    avgCost: position.avg_cost,
    currentPrice,
    marketValue,
    unrealizedPnl,
    unrealizedPnlPercent,
  }
}

export function computeTotalValue(cashBalance: number, positions: PositionMetrics[]): number {
  return cashBalance + positions.reduce((sum, p) => sum + p.marketValue, 0)
}
