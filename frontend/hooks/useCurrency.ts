'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { CurrencyMeta } from '@/lib/types'

// Backend refreshes rates every 45 min; this just polls often enough to pick
// that up without hammering the endpoint.
const RATES_POLL_MS = 10 * 60 * 1000

export function useCurrency() {
  const [currencies, setCurrencies] = useState<CurrencyMeta[]>([{ code: 'USD', name: 'US Dollar' }])
  const [displayCurrency, setDisplayCurrencyState] = useState('USD')
  const [rates, setRates] = useState<Record<string, number> | null>(null)

  const refreshRates = useCallback(async () => {
    try {
      const data = await api.getFxRates()
      setRates(data.rates)
    } catch {
      // Non-fatal: dual-currency display just stays on its last known rates.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [{ currencies: list }, pref] = await Promise.all([api.getFxCurrencies(), api.getDisplayCurrency()])
        if (cancelled) return
        setCurrencies(list)
        setDisplayCurrencyState(pref.display_currency)
      } catch {
        // Non-fatal: falls back to USD-only display.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    refreshRates()
    const id = window.setInterval(refreshRates, RATES_POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshRates])

  const setDisplayCurrency = useCallback(async (code: string) => {
    setDisplayCurrencyState(code)
    try {
      await api.setDisplayCurrency(code)
    } catch {
      // Optimistic update already applied locally; a failed PUT just means
      // the preference won't persist across a reload.
    }
  }, [])

  return { currencies, displayCurrency, setDisplayCurrency, rates }
}
