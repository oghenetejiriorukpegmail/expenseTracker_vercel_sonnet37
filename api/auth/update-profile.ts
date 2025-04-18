import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { db } from '../_lib/database';
import { users } from '../_lib/schema';
import { eq } from 'drizzle-orm';
import { closeConnection } from '../_lib/database';
import { z } from 'zod';

// Define validation schema
const profileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name cannot be empty").default(''),
  lastName: z.string().optional().default(''),
  phoneNumber: z.string().optional().default(''),
  email: z.string().email("Invalid email address"),
  bio: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow PUT requests
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await authenticateUser(req);
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Validate input
    let validatedData;
    try {
      validatedData = profileUpdateSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      throw error;
    }

    // Check if email is already taken by another user
    if (validatedData.email) {
      const existingUserByEmail = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.email, validatedData.email))
        .limit(1);
      
      if (existingUserByEmail.length > 0 && existingUserByEmail[0].id !== user.id) {
        return res.status(409).json({ message: 'Email already in use by another account' });
      }
    }

    // Update user profile
    const result = await db.update(users)
      .set({
        firstName: validatedData.firstName,
        lastName: validatedData.lastName || '',
        phoneNumber: validatedData.phoneNumber || '',
        email: validatedData.email,
        bio: validatedData.bio || null,
      })
      .where(eq(users.id, user.id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return updated user data (excluding password)
    const { password: _, ...updatedUserData } = result[0];
    
    return res.status(200).json(updatedUserData);
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production, passing the request object
    await closeConnection(req);
  }
}