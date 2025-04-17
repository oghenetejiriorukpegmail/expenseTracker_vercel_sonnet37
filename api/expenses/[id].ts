import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { db } from '../_lib/database';
import { expenses } from '../_lib/schema';
import { eq, and } from 'drizzle-orm';
import { closeConnection } from '../_lib/database';
import { config, parseMultipartForm, readFileFromFormidable, isAllowedFileType } from '../_lib/multipart';
import { uploadReceipt, deleteFile } from '../_lib/storage-utils';
import formidable from 'formidable';

// Export config to disable body parsing for file uploads
export { config };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authenticate user
    const user = await authenticateUser(req);
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get expense ID from query
    const expenseId = parseInt(req.query.id as string);
    if (isNaN(expenseId)) {
      return res.status(400).json({ message: 'Invalid expense ID' });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getExpense(req, res, user.id, expenseId);
      case 'PUT':
        return await updateExpense(req, res, user.id, expenseId);
      case 'DELETE':
        return await deleteExpense(req, res, user.id, expenseId);
      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Expense operation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}

// Get a specific expense
async function getExpense(req: NextApiRequest, res: NextApiResponse, userId: number, expenseId: number) {
  try {
    const result = await db.select()
      .from(expenses)
      .where(and(
        eq(expenses.id, expenseId),
        eq(expenses.userId, userId)
      ))
      .limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    return res.status(200).json(result[0]);
  } catch (error) {
    console.error('Get expense error:', error);
    return res.status(500).json({ message: 'Failed to retrieve expense' });
  }
}

// Update an expense
async function updateExpense(req: NextApiRequest, res: NextApiResponse, userId: number, expenseId: number) {
  try {
    // Check if expense exists and belongs to user
    const existingExpense = await db.select()
      .from(expenses)
      .where(and(
        eq(expenses.id, expenseId),
        eq(expenses.userId, userId)
      ))
      .limit(1);
    
    if (existingExpense.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    const expense = existingExpense[0];
    
    // Handle different content types
    if (req.headers['content-type']?.includes('application/json')) {
      // JSON update (no file)
      const { date, cost, type, vendor, location, tripName, comments } = req.body;

      // Validate input
      if (!date || !cost || !type || !vendor || !location || !tripName) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Update expense
      const result = await db.update(expenses)
        .set({
          date,
          cost: cost.toString(), // Ensure cost is stored as string for numeric type
          type,
          vendor,
          location,
          tripName,
          comments: comments || null,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, expenseId))
        .returning();

      return res.status(200).json(result[0]);
    } else {
      // Multipart form data (with possible file upload)
      const { fields, files } = await parseMultipartForm(req);
      
      // Helper function to get first value from field array or undefined
      const getFieldValue = (fieldName: string): string | undefined => {
        const value = fields[fieldName];
        return Array.isArray(value) ? value[0] : value;
      };
      
      const date = getFieldValue('date');
      const cost = getFieldValue('cost');
      const type = getFieldValue('type');
      const vendor = getFieldValue('vendor');
      const location = getFieldValue('location');
      const tripName = getFieldValue('tripName');
      const comments = getFieldValue('comments');
      
      // Validate required fields
      if (!date || !cost || !type || !vendor || !location || !tripName) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Handle receipt file if provided
      let receiptPath = expense.receiptPath;
      
      if (files.receipt) {
        const receiptFile = Array.isArray(files.receipt) ? files.receipt[0] : files.receipt;
        const filename = receiptFile.originalFilename || '';
        
        // Validate file type
        if (!isAllowedFileType(filename)) {
          return res.status(400).json({ message: 'Invalid file type. Only JPG, PNG, GIF, and PDF files are allowed.' });
        }
        
        // Read file buffer
        const fileBuffer = await readFileFromFormidable(receiptFile);
        
        // Delete old receipt if exists
        if (expense.receiptPath) {
          await deleteFile(expense.receiptPath);
        }
        
        // Upload new receipt
        const fileUrl = await uploadReceipt(
          fileBuffer, 
          filename || 'receipt.jpg',
          userId
        );
        
        if (!fileUrl) {
          return res.status(500).json({ message: 'Failed to upload receipt' });
        }
        
        receiptPath = fileUrl;
      }
      
      // Update expense
      const result = await db.update(expenses)
        .set({
          date,
          cost,
          type,
          vendor,
          location,
          tripName,
          comments: comments || null,
          receiptPath,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, expenseId))
        .returning();
      
      return res.status(200).json(result[0]);
    }
  } catch (error) {
    console.error('Update expense error:', error);
    return res.status(500).json({ message: 'Failed to update expense' });
  }
}

// Delete an expense
async function deleteExpense(req: NextApiRequest, res: NextApiResponse, userId: number, expenseId: number) {
  try {
    // Check if expense exists and belongs to user
    const existingExpense = await db.select()
      .from(expenses)
      .where(and(
        eq(expenses.id, expenseId),
        eq(expenses.userId, userId)
      ))
      .limit(1);
    
    if (existingExpense.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    const expense = existingExpense[0];
    
    // Delete receipt file if exists
    if (expense.receiptPath) {
      await deleteFile(expense.receiptPath);
    }
    
    // Delete expense from database
    await db.delete(expenses)
      .where(eq(expenses.id, expenseId));
    
    return res.status(204).end();
  } catch (error) {
    console.error('Delete expense error:', error);
    return res.status(500).json({ message: 'Failed to delete expense' });
  }
}