import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { db } from '../_lib/database';
import { expenses, trips } from '../_lib/schema';
import { eq, and } from 'drizzle-orm';
import { closeConnection } from '../_lib/database';
import { config, parseMultipartForm, readFileFromFormidable, isAllowedFileType } from '../_lib/multipart';
import { uploadReceipt } from '../_lib/storage-utils';
import { processReceiptWithOCR } from '../_lib/ocr-utils';
import { loadConfig } from '../_lib/config';
import { format } from 'date-fns';
import formidable from 'formidable';

// Export config to disable body parsing for file uploads
export { config };

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

    // Get trip ID from query
    const tripId = parseInt(req.query.tripId as string);
    if (isNaN(tripId)) {
      return res.status(400).json({ message: 'Invalid trip ID' });
    }

    // Verify trip exists and belongs to user
    const tripResult = await db.select()
      .from(trips)
      .where(and(
        eq(trips.id, tripId),
        eq(trips.userId, user.id)
      ))
      .limit(1);
    
    if (tripResult.length === 0) {
      return res.status(404).json({ message: 'Trip not found or not authorized' });
    }
    
    const trip = tripResult[0];

    // Parse multipart form data
    const { files } = await parseMultipartForm(req);
    
    // Check if receipt files were uploaded
    if (!files.receipts) {
      return res.status(400).json({ message: 'No receipt files uploaded' });
    }
    
    // Handle array of files
    const receiptFiles = Array.isArray(files.receipts) ? files.receipts : [files.receipts];
    
    if (receiptFiles.length === 0) {
      return res.status(400).json({ message: 'No receipt files uploaded' });
    }
    
    // Load OCR config
    const appConfig = loadConfig();
    
    // Process each file
    const results: Array<{
      filename: string;
      status: string;
      error: string;
      expenseId?: number;
    }> = [];
    
    for (const file of receiptFiles) {
      const filename = file.originalFilename || 'receipt.jpg';
      let status = 'failed';
      let errorMsg = 'Unknown processing error';
      let createdExpense: any = null;
      
      try {
        // Validate file type
        if (!isAllowedFileType(filename)) {
          errorMsg = 'Invalid file type. Only JPG, PNG, GIF, and PDF files are allowed.';
          results.push({ filename, status, error: errorMsg });
          continue;
        }
        
        // Read file buffer
        const fileBuffer = await readFileFromFormidable(file);
        
        // Upload receipt to Supabase storage
        const fileUrl = await uploadReceipt(
          fileBuffer, 
          filename,
          user.id
        );
        
        if (!fileUrl) {
          errorMsg = 'Failed to upload receipt';
          results.push({ filename, status, error: errorMsg });
          continue;
        }
        
        // Process receipt with OCR
        const fileType = filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
        const ocrResult = await processReceiptWithOCR(
          fileBuffer,
          fileType as 'pdf' | 'image',
          appConfig.defaultOcrMethod,
          appConfig.ocrTemplate
        );
        
        if (ocrResult.success && ocrResult.extractedData) {
          const data = ocrResult.extractedData;
          
          // Attempt to create expense
          const expenseData = {
            date: data.date || format(new Date(), 'yyyy-MM-dd'),
            cost: String(typeof data.cost === 'number' ? data.cost : (parseFloat(String(data.cost)) || 0)),
            type: data.type || 'Other',
            vendor: data.vendor || 'Unknown Vendor',
            location: data.location || 'Unknown Location',
            comments: data.description || (ocrResult.text?.substring(0, 200) || ''),
            tripName: trip.name,
          };
          
          // Validate required fields
          if (!expenseData.date || !expenseData.cost || !expenseData.type || !expenseData.vendor || !expenseData.location || !expenseData.tripName) {
            errorMsg = `Missing required fields extracted from ${filename}`;
            results.push({ filename, status, error: errorMsg });
            continue;
          }
          
          // Create expense
          const result = await db.insert(expenses)
            .values({
              ...expenseData,
              userId: user.id,
              receiptPath: fileUrl,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
          createdExpense = result[0];
          status = 'success';
          errorMsg = '';
        } else {
          errorMsg = ocrResult.error || 'OCR failed to extract data';
        }
      } catch (processingError) {
        errorMsg = processingError instanceof Error ? processingError.message : String(processingError);
      }
      
      results.push({ 
        filename, 
        status, 
        error: errorMsg, 
        expenseId: createdExpense?.id 
      });
    }
    
    return res.status(200).json({ 
      message: 'Batch processing complete', 
      results 
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}