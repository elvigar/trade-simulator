'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError, api } from '@/lib/api'
import type { WatchlistEntry } from '@/lib/types'

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.getWatchlist()
      setWatchlist(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load watchlist')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addTicker = useCallback(
    async (ticker: string) => {
      const normalized = ticker.trim().toUpperCase()
      if (!normalized) return
      try {
        await api.addWatchlistTicker(normalized)
        await refresh()
        return { ok: true as const }
      } catch (e) {
        const message = e instanceof ApiError ? e.message : 'Failed to add ticker'
        return { ok: false as const, message }
      }
    },
    [refresh],
  )

  const removeTicker = useCallback(
    async (ticker: string) => {
      try {
        await api.removeWatchlistTicker(ticker)
        await refresh()
        return { ok: true as const }
      } catch (e) {
        const message = e instanceof ApiError ? e.message : 'Failed to remove ticker'
        return { ok: false as const, message }
      }
    },
    [refresh],
  )

  return { watchlist, loading, error, refresh, addTicker, removeTicker }
}
