import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePriceFlash } from '@/hooks/usePriceFlash'

describe('usePriceFlash', () => {
  it('stays flat when the price does not change', () => {
    const { result } = renderHook(({ price }) => usePriceFlash(price), { initialProps: { price: 100 } })
    expect(result.current).toBe('flat')
  })

  it('flashes up when the price increases, then settles back to flat', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ price }) => usePriceFlash(price), { initialProps: { price: 100 } })

    rerender({ price: 105 })
    expect(result.current).toBe('up')

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(result.current).toBe('flat')
    vi.useRealTimers()
  })

  it('flashes down when the price decreases', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ price }) => usePriceFlash(price), { initialProps: { price: 100 } })

    rerender({ price: 95 })
    expect(result.current).toBe('down')

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(result.current).toBe('flat')
    vi.useRealTimers()
  })

  it('ignores an undefined price', () => {
    const { result, rerender } = renderHook(({ price }) => usePriceFlash(price), {
      initialProps: { price: undefined as number | undefined },
    })
    rerender({ price: undefined })
    expect(result.current).toBe('flat')
  })
})
