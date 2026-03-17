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

  /* ✅ IMAGE UPLOAD SIZE LIMITS
   * IMPORTANT: Set these environment variables during deployment/runtime:
   * 
   * NODE_OPTIONS="--max-http-header-size=16384 --max-body-size=52428800"
   * 
   * Or use nginx/reverse proxy with appropriate body_size settings:
   * client_max_body_size 50m;
   * 
   * Default limits in Node.js are ~1MB. Images are compressed on client (JPEG 75% quality)
   * to reduce payload size, but server should allow up to 50MB just in case.
   */

  /* ✅ MUHIM QISM */
  images: {
    unoptimized: true,
  },

  /* Increase request body size for image uploads (experimental) */
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

module.exports = nextConfig;