export type Direction = 'up' | 'down' | 'flat'

/** Matches backend/app/market/models.py PriceUpdate.to_dict(). */
export interface PriceUpdate {
  ticker: string
  price: number
  previous_price: number
  timestamp: number
  change: number
  change_percent: number
  direction: Direction
}

/** GET /api/watchlist entries — response is `{ watchlist: WatchlistEntry[] }`.
 * Backend embeds a point-in-time price snapshot too; the frontend prefers
 * the live SSE price cache for `price`/`change_percent` display and only
 * falls back to these fields before the first SSE tick arrives. */
export interface WatchlistEntry {
  ticker: string
  added_at?: string
  price?: number
  change?: number
  change_percent?: number
  /** Session-since-launch daily change %, per DECISIONS.md "Price metrics
   * semantics" — distinct from PriceUpdate's tick-over-tick change_percent. */
  daily_change_percent?: number
}

/** One row from GET /api/portfolio's `positions` array. */
export interface Position {
  ticker: string
  quantity: number
  avg_cost: number
  current_price?: number
  unrealized_pnl?: number
  unrealized_pnl_percent?: number
  market_value?: number
}

export interface Portfolio {
  cash_balance: number
  total_value: number
  positions: Position[]
}

export interface PortfolioSnapshot {
  total_value: number
  recorded_at: string
}

export type TradeSide = 'buy' | 'sell'

export interface TradeRequest {
  ticker: string
  side: TradeSide
  quantity: number
}

export interface TradeRecord {
  id?: string
  ticker: string
  side: TradeSide
  quantity: number
  price: number
  executed_at?: string
}

/** POST /api/portfolio/trade response envelope. */
export interface TradeResponse {
  trade: TradeRecord
  cash_balance: number
  position: Position | null
}

export interface ApiErrorBody {
  error_code: string
  message: string
}

export type WatchlistAction = 'add' | 'remove'

export interface WatchlistChangeRequest {
  ticker: string
  action: WatchlistAction
}

export interface ActionResult {
  type: 'trade' | 'watchlist'
  request: TradeRequest | WatchlistChangeRequest
  status: 'ok' | 'error'
  detail?: unknown
  error_code?: string | null
}

export interface ChatResponse {
  message: string
  trades_requested?: TradeRequest[]
  watchlist_changes_requested?: WatchlistChangeRequest[]
  action_results?: ActionResult[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actionResults?: ActionResult[]
  pending?: boolean
  isError?: boolean
}
