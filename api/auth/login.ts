import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../_lib/database';
import { users } from '../_lib/schema';
import { eq } from 'drizzle-orm';
import { comparePasswords, generateToken } from '../_lib/auth';
import { closeConnection } from '../_lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    console.log(`Login attempt for username: ${username}`);

    // Find user by username
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = result[0];

    // Check if user exists
    if (!user) {
      console.log(`Login failed: User ${username} not found`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Check if password is correct
    const isPasswordValid = await comparePasswords(password, user.password);
    if (!isPasswordValid) {
      console.log(`Login failed: Invalid password for user ${username}`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    console.log(`Login successful for user ${username} (ID: ${user.id})`);

    // Generate JWT token
    const token = generateToken({ id: user.id, username: user.username });

    // Return user data and token (excluding password)
    const { password: _, ...userData } = user;
    
    // Set cookie with token - ensure it's properly configured
    const cookieMaxAge = 60 * 60 * 24 * 7; // 7 days in seconds
    const secure = process.env.NODE_ENV === 'production';
    
    res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${cookieMaxAge}${secure ? '; Secure' : ''}`);
    
    return res.status(200).json({
      user: userData,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('Error details:', errorMessage);
    console.error('Error stack:', errorStack);
    
    return res.status(500).json({
      message: 'Internal server error during login',
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