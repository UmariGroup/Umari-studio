/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  allowedDevOrigins: ['http://127.0.0.1:3000', 'http://localhost:3000'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' }
        ]
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' }
        ]
      }
    ];
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  /* ✅ MUHIM QISM */
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;