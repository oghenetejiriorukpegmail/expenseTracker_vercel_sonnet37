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

    // Find user by username
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = result[0];

    // Check if user exists and password is correct
    if (!user || !(await comparePasswords(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = generateToken({ id: user.id, username: user.username });

    // Return user data and token (excluding password)
    const { password: _, ...userData } = user;
    
    // Set cookie with token
    res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`); // 7 days
    
    return res.status(200).json({ 
      user: userData,
      token 
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}