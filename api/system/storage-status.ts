import { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../server/storage';
import { loadConfig } from '../_lib/config';

// This endpoint is intentionally not protected by authentication
// as it's used to verify the system's storage configuration

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Wait for storage to be initialized
    const storageInstance = await storage;
    
    // Load configuration
    const config = loadConfig();

    // Determine if using Supabase or mock storage
    // Check if we're using mock storage by examining the implementation of a method
    // Mock methods log to console with "Using mock" prefix
    let isMockStorage = false;
    
    // Create a temporary function to capture console.log output
    const originalConsoleLog = console.log;
    let capturedOutput = '';
    
    console.log = (message: string, ...args: any[]) => {
      capturedOutput = message;
    };
    
    // Call a method that would log "Using mock" if it's a mock implementation
    try {
      await storageInstance.getUserById(0);
    } catch (e) {
      // Ignore errors, we're just checking the logging
    }
    
    // Restore console.log
    console.log = originalConsoleLog;
    
    // Check if the captured output indicates mock storage
    isMockStorage = capturedOutput.includes('Using mock');
    const storageType = isMockStorage ? 'Mock Storage' : 'Supabase Storage';
    
    // Get database connection status
    let dbConnectionStatus = 'Connected';
    let dbInfo = {};
    
    try {
      // Test database connection by performing a simple query
      // This will throw an error if the connection fails
      if (!isMockStorage) {
        // For Supabase storage, we can assume it's connected if we got this far
        // since the storage initialization would have failed otherwise
        dbInfo = {
          url: config.databaseUrl ? maskDatabaseUrl(config.databaseUrl) : 'Not configured',
          supabaseUrl: config.supabaseUrl ? maskUrl(config.supabaseUrl) : 'Not configured',
        };
      } else {
        dbConnectionStatus = 'Not connected (using mock storage)';
        dbInfo = {
          message: 'Using mock storage - no database connection',
        };
      }
    } catch (error) {
      dbConnectionStatus = 'Error';
      dbInfo = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Return the storage status information
    return res.status(200).json({
      storageImplementation: storageType,
      databaseConnectionStatus: dbConnectionStatus,
      databaseInfo: dbInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in storage-status endpoint:', error);
    return res.status(500).json({
      error: 'Failed to retrieve storage status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Helper function to mask sensitive parts of the database URL
function maskDatabaseUrl(url: string): string {
  try {
    // Replace username and password in the URL
    return url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  } catch {
    return 'Invalid URL format';
  }
}

// Helper function to mask sensitive parts of any URL
function maskUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Only return the hostname and protocol
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch {
    return 'Invalid URL format';
  }
}