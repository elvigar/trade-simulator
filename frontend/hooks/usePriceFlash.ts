'use client'

import { useEffect, useRef, useState } from 'react'
import type { Direction } from '@/lib/types'

const FLASH_DURATION_MS = 550

/**
 * Tracks a ticker's price across renders and returns 'up' | 'down' for
 * FLASH_DURATION_MS after the price actually changes, then settles back to
 * 'flat'. Consumers map the result to the flash-up/flash-down CSS animations.
 */
export function usePriceFlash(price: number | undefined): Direction {
  const [flash, setFlash] = useState<Direction>('flat')
  const prevPriceRef = useRef<number | undefined>(price)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (price === undefined) return
    const prev = prevPriceRef.current

    if (prev !== undefined && price !== prev) {
      setFlash(price > prev ? 'up' : 'down')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setFlash('flat'), FLASH_DURATION_MS)
    }

    prevPriceRef.current = price
  }, [price])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return flash
}
