import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver, which Recharts' ResponsiveContainer requires
// to measure its container on mount.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
