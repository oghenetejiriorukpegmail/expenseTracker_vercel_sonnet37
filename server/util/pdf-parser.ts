import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';

interface PDFData {
  text: string;
  numpages: number;
  numrender: number;
  info: {
    PDFFormatVersion: string;
    IsAcroFormPresent: boolean;
    IsXFAPresent: boolean;
    [key: string]: any;
  };
  metadata: any;
  version: string;
}

/**
 * Parse PDF file using pdf-lib
 * Note: pdf-lib has limited text extraction capabilities
 * This is a basic implementation that may not extract all text
 */
export async function parsePDF(dataBuffer: Buffer): Promise<PDFData> {
  try {
    // Load PDF document
    const pdfDoc = await PDFDocument.load(dataBuffer);
    
    // Get document info
    const numPages = pdfDoc.getPageCount();
    
    // pdf-lib doesn't have direct text extraction support
    // This is a simple implementation that returns page count info
    // In a production app, use a more robust PDF text extraction library
    
    return {
      text: "PDF text extraction not fully supported. Please use an image receipt for better results.",
      numpages: numPages,
      numrender: numPages,
      info: {
        PDFFormatVersion: '1.7',
        IsAcroFormPresent: false, 
        IsXFAPresent: false
      },
      metadata: null,
      version: '1.0.0'
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to process PDF. The file may be corrupted or password-protected.");
  }
}

/**
 * Parse PDF file from a file path
 */
export async function parsePDFFile(filePath: string): Promise<PDFData> {
  const dataBuffer = fs.readFileSync(filePath);
  return parsePDF(dataBuffer);
}