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
}

module.exports = nextConfig

