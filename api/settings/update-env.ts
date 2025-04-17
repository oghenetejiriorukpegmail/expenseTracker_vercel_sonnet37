import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { closeConnection } from '../_lib/database';
import { updateOcrApiKey, setDefaultOcrMethod, setOcrTemplate, loadConfig } from '../_lib/config';

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

    const { ocrMethod, apiKey, ocrApiKey, ocrTemplate } = req.body;

    // Use ocrApiKey if provided, otherwise use apiKey for backward compatibility
    const actualApiKey = ocrApiKey !== undefined ? ocrApiKey : apiKey;

    // Persist the OCR method and API key
    if (ocrMethod) {
      setDefaultOcrMethod(ocrMethod);
      console.log(`Set default OCR method to ${ocrMethod}`);

      if (actualApiKey) {
        updateOcrApiKey(ocrMethod, actualApiKey);
        console.log(`Updated API key for ${ocrMethod}`);
      }
    }

    // Store the template preference
    if (ocrTemplate) {
      setOcrTemplate(ocrTemplate);
      console.log(`Set OCR template to ${ocrTemplate}`);
    }

    // Get the updated config
    const updatedConfig = loadConfig();
    
    // Return success response with updated settings
    return res.status(200).json({ 
      success: true, 
      message: 'Settings updated successfully',
      settings: {
        defaultOcrMethod: updatedConfig.defaultOcrMethod,
        ocrTemplate: updatedConfig.ocrTemplate,
        // Don't return API keys for security
      }
    });
  } catch (error) {
    console.error('Update environment settings error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}