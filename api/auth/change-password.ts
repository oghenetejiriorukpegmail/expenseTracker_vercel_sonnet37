import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser, comparePasswords, hashPassword } from '../_lib/auth';
import { db } from '../_lib/database';
import { users } from '../_lib/schema';
import { eq } from 'drizzle-orm';
import { closeConnection } from '../_lib/database';
import { z } from 'zod';

// Define validation schema
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
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
      validatedData = passwordChangeSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      throw error;
    }

    const { currentPassword, newPassword } = validatedData;

    // Verify current password
    const isMatch = await comparePasswords(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password in database
    await db.update(users)
      .set({ password: newPasswordHash })
      .where(eq(users.id, user.id));

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production, passing the request object
    await closeConnection(req);
  }
}