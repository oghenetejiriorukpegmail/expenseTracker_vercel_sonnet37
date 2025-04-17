import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { db } from '../_lib/database';
import { trips } from '../_lib/schema';
import { eq, and } from 'drizzle-orm';
import { closeConnection } from '../_lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authenticate user
    const user = await authenticateUser(req);
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get trip ID from query
    const tripId = parseInt(req.query.id as string);
    if (isNaN(tripId)) {
      return res.status(400).json({ message: 'Invalid trip ID' });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getTrip(req, res, user.id, tripId);
      case 'PUT':
        return await updateTrip(req, res, user.id, tripId);
      case 'DELETE':
        return await deleteTrip(req, res, user.id, tripId);
      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Trip operation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}

// Get a specific trip
async function getTrip(req: NextApiRequest, res: NextApiResponse, userId: number, tripId: number) {
  try {
    const result = await db.select()
      .from(trips)
      .where(and(
        eq(trips.id, tripId),
        eq(trips.userId, userId)
      ))
      .limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    return res.status(200).json(result[0]);
  } catch (error) {
    console.error('Get trip error:', error);
    return res.status(500).json({ message: 'Failed to retrieve trip' });
  }
}

// Update a trip
async function updateTrip(req: NextApiRequest, res: NextApiResponse, userId: number, tripId: number) {
  try {
    const { name, description } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Trip name is required' });
    }

    // Check if trip exists and belongs to user
    const existingTrip = await db.select({ id: trips.id })
      .from(trips)
      .where(and(
        eq(trips.id, tripId),
        eq(trips.userId, userId)
      ))
      .limit(1);
    
    if (existingTrip.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Update trip
    const result = await db.update(trips)
      .set({
        name,
        description: description || null,
      })
      .where(eq(trips.id, tripId))
      .returning();

    return res.status(200).json(result[0]);
  } catch (error) {
    console.error('Update trip error:', error);
    return res.status(500).json({ message: 'Failed to update trip' });
  }
}

// Delete a trip
async function deleteTrip(req: NextApiRequest, res: NextApiResponse, userId: number, tripId: number) {
  try {
    // Check if trip exists and belongs to user
    const existingTrip = await db.select({ id: trips.id })
      .from(trips)
      .where(and(
        eq(trips.id, tripId),
        eq(trips.userId, userId)
      ))
      .limit(1);
    
    if (existingTrip.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Delete trip
    await db.delete(trips)
      .where(eq(trips.id, tripId));

    return res.status(204).end();
  } catch (error) {
    console.error('Delete trip error:', error);
    return res.status(500).json({ message: 'Failed to delete trip' });
  }
}