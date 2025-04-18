import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { db } from '../_lib/database';
import { expenses } from '../_lib/schema';
import { eq, and, desc } from 'drizzle-orm';
import { closeConnection } from '../_lib/database';
import { config } from '../_lib/multipart';

// Export config to disable body parsing for file uploads
export { config };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authenticate user
    const user = await authenticateUser(req);
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getExpenses(req, res, user.id);
      case 'POST':
        return await createExpense(req, res, user.id);
      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Expenses error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production, passing the request object
    await closeConnection(req);
  }
}

// Get expenses for a user
async function getExpenses(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    const tripName = req.query.tripName as string | undefined;
    
    let query = db.select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.date));
    
    // Filter by trip name if provided
    if (tripName) {
      query = db.select()
        .from(expenses)
        .where(and(
          eq(expenses.userId, userId),
          eq(expenses.tripName, tripName)
        ))
        .orderBy(desc(expenses.date));
    }
    
    const userExpenses = await query;
    
    return res.status(200).json(userExpenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    return res.status(500).json({ message: 'Failed to retrieve expenses' });
  }
}

// Create a new expense
async function createExpense(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    // For file uploads, we need to use the multipart parser
    // This will be implemented in the next step with Supabase storage
    // For now, we'll handle JSON requests only
    
    if (req.headers['content-type']?.includes('application/json')) {
      const { date, cost, type, vendor, location, tripName, comments } = req.body;

      // Validate input
      if (!date || !cost || !type || !vendor || !location || !tripName) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Create expense
      const result = await db.insert(expenses)
        .values({
          userId,
          date,
          cost: cost.toString(), // Ensure cost is stored as string for numeric type
          type,
          vendor,
          location,
          tripName,
          comments: comments || null,
          receiptPath: null, // No receipt for JSON requests
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return res.status(201).json(result[0]);
    } else {
      // For multipart/form-data requests, we'll implement file upload handling
      // in a separate endpoint or update this later
      return res.status(415).json({ message: 'Unsupported media type. Use application/json for now.' });
    }
  } catch (error) {
    console.error('Create expense error:', error);
    return res.status(500).json({ message: 'Failed to create expense' });
  }
}