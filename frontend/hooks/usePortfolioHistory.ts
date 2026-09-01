'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { PortfolioSnapshot } from '@/lib/types'

const POLL_INTERVAL_MS = 15000

export function usePortfolioHistory() {
  const [history, setHistory] = useState<PortfolioSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.getPortfolioHistory()
      setHistory(data)
    } catch {
      // Non-fatal: the P&L chart just stays on its last known data.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  return { history, loading, refresh }
}
