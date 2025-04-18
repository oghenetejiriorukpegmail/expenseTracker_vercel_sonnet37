import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { closeConnection } from '../_lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('GET /api/auth/user - Authenticating user');
    
    // Authenticate user
    const user = await authenticateUser(req);
    
    if (!user) {
      console.log('GET /api/auth/user - Authentication failed: No valid user found');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log(`GET /api/auth/user - Authentication successful for user: ${user.username} (ID: ${user.id})`);

    // Return user data (excluding password)
    const { password, ...userData } = user;
    
    return res.status(200).json(userData);
  } catch (error) {
    console.error('Get user error:', error);
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('Error details:', errorMessage);
    console.error('Error stack:', errorStack);
    
    return res.status(500).json({
      message: 'Internal server error while retrieving user data',
      error: errorMessage,
      // Only include stack trace in development
      ...(process.env.NODE_ENV !== 'production' && { stack: errorStack })
    });
  } finally {
    try {
      // Close database connection in production, passing the request object
      await closeConnection(req);
    } catch (closeError) {
      console.error('Error closing database connection:', closeError);
    }
  }
}