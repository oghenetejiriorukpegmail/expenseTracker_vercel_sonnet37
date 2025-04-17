import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { db } from '../_lib/database';
import { expenses } from '../_lib/schema';
import { closeConnection } from '../_lib/database';
import { config, parseMultipartForm, readFileFromFormidable, isAllowedFileType } from '../_lib/multipart';
import { uploadReceipt } from '../_lib/storage-utils';
import { processReceiptWithOCR } from '../_lib/ocr-utils';
import { loadConfig } from '../_lib/config';
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

    // Parse multipart form data
    const { fields, files } = await parseMultipartForm(req);
    
    // Check if receipt file was uploaded
    if (!files.receipt) {
      return res.status(400).json({ message: 'Receipt file is required' });
    }
    
    // Handle both single file and array of files
    const receiptFile = Array.isArray(files.receipt) ? files.receipt[0] : files.receipt;
    
    // Validate file type
    const filename = receiptFile.originalFilename || '';
    if (!isAllowedFileType(filename)) {
      return res.status(400).json({ message: 'Invalid file type. Only JPG, PNG, GIF, and PDF files are allowed.' });
    }
    
    // Read file buffer
    const fileBuffer = await readFileFromFormidable(receiptFile);
    
    // Upload receipt to Supabase storage
    const fileUrl = await uploadReceipt(
      fileBuffer,
      filename || 'receipt.jpg',
      user.id
    );
    
    if (!fileUrl) {
      return res.status(500).json({ message: 'Failed to upload receipt' });
    }
    
    // Process receipt with OCR if requested
    let ocrResult: any = null;
    const processOcr = Array.isArray(fields.processOcr) ? fields.processOcr[0] : fields.processOcr;
    if (processOcr === 'true') {
      const appConfig = loadConfig();
      const fileType = filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
      
      ocrResult = await processReceiptWithOCR(
        fileBuffer,
        fileType as 'pdf' | 'image',
        appConfig.defaultOcrMethod,
        appConfig.ocrTemplate
      );
    }
    
    // Create expense record if all fields are provided
    let expenseRecord: any = null;
    
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
    
    if (date && cost && type && vendor && location && tripName) {
      const result = await db.insert(expenses)
        .values({
          userId: user.id,
          date,
          cost,
          type,
          vendor,
          location,
          tripName,
          comments: comments || null,
          receiptPath: fileUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      expenseRecord = result[0];
    }
    
    // Return response
    return res.status(200).json({
      success: true,
      fileUrl,
      ocrResult,
      expense: expenseRecord,
    });
  } catch (error) {
    console.error('Receipt upload error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}