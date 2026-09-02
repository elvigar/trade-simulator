import type {
  ApiErrorBody,
  ChatResponse,
  CurrencyMeta,
  DisplayCurrencyPreference,
  FxRates,
  Portfolio,
  PortfolioSnapshot,
  TradeRequest,
  TradeResponse,
  WatchlistEntry,
} from './types'

export class ApiError extends Error {
  errorCode: string
  status: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || 'Request failed')
    this.name = 'ApiError'
    this.errorCode = body.error_code || 'unknown_error'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })

  if (!res.ok) {
    let body: ApiErrorBody
    try {
      body = (await res.json()) as ApiErrorBody
    } catch {
      body = { error_code: 'unknown_error', message: res.statusText || 'Request failed' }
    }
    throw new ApiError(res.status, body)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

export const api = {
  getPortfolio: () => request<Portfolio>('/portfolio'),
  getPortfolioHistory: () =>
    request<{ snapshots: PortfolioSnapshot[] }>('/portfolio/history').then((r) => r.snapshots),
  trade: (body: TradeRequest) =>
    request<TradeResponse>('/portfolio/trade', { method: 'POST', body: JSON.stringify(body) }),
  getWatchlist: () => request<{ watchlist: WatchlistEntry[] }>('/watchlist').then((r) => r.watchlist),
  addWatchlistTicker: (ticker: string) =>
    request<WatchlistEntry>('/watchlist', { method: 'POST', body: JSON.stringify({ ticker }) }),
  removeWatchlistTicker: (ticker: string) =>
    request<void>(`/watchlist/${encodeURIComponent(ticker)}`, { method: 'DELETE' }),
  sendChatMessage: (message: string) =>
    request<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  getFxCurrencies: () => request<{ currencies: CurrencyMeta[]; default: string }>('/fx/currencies'),
  getFxRates: () => request<FxRates>('/fx/rates'),
  getDisplayCurrency: () => request<DisplayCurrencyPreference>('/fx/preference'),
  setDisplayCurrency: (code: string) =>
    request<DisplayCurrencyPreference>('/fx/preference', {
      method: 'PUT',
      body: JSON.stringify({ display_currency: code }),
    }),
}
