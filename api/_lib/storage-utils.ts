import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('FATAL ERROR: Missing Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY)');
  if (process.env.NODE_ENV === 'production') {
    // In production, exit the process if Supabase credentials are missing
    process.exit(1);
  }
}

const supabase = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '',
  {
    auth: {
      persistSession: false
    },
    global: {
      fetch: fetch.bind(globalThis)
    }
  }
);

// Initialize buckets on startup
if (process.env.NODE_ENV === 'production') {
  ensureStorageBuckets().catch(err => {
    console.error('Failed to initialize storage buckets:', err);
  });
}

// Storage bucket name
const RECEIPTS_BUCKET = 'receipts';
const ODOMETER_BUCKET = 'odometer-images';

// Ensure buckets exist (call this during app initialization)
export async function ensureStorageBuckets() {
  console.log('Ensuring storage buckets exist...');
  try {
    // Check if receipts bucket exists
    const { data: receiptsBucket, error: receiptsError } = await supabase
      .storage
      .getBucket(RECEIPTS_BUCKET);
    
    if (!receiptsBucket) {
      console.log(`Receipts bucket '${RECEIPTS_BUCKET}' not found, creating...`);
      // Create receipts bucket if it doesn't exist
      const { error } = await supabase.storage.createBucket(RECEIPTS_BUCKET, {
        public: false,
        fileSizeLimit: 10485760, // 10MB limit
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
      });
      
      if (error) {
        console.error('Error creating receipts bucket:', error);
        throw new Error(`Failed to create receipts bucket: ${error.message}`);
      } else {
        console.log(`Created receipts bucket '${RECEIPTS_BUCKET}' successfully`);
      }
    } else {
      console.log(`Receipts bucket '${RECEIPTS_BUCKET}' already exists`);
    }

    // Check if odometer bucket exists
    const { data: odometerBucket, error: odometerError } = await supabase
      .storage
      .getBucket(ODOMETER_BUCKET);
    
    if (!odometerBucket) {
      console.log(`Odometer bucket '${ODOMETER_BUCKET}' not found, creating...`);
      // Create odometer bucket if it doesn't exist
      const { error } = await supabase.storage.createBucket(ODOMETER_BUCKET, {
        public: false,
        fileSizeLimit: 5242880, // 5MB limit
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif']
      });
      
      if (error) {
        console.error('Error creating odometer bucket:', error);
        throw new Error(`Failed to create odometer bucket: ${error.message}`);
      } else {
        console.log(`Created odometer bucket '${ODOMETER_BUCKET}' successfully`);
      }
    } else {
      console.log(`Odometer bucket '${ODOMETER_BUCKET}' already exists`);
    }
    
    console.log('Storage buckets verification complete');
    return true;
  } catch (error) {
    console.error('Error ensuring storage buckets:', error);
    if (process.env.NODE_ENV === 'production') {
      throw error; // In production, propagate the error
    }
    return false;
  }
}

// Upload a receipt file
export async function uploadReceipt(
  fileBuffer: Buffer,
  fileName: string,
  userId: number
): Promise<string | null> {
  try {
    // Generate a unique file name to avoid collisions
    const fileExt = fileName.split('.').pop();
    const uniqueFileName = `${userId}/${uuidv4()}.${fileExt}`;
    
    // Ensure the bucket exists before uploading
    await ensureStorageBuckets();
    
    const { data, error } = await supabase
      .storage
      .from(RECEIPTS_BUCKET)
      .upload(uniqueFileName, fileBuffer, {
        contentType: getContentType(fileExt || ''),
        upsert: false
      });
    
    if (error) {
      console.error('Error uploading receipt:', error);
      return null;
    }
    
    // Get the public URL for the file
    const { data: urlData } = supabase
      .storage
      .from(RECEIPTS_BUCKET)
      .getPublicUrl(uniqueFileName);
    
    console.log(`Receipt uploaded successfully: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadReceipt:', error);
    return null;
  }
}

// Upload an odometer image
export async function uploadOdometerImage(
  fileBuffer: Buffer,
  fileName: string,
  userId: number
): Promise<string | null> {
  try {
    // Generate a unique file name to avoid collisions
    const fileExt = fileName.split('.').pop();
    const uniqueFileName = `${userId}/${uuidv4()}.${fileExt}`;
    
    // Ensure the bucket exists before uploading
    await ensureStorageBuckets();
    
    const { data, error } = await supabase
      .storage
      .from(ODOMETER_BUCKET)
      .upload(uniqueFileName, fileBuffer, {
        contentType: getContentType(fileExt || ''),
        upsert: false
      });
    
    if (error) {
      console.error('Error uploading odometer image:', error);
      return null;
    }
    
    // Get the public URL for the file
    const { data: urlData } = supabase
      .storage
      .from(ODOMETER_BUCKET)
      .getPublicUrl(uniqueFileName);
    
    console.log(`Odometer image uploaded successfully: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadOdometerImage:', error);
    return null;
  }
}

// Delete a file from storage
export async function deleteFile(fileUrl: string): Promise<boolean> {
  try {
    // Extract the bucket and path from the URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    
    // The bucket name should be the first part after /storage/v1/object/public/
    const bucketIndex = pathParts.findIndex(part => part === 'public') + 1;
    if (bucketIndex >= pathParts.length) {
      console.error('Invalid file URL format');
      return false;
    }
    
    const bucket = pathParts[bucketIndex];
    // The file path is everything after the bucket name
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    if (!bucket || !filePath) {
      console.error('Could not extract bucket or file path from URL');
      return false;
    }
    
    const { error } = await supabase
      .storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) {
      console.error('Error deleting file:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteFile:', error);
    return false;
  }
}

// Helper function to get content type from file extension
function getContentType(fileExt: string): string {
  const ext = fileExt.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}