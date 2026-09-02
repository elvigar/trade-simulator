'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PriceUpdate } from '@/lib/types'

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export interface PricePoint {
  t: number
  price: number
}

const MAX_HISTORY_POINTS = 400
// Connection-status timeout rule (documented, per PLAN.md section 4):
//   - "connected"    while messages keep arriving and the browser hasn't errored.
//   - "reconnecting" once >STALE_MS has passed since the last message (watchdog,
//     covers silent stalls the browser hasn't noticed yet) OR EventSource fires
//     onerror while its readyState is CONNECTING (the browser's own auto-retry).
//   - "disconnected" only once EventSource.readyState is CLOSED — i.e. the
//     browser has given up retrying entirely.
const STALE_MS = 3000
const WATCHDOG_INTERVAL_MS = 1000

export function usePriceStream(url = '/api/stream/prices') {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({})
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting')
  const [historyVersion, setHistoryVersion] = useState(0)
  const historyRef = useRef<Record<string, PricePoint[]>>({})
  const lastMessageRef = useRef<number>(Date.now())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      return
    }

    const es = new EventSource(url)

    es.onopen = () => {
      lastMessageRef.current = Date.now()
      setStatus('connected')
    }

    es.onmessage = (evt: MessageEvent<string>) => {
      lastMessageRef.current = Date.now()
      setStatus('connected')
      try {
        const data: Record<string, PriceUpdate> = JSON.parse(evt.data)
        setPrices((prev) => ({ ...prev, ...data }))
        for (const ticker of Object.keys(data)) {
          const update = data[ticker]
          if (!update) continue
          const arr = historyRef.current[ticker] ?? []
          arr.push({ t: update.timestamp, price: update.price })
          if (arr.length > MAX_HISTORY_POINTS) arr.shift()
          historyRef.current[ticker] = arr
        }
        setHistoryVersion((v) => v + 1)
      } catch {
        // Ignore malformed SSE payloads rather than tearing down the stream.
      }
    }

    es.onerror = () => {
      setStatus(es.readyState === EventSource.CLOSED ? 'disconnected' : 'reconnecting')
    }

    const watchdog = window.setInterval(() => {
      if (Date.now() - lastMessageRef.current > STALE_MS) {
        setStatus((prev) => (prev === 'disconnected' ? prev : 'reconnecting'))
      }
    }, WATCHDOG_INTERVAL_MS)

    return () => {
      window.clearInterval(watchdog)
      es.close()
    }
  }, [url])

  const getHistory = useCallback(
    (ticker: string): PricePoint[] => historyRef.current[ticker] ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyVersion],
  )

  return { prices, status, getHistory, historyVersion }
}
