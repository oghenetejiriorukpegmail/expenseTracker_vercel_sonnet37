/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Configure redirects to maintain compatibility with old routes
  async redirects() {
    return [
      {
        source: '/api/auth/login',
        destination: '/api/auth/login',
        permanent: true,
      },
      {
        source: '/api/auth/register',
        destination: '/api/auth/register',
        permanent: true,
      },
      {
        source: '/api/auth/logout',
        destination: '/api/auth/logout',
        permanent: true,
      },
    ];
  },
  // Configure headers for security
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  // Configure environment variables to be exposed to the browser
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
  },
};

module.exports = nextConfig;