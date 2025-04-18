import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to ensure all authentication responses are in JSON format
 * This prevents the issue of authentication endpoints returning HTML instead of JSON
 */
export function jsonResponseMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only apply to authentication routes
  if (
    req.path.startsWith('/api/login') || 
    req.path.startsWith('/api/register') || 
    req.path.startsWith('/api/logout') || 
    req.path.startsWith('/api/user') ||
    req.path.startsWith('/api/profile')
  ) {
    // Store the original send method
    const originalSend = res.send;
    
    // Override the send method
    res.send = function(body) {
      // If the response is HTML (string that starts with <!DOCTYPE or <html)
      if (typeof body === 'string' && 
          (body.trim().startsWith('<!DOCTYPE') || body.trim().startsWith('<html'))) {
        console.warn('Intercepted HTML response from auth endpoint, converting to JSON');
        
        // Convert to JSON error response
        res.status(500).json({
          error: 'Authentication system error',
          message: 'The server attempted to return HTML instead of JSON. This has been intercepted.'
        });
        return res;
      }
      
      // Otherwise, proceed with the original send
      return originalSend.call(this, body);
    };
  }
  
  next();
}