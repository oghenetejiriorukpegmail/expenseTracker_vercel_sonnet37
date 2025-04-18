import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('POST /api/auth/logout - Processing logout request');
    
    // Clear the token cookie with proper settings
    const secure = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
    
    console.log('POST /api/auth/logout - User logged out successfully');
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('Error details:', errorMessage);
    console.error('Error stack:', errorStack);
    
    return res.status(500).json({
      message: 'Internal server error during logout',
      error: errorMessage,
      // Only include stack trace in development
      ...(process.env.NODE_ENV !== 'production' && { stack: errorStack })
    });
  }
}