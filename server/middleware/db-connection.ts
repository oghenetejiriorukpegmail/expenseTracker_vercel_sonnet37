import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to handle database connections properly
 * This prevents the issue of database connections being closed prematurely
 * in the Next.js API routes
 */
export function dbConnectionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check if the request is for a Next.js API route
  if (req.path.startsWith('/api/auth/') ||
      req.path.startsWith('/api/expenses/') ||
      req.path.startsWith('/api/trips/') ||
      req.path.startsWith('/api/mileage-logs/') ||
      req.path.startsWith('/api/ocr/') ||
      req.path.startsWith('/api/settings/')) {
    
    // Log that we're handling a Next.js API route
    console.log(`Handling Next.js API route: ${req.path}`);
    
    // Set a flag on the request object to prevent automatic connection closing
    // This will be checked in the closeConnection function in database.ts
    (req as any).__preventAutoConnectionClose = true;
    
    // Ensure connection is properly closed after response is sent
    res.on('finish', () => {
      // The connection will be managed by the Express server's connection pool
      console.log(`Finished handling Next.js API route: ${req.path}`);
    });
  }
  
  next();
}