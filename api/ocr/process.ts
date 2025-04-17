import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateUser } from '../_lib/auth';
import { closeConnection } from '../_lib/database';
import { config, parseMultipartForm, readFileFromFormidable, isAllowedFileType } from '../_lib/multipart';
import { processReceiptWithOCR } from '../_lib/ocr-utils';
import { loadConfig } from '../_lib/config';
import path from 'path';

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
    
    // Get file extension and check if it's a PDF
    const fileExtension = path.extname(filename).toLowerCase();
    const isPdfFile = fileExtension === '.pdf';
    const fileType = isPdfFile ? 'pdf' : 'image';
    
    // Get the OCR method from the request or from the config
    const appConfig = loadConfig();
    const methodField = Array.isArray(fields.method) ? fields.method[0] : fields.method;
    const templateField = Array.isArray(fields.template) ? fields.template[0] : fields.template;
    
    let method = methodField || appConfig.defaultOcrMethod || 'gemini';
    const template = templateField || appConfig.ocrTemplate || 'general';
    
    // If it's a PDF and the method is tesseract, recommend using Gemini, OpenAI, or Claude
    if (isPdfFile && method === 'tesseract') {
      console.log('PDF detected with tesseract method. Recommending Gemini, OpenAI, or Claude for better results.');
      // We'll continue with tesseract, but the user will see a message in the logs
    }
    
    // Check if we have an API key for the selected method
    if (method !== 'tesseract') {
      const envVarName = `${method.toUpperCase()}_API_KEY`;
      const apiKey = process.env[envVarName];
      
      if (!apiKey) {
        console.log(`No API key found for ${method} OCR method`);
        return res.status(400).json({
          success: false,
          error: `No API key configured for ${method}. Please set your API key in the settings page.`
        });
      }
    }
    
    // Process receipt with OCR
    console.log(`Processing receipt with ${method} OCR method using template: ${template}`);
    const result = await processReceiptWithOCR(
      fileBuffer,
      fileType as 'pdf' | 'image',
      method,
      template
    );
    
    // Format the extracted data for form auto-fill
    const extractedData = result.extractedData || {};
    
    // Safely access properties with type checking
    const getExtractedValue = (key: string): string => {
      if (extractedData && typeof extractedData === 'object' && key in extractedData) {
        const value = extractedData[key as keyof typeof extractedData];
        return value ? String(value) : '';
      }
      return '';
    };
    
    // Get items array safely
    const getItemsArray = (): any[] => {
      if (extractedData &&
          typeof extractedData === 'object' &&
          'items' in extractedData &&
          Array.isArray(extractedData.items)) {
        return extractedData.items;
      }
      return [];
    };
    
    // Structure data for our settings verification table based on the template fields
    const dateValue = getExtractedValue('date');
    const costValue = getExtractedValue('cost');
    const currencyValue = getExtractedValue('currency');
    const descriptionValue = getExtractedValue('description');
    const typeValue = getExtractedValue('type');
    const vendorValue = getExtractedValue('vendor');
    const locationValue = getExtractedValue('location');
    
    // Add more verbose logging of what we found
    console.log('Extracted data summary:');
    console.log('- Date:', dateValue || 'Not found');
    console.log('- Cost:', costValue || 'Not found');
    console.log('- Currency:', currencyValue || 'Not found');
    console.log('- Description:', descriptionValue || 'Not found');
    console.log('- Type:', typeValue || 'Not found');
    console.log('- Vendor:', vendorValue || 'Not found');
    console.log('- Location:', locationValue || 'Not found');
    
    // Combined response with both the original extracted data and formatted data for form fields
    const formattedData: any = {
      ...result,
      // Updated data structure for the verification table display
      data: {
        date: dateValue,
        cost: costValue,
        currency: currencyValue,
        description: descriptionValue,
        type: typeValue,
        vendor: vendorValue,
        location: locationValue,
      },
      // Formatted data for form auto-fill
      formData: result.success ? {
        date: dateValue,
        cost: costValue,
        currency: currencyValue,
        description: descriptionValue,
        type: typeValue,
        vendor: vendorValue,
        location: locationValue,
      } : {
        // Provide empty default values if no data was extracted
        date: '',
        vendor: '',
        location: '',
        cost: '',
        type: 'other',
        items: [],
        paymentMethod: '',
        description: '',
      }
    };
    
    // Add a message for PDF files processed with tesseract
    if (isPdfFile && method === 'tesseract' && (!result.extractedData || Object.keys(result.extractedData).length === 0)) {
      formattedData.pdfMessage = 'PDF processing with Tesseract has limited capabilities. For better results with PDF files, please use Gemini, OpenAI, or Claude OCR methods in the settings page.';
    }
    
    return res.status(200).json(formattedData);
  } catch (error) {
    console.error('OCR processing error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  } finally {
    // Close database connection in production
    await closeConnection();
  }
}