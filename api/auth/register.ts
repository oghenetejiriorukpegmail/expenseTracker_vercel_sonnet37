import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../_lib/database';
import { users } from '../_lib/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, generateToken } from '../_lib/auth';
import { closeConnection } from '../_lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { username, password, firstName, lastName, email, phoneNumber } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    console.log(`Registration attempt for username: ${username}, email: ${email || 'not provided'}`);

    // Check if username already exists
    const existingUser = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`Registration failed: Username ${username} already exists`);
      return res.status(409).json({ message: 'Username already exists' });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingEmail.length > 0) {
        console.log(`Registration failed: Email ${email} already exists`);
        return res.status(409).json({ message: 'Email already exists' });
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user with validated data
    const userData = {
      username,
      password: hashedPassword,
      firstName: firstName || '',
      lastName: lastName || '',
      email: email || '',
      phoneNumber: phoneNumber || '',
      createdAt: new Date(),
    };

    console.log(`Creating new user: ${username}`);
    
    try {
      const result = await db.insert(users).values(userData).returning();
      const newUser = result[0];
      
      console.log(`User created successfully: ${username} (ID: ${newUser.id})`);

      // Generate JWT token
      const token = generateToken({ id: newUser.id, username: newUser.username });

      // Return user data and token (excluding password)
      const { password: _, ...userDataResponse } = newUser;
      
      // Set cookie with token - ensure it's properly configured
      const cookieMaxAge = 60 * 60 * 24 * 7; // 7 days in seconds
      const secure = process.env.NODE_ENV === 'production';
      
      res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${cookieMaxAge}${secure ? '; Secure' : ''}`);
      
      return res.status(201).json({
        user: userDataResponse,
        token
      });
    } catch (dbError) {
      console.error('Database error during user creation:', dbError);
      return res.status(500).json({ message: 'Failed to create user account', error: dbError.message });
    }
  } catch (error) {
    console.error('Registration error:', error);
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('Error details:', errorMessage);
    console.error('Error stack:', errorStack);
    
    return res.status(500).json({
      message: 'Internal server error during registration',
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