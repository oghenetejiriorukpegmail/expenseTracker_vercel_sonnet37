import type { NextApiRequest, NextApiResponse } from 'next';
import type { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from './database';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import type { User } from './schema';

const scryptAsync = promisify(scrypt);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'expense-tracker-jwt-secret';
const JWT_EXPIRY = '7d'; // Token expires in 7 days

// Password hashing and comparison functions
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// JWT token generation
export function generateToken(user: { id: number; username: string }) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// JWT token verification
export function verifyToken(token: string): { id: number; username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; username: string };
  } catch (error) {
    return null;
  }
}

// Extract token from request
export function getTokenFromRequest(req: NextApiRequest | NextRequest): string | null {
  // For API routes
  if ('headers' in req) {
    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Also check cookies for token
    const cookies = req.cookies as { [key: string]: string };
    return cookies?.token || null;
  }
  
  // For middleware (NextRequest)
  if ('cookies' in req && typeof req.cookies.get === 'function') {
    const token = req.cookies.get('token');
    return token?.value || null;
  }
  
  return null;
}

// Authentication middleware for API routes
export async function authenticateUser(
  req: NextApiRequest
): Promise<User | null> {
  const token = getTokenFromRequest(req);
  
  if (!token) {
    return null;
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }
  
  try {
    // Get user from database
    const users_result = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);
    const user = users_result[0];
    
    if (!user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}

// Helper function to require authentication
export function requireAuth(handler: (req: NextApiRequest, res: NextApiResponse, user: User) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await authenticateUser(req);
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    return handler(req, res, user);
  };
}

// For Edge API Routes and Middleware
export async function authenticateUserEdge(req: NextRequest): Promise<User | null> {
  const token = getTokenFromRequest(req);
  
  if (!token) {
    return null;
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }
  
  try {
    // Get user from database
    const users_result = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);
    const user = users_result[0];
    
    if (!user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error authenticating user in edge function:', error);
    return null;
  }
}