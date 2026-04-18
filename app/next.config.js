/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use 'export' for Tauri builds (static), 'standalone' for Docker
  output: process.env.TAURI_BUILD === 'true' ? 'export' : 'standalone',
  // Required for static export with images
  ...(process.env.TAURI_BUILD === 'true' && {
    images: {
      unoptimized: true,
    },
  }),
  // Proxy /api/* to the backend so cookies are same-origin (fixes cross-origin Set-Cookie).
  // Skipped for Tauri static builds (no Next.js server to proxy through).
  // API_PROXY_URL is server-only so it can point to a container-internal host
  // (e.g. http://api:8000 in Docker) while NEXT_PUBLIC_API_URL stays browser-reachable.
  async rewrites() {
    if (process.env.TAURI_BUILD === 'true') return []
    const apiUrl =
      process.env.API_PROXY_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig

