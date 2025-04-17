import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { db } from '../_lib/database';
import { trips } from '../_lib/schema';
import { eq, desc } from 'drizzle-orm';
import { closeConnection } from '../_lib/database';

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
        return await getTrips(req, res, user.id);
      case 'POST':
        return await createTrip(req, res, user.id);
      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Trips error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}

// Get all trips for a user
async function getTrips(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    const userTrips = await db.select()
      .from(trips)
      .where(eq(trips.userId, userId))
      .orderBy(desc(trips.createdAt));
    
    return res.status(200).json(userTrips);
  } catch (error) {
    console.error('Get trips error:', error);
    return res.status(500).json({ message: 'Failed to retrieve trips' });
  }
}

// Create a new trip
async function createTrip(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    const { name, description } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Trip name is required' });
    }

    // Create trip
    const result = await db.insert(trips)
      .values({
        userId,
        name,
        description: description || null,
        createdAt: new Date(),
      })
      .returning();

    return res.status(201).json(result[0]);
  } catch (error) {
    console.error('Create trip error:', error);
    return res.status(500).json({ message: 'Failed to create trip' });
  }
}