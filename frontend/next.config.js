const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

/** @param {string} phase */
module.exports = (phase) => {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    output: 'export',
    images: { unoptimized: true },
    ...(isDevServer
      ? {
          // `compress: false` is required for local dev: Next's dev server gzips
          // proxied responses by default, and that compression middleware buffers
          // the entire body before flushing — which silently breaks SSE streaming
          // through the /api/* rewrite below (EventSource opens fine, but no
          // `message` events ever fire until the connection eventually closes).
          // Confirmed via a raw fetch() reader: zero chunks arrive in 3.5s with
          // compression on, chunks arrive every ~500ms with it off. Static export
          // builds don't run this server at all, so this has no production impact.
          compress: false,
          async rewrites() {
            return [
              {
                source: '/api/:path*',
                destination: 'http://localhost:8000/api/:path*',
              },
            ]
          },
        }
      : {}),
  }

  return nextConfig
}
