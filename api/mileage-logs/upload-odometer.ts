import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { closeConnection } from '../_lib/database';
import { config, parseMultipartForm, readFileFromFormidable, isAllowedFileType } from '../_lib/multipart';
import { uploadOdometerImage } from '../_lib/storage-utils';
import { processOdometerImageWithAI } from '../_lib/ocr-utils';
import { loadConfig } from '../_lib/config';

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
    
    // Check if odometer image file was uploaded
    if (!files.odometerImage) {
      return res.status(400).json({ message: 'Odometer image file is required' });
    }
    
    // Handle both single file and array of files
    const imageFile = Array.isArray(files.odometerImage) ? files.odometerImage[0] : files.odometerImage;
    
    // Validate file type
    const filename = imageFile.originalFilename || '';
    if (!isAllowedFileType(filename)) {
      return res.status(400).json({ message: 'Invalid file type. Only JPG, PNG, and GIF files are allowed.' });
    }
    
    // Read file buffer
    const fileBuffer = await readFileFromFormidable(imageFile);
    
    // Upload odometer image to Supabase storage
    const imageUrl = await uploadOdometerImage(
      fileBuffer, 
      filename || 'odometer.jpg',
      user.id
    );
    
    if (!imageUrl) {
      return res.status(500).json({ message: 'Failed to upload odometer image' });
    }
    
    // Process odometer image with AI if requested
    let ocrResult: { success: boolean; reading?: number; error?: string } | null = null;
    const processOcr = Array.isArray(fields.processOcr) ? fields.processOcr[0] : fields.processOcr;
    
    if (processOcr === 'true') {
      // Load config to get the default OCR method
      const appConfig = loadConfig();
      const method = appConfig.defaultOcrMethod || 'gemini';
      
      console.log(`Processing odometer image ${filename} using method: ${method}`);
      ocrResult = await processOdometerImageWithAI(fileBuffer, method);
    }
    
    // Return response
    if (ocrResult && ocrResult.success) {
      return res.status(200).json({
        success: true,
        imageUrl,
        reading: ocrResult.reading,
      });
    } else if (ocrResult) {
      // OCR failed but upload succeeded
      return res.status(200).json({
        success: false,
        imageUrl, // Still return URL so user knows upload worked
        error: ocrResult.error || 'Failed to extract odometer reading.',
      });
    } else {
      // No OCR was performed
      return res.status(200).json({
        success: true,
        imageUrl,
      });
    }
  } catch (error) {
    console.error('Odometer image upload error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}