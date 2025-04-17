import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { closeConnection } from '../_lib/database';
import { testOCR } from '../_lib/ocr-utils';

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

    const { method, apiKey, ocrApiKey } = req.body;

    // Validate input
    if (!method) {
      return res.status(400).json({ message: 'OCR method is required' });
    }

    // Use ocrApiKey if provided, otherwise use apiKey for backward compatibility
    const actualApiKey = ocrApiKey !== undefined ? ocrApiKey : apiKey;

    if (!actualApiKey) {
      return res.status(400).json({ message: 'API key is required' });
    }

    // Test OCR configuration
    const result = await testOCR(method, actualApiKey);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('OCR test error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}