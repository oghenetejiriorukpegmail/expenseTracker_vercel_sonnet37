import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { db } from '../_lib/database';
import { mileageLogs } from '../_lib/schema';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { closeConnection } from '../_lib/database';
import { z } from 'zod';

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
        return await getMileageLogs(req, res, user.id);
      case 'POST':
        return await createMileageLog(req, res, user.id);
      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Mileage logs error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}

// Get mileage logs for a user
async function getMileageLogs(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    // Basic validation for query params
    const querySchema = z.object({
      tripId: z.coerce.number().int().positive().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.coerce.number().int().positive().optional(),
      offset: z.coerce.number().int().min(0).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    });

    let validatedQuery;
    try {
      validatedQuery = querySchema.parse(req.query);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid query parameters', errors: error.errors });
      }
      throw error;
    }

    // Build query conditions
    const conditions = [eq(mileageLogs.userId, userId)];

    if (validatedQuery.tripId) {
      conditions.push(eq(mileageLogs.tripId, validatedQuery.tripId));
    }
    
    if (validatedQuery.startDate) {
      conditions.push(gte(mileageLogs.tripDate, new Date(validatedQuery.startDate)));
    }
    
    if (validatedQuery.endDate) {
      conditions.push(lte(mileageLogs.tripDate, new Date(validatedQuery.endDate)));
    }

    // Build query
    let query = db.select()
      .from(mileageLogs)
      .where(and(...conditions));

    // Create a base query
    let baseQuery = db.select()
      .from(mileageLogs)
      .where(and(...conditions));
    
    // Sorting
    const sortBy = validatedQuery.sortBy || 'tripDate';
    const sortOrder = validatedQuery.sortOrder === 'asc' ? asc : desc;
    
    // Ensure the column exists in the schema
    const validColumns = ['id', 'tripDate', 'startOdometer', 'endOdometer', 'calculatedDistance', 'createdAt'];
    const sortColumn = validColumns.includes(sortBy) ? sortBy : 'tripDate';
    
    // Apply sorting
    let sortedQuery;
    if (sortColumn === 'tripDate') {
      sortedQuery = baseQuery.orderBy(sortOrder(mileageLogs.tripDate));
    } else if (sortColumn === 'startOdometer') {
      sortedQuery = baseQuery.orderBy(sortOrder(mileageLogs.startOdometer));
    } else if (sortColumn === 'endOdometer') {
      sortedQuery = baseQuery.orderBy(sortOrder(mileageLogs.endOdometer));
    } else if (sortColumn === 'calculatedDistance') {
      sortedQuery = baseQuery.orderBy(sortOrder(mileageLogs.calculatedDistance));
    } else if (sortColumn === 'createdAt') {
      sortedQuery = baseQuery.orderBy(sortOrder(mileageLogs.createdAt));
    } else {
      sortedQuery = baseQuery.orderBy(sortOrder(mileageLogs.id));
    }

    // Apply pagination
    let paginatedQuery = sortedQuery;
    if (validatedQuery.limit) {
      paginatedQuery = sortedQuery.limit(validatedQuery.limit);
    }
    
    if (validatedQuery.offset) {
      paginatedQuery = paginatedQuery.offset(validatedQuery.offset);
    }
    
    // Use the final query
    query = paginatedQuery;

    // Execute query
    const logs = await query;
    
    return res.status(200).json(logs);
  } catch (error) {
    console.error('Get mileage logs error:', error);
    return res.status(500).json({ message: 'Failed to retrieve mileage logs' });
  }
}

// Create a new mileage log
async function createMileageLog(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    const { tripId, tripDate, startOdometer, endOdometer, purpose, startImageUrl, endImageUrl, entryMethod } = req.body;

    // Validate input
    if (!tripDate || startOdometer === undefined || endOdometer === undefined || !entryMethod) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate odometer readings
    const startOdo = parseFloat(startOdometer);
    const endOdo = parseFloat(endOdometer);
    
    if (isNaN(startOdo) || isNaN(endOdo)) {
      return res.status(400).json({ message: 'Invalid odometer readings' });
    }
    
    if (endOdo <= startOdo) {
      return res.status(400).json({ message: 'End odometer must be greater than start odometer' });
    }

    // Calculate distance
    const calculatedDistance = endOdo - startOdo;

    // Create mileage log
    const result = await db.insert(mileageLogs)
      .values({
        userId,
        tripId: tripId || null,
        tripDate: new Date(tripDate),
        startOdometer: startOdometer.toString(),
        endOdometer: endOdometer.toString(),
        calculatedDistance: calculatedDistance.toString(),
        purpose: purpose || null,
        startImageUrl: startImageUrl || null,
        endImageUrl: endImageUrl || null,
        entryMethod,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return res.status(201).json(result[0]);
  } catch (error) {
    console.error('Create mileage log error:', error);
    return res.status(500).json({ message: 'Failed to create mileage log' });
  }
}