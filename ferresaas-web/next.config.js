const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // Cache de assets estáticos (stale-while-revalidate)
    {
      urlPattern: /^https?.*\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    // Cache de API GET idempotentes (network-first con fallback)
    {
      urlPattern: /\/v1\/(exchange-rate|categories|brands|products)(\?.*)?$/i,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 },
        networkTimeoutSeconds: 10,
      },
    },
    // Páginas navegadas (network-first)
    {
      urlPattern: /^https?.*\/dashboard.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const apiOrigin = (() => {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';
  try {
    return new URL(rawUrl).origin;
  } catch {
    return 'http://localhost:3001';
  }
})();

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Content Security Policy (CSP) headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              `connect-src 'self' ${apiOrigin} http://localhost:3000`,
              "object-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
