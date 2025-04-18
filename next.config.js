/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes configuration
  async rewrites() {
    // Determine the API base URL based on environment
    const apiBaseUrl = process.env.NODE_ENV === 'production'
      ? '/api' // Use relative URL in production
      : 'http://localhost:5000/api'; // Use localhost in development
      
    return [
      // Forward all API requests to Express server
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
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