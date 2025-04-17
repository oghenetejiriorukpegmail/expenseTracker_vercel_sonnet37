import { NextApiRequest } from 'next';
import formidable from 'formidable';
import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';

// Disable the default body parser for routes that handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Type for parsed form data
export interface ParsedForm {
  fields: formidable.Fields;
  files: formidable.Files;
}

// Parse multipart form data
export async function parseMultipartForm(req: NextApiRequest): Promise<ParsedForm> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
      // In Vercel serverless functions, we need to use memory for temporary files
      // since we can't write to the filesystem in production
      multiples: true,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

// Read file from formidable file object
export async function readFileFromFormidable(file: formidable.File): Promise<Buffer> {
  // For Vercel serverless functions, the file might be in memory
  if ('buffer' in file && file.buffer) {
    return file.buffer;
  }
  
  // Otherwise, read from the temporary file path
  return await fs.readFile(file.filepath);
}

// Helper to get file extension
export function getFileExtension(filename: string): string {
  return filename.split('.').pop() || '';
}

// Helper to check if file type is allowed
export function isAllowedFileType(filename: string): boolean {
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
  const extension = getFileExtension(filename).toLowerCase();
  return allowedExtensions.includes(extension);
}