/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes configuration
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:5000/api/auth/:path*', // Forward auth requests to Express server
      },
      {
        source: '/api/trips/:path*',
        destination: 'http://localhost:5000/api/trips/:path*', // Forward trips requests to Express server
      },
      {
        source: '/api/expenses/:path*',
        destination: 'http://localhost:5000/api/expenses/:path*', // Forward expenses requests to Express server
      },
      {
        source: '/api/profile/:path*',
        destination: 'http://localhost:5000/api/profile/:path*', // Forward profile requests to Express server
      },
      // Keep Next.js API routes working for other paths
      {
        source: '/api/:path*',
        destination: '/api/:path*',
        has: [
          {
            type: 'header',
            key: 'x-use-nextjs',
            value: '1',
          },
        ],
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

export default nextConfig;