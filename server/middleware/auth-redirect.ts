import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to redirect authentication requests from Next.js API routes to Express routes
 * This helps resolve the conflict between the two authentication implementations
 */
export function authRedirectMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check if the request is for a Next.js auth route
  if (req.path.startsWith('/api/auth/')) {
    const endpoint = req.path.replace('/api/auth/', '');
    
    // Map Next.js auth routes to Express auth routes
    switch (endpoint) {
      case 'login':
        console.log('Redirecting from Next.js /api/auth/login to Express /api/login');
        req.url = '/api/login';
        break;
      case 'register':
        console.log('Redirecting from Next.js /api/auth/register to Express /api/register');
        req.url = '/api/register';
        break;
      case 'logout':
        console.log('Redirecting from Next.js /api/auth/logout to Express /api/logout');
        req.url = '/api/logout';
        break;
      case 'update-profile':
        console.log('Redirecting from Next.js /api/auth/update-profile to Express /api/profile');
        req.url = '/api/profile';
        req.method = 'PUT'; // Ensure the method is PUT for profile updates
        break;
      case 'change-password':
        console.log('Redirecting from Next.js /api/auth/change-password to Express /api/profile/change-password');
        req.url = '/api/profile/change-password';
        break;
      case 'user':
        console.log('Redirecting from Next.js /api/auth/user to Express /api/user');
        req.url = '/api/user';
        break;
      default:
        // For any other auth routes, continue to Next.js handler
        return next();
    }
  }
  
  next();
}