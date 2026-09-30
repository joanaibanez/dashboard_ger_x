import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/dashboard_ger_x' : '',
  images: { unoptimized: true },
}

export default nextConfig
