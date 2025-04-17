import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { db } from '../_lib/database';
import { mileageLogs } from '../_lib/schema';
import { eq, and } from 'drizzle-orm';
import { closeConnection } from '../_lib/database';
import { deleteFile } from '../_lib/storage-utils';
import { z } from 'zod';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authenticate user
    const user = await authenticateUser(req);
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get mileage log ID from query
    const logId = parseInt(req.query.id as string);
    if (isNaN(logId)) {
      return res.status(400).json({ message: 'Invalid mileage log ID' });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getMileageLog(req, res, user.id, logId);
      case 'PUT':
        return await updateMileageLog(req, res, user.id, logId);
      case 'DELETE':
        return await deleteMileageLog(req, res, user.id, logId);
      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Mileage log operation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}

// Get a specific mileage log
async function getMileageLog(req: NextApiRequest, res: NextApiResponse, userId: number, logId: number) {
  try {
    const result = await db.select()
      .from(mileageLogs)
      .where(and(
        eq(mileageLogs.id, logId),
        eq(mileageLogs.userId, userId)
      ))
      .limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ message: 'Mileage log not found' });
    }
    
    return res.status(200).json(result[0]);
  } catch (error) {
    console.error('Get mileage log error:', error);
    return res.status(500).json({ message: 'Failed to retrieve mileage log' });
  }
}

// Update a mileage log
async function updateMileageLog(req: NextApiRequest, res: NextApiResponse, userId: number, logId: number) {
  try {
    // Fetch existing log to verify ownership
    const existingLog = await db.select()
      .from(mileageLogs)
      .where(and(
        eq(mileageLogs.id, logId),
        eq(mileageLogs.userId, userId)
      ))
      .limit(1);
    
    if (existingLog.length === 0) {
      return res.status(404).json({ message: 'Mileage log not found' });
    }
    
    const log = existingLog[0];
    
    // Define update schema
    const updateSchema = z.object({
      tripId: z.number().int().positive().optional(),
      tripDate: z.string().optional(), // Will be converted to Date
      startOdometer: z.number().positive('Start odometer must be positive').optional(),
      endOdometer: z.number().positive('End odometer must be positive').optional(),
      purpose: z.string().optional().nullable(),
      startImageUrl: z.string().url().optional().nullable(),
      endImageUrl: z.string().url().optional().nullable(),
      entryMethod: z.enum(['manual', 'ocr']).optional(),
    }).refine(data => {
      // If both odometer readings are present, ensure end > start
      if (data.startOdometer !== undefined && data.endOdometer !== undefined) {
        return data.endOdometer > data.startOdometer;
      }
      
      // If only start odometer is present, compare with existing end odometer
      if (data.startOdometer !== undefined && log.endOdometer !== null) {
        return parseFloat(log.endOdometer) > data.startOdometer;
      }
      
      // If only end odometer is present, compare with existing start odometer
      if (data.endOdometer !== undefined && log.startOdometer !== null) {
        return data.endOdometer > parseFloat(log.startOdometer);
      }
      
      return true; // Allow update if only one or neither odometer is changing
    }, {
      message: 'End odometer reading must be greater than start odometer reading',
      path: ['endOdometer'],
    });

    // Validate input
    let validatedData;
    try {
      validatedData = updateSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      throw error;
    }

    // Prepare update data
    const updateData: any = {};
    
    if (validatedData.tripId !== undefined) updateData.tripId = validatedData.tripId;
    if (validatedData.tripDate !== undefined) updateData.tripDate = new Date(validatedData.tripDate);
    if (validatedData.purpose !== undefined) updateData.purpose = validatedData.purpose;
    if (validatedData.entryMethod !== undefined) updateData.entryMethod = validatedData.entryMethod;
    
    // Handle odometer readings and recalculate distance if needed
    if (validatedData.startOdometer !== undefined) {
      updateData.startOdometer = validatedData.startOdometer.toString();
    }
    
    if (validatedData.endOdometer !== undefined) {
      updateData.endOdometer = validatedData.endOdometer.toString();
    }
    
    // Recalculate distance if either odometer reading changed
    if (validatedData.startOdometer !== undefined || validatedData.endOdometer !== undefined) {
      const startOdo = validatedData.startOdometer ?? parseFloat(log.startOdometer);
      const endOdo = validatedData.endOdometer ?? parseFloat(log.endOdometer);
      updateData.calculatedDistance = (endOdo - startOdo).toString();
    }
    
    // Handle image URLs
    // If startImageUrl is explicitly set to null, delete the old image
    if (validatedData.startImageUrl === null && log.startImageUrl) {
      await deleteFile(log.startImageUrl);
      updateData.startImageUrl = null;
    } else if (validatedData.startImageUrl !== undefined) {
      updateData.startImageUrl = validatedData.startImageUrl;
    }
    
    // If endImageUrl is explicitly set to null, delete the old image
    if (validatedData.endImageUrl === null && log.endImageUrl) {
      await deleteFile(log.endImageUrl);
      updateData.endImageUrl = null;
    } else if (validatedData.endImageUrl !== undefined) {
      updateData.endImageUrl = validatedData.endImageUrl;
    }
    
    // Set updated timestamp
    updateData.updatedAt = new Date();
    
    // Update mileage log
    const result = await db.update(mileageLogs)
      .set(updateData)
      .where(eq(mileageLogs.id, logId))
      .returning();
    
    return res.status(200).json(result[0]);
  } catch (error) {
    console.error('Update mileage log error:', error);
    return res.status(500).json({ message: 'Failed to update mileage log' });
  }
}

// Delete a mileage log
async function deleteMileageLog(req: NextApiRequest, res: NextApiResponse, userId: number, logId: number) {
  try {
    // Fetch existing log to verify ownership AND get image URLs before deleting DB record
    const existingLog = await db.select()
      .from(mileageLogs)
      .where(and(
        eq(mileageLogs.id, logId),
        eq(mileageLogs.userId, userId)
      ))
      .limit(1);
    
    if (existingLog.length === 0) {
      return res.status(404).json({ message: 'Mileage log not found' });
    }
    
    const log = existingLog[0];
    
    // Delete associated images from storage
    if (log.startImageUrl) {
      await deleteFile(log.startImageUrl);
    }
    
    if (log.endImageUrl) {
      await deleteFile(log.endImageUrl);
    }
    
    // Delete mileage log from database
    await db.delete(mileageLogs)
      .where(eq(mileageLogs.id, logId));
    
    return res.status(204).end();
  } catch (error) {
    console.error('Delete mileage log error:', error);
    return res.status(500).json({ message: 'Failed to delete mileage log' });
  }
}