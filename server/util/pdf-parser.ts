import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Define our PDF data structure
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

// We'll use PDF.js for text extraction
let pdfjs: any = null;

// Helper function to load PDF.js only when needed
async function loadPdfJs() {
  if (!pdfjs) {
    try {
      // Import pdfjs dynamically
      const pdfjsLib = await import('pdfjs-dist');
      
      // In Node.js environment, we need to set the worker
      if (typeof window === 'undefined') {
        // For Node.js environment: disable worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        
        // Configure PDF.js to work in Node environment
        const nodeCanvasFactory = {
          create: function(width: number, height: number) {
            return {
              width,
              height,
              canvas: { width, height },
              context: {
                // Stub context for Node environment
                drawImage: () => {},
                fillRect: () => {},
                fillText: () => {},
                save: () => {},
                restore: () => {},
                scale: () => {},
                transform: () => {},
                beginPath: () => {},
                rect: () => {},
                fill: () => {},
                stroke: () => {},
                closePath: () => {},
              }
            };
          },
          reset: function() {},
          destroy: function() {}
        };
        
        // Use our minimal factory
        (pdfjsLib as any).CanvasFactory = nodeCanvasFactory;
      }
      
      pdfjs = pdfjsLib;
    } catch (error) {
      console.error("Failed to load PDF.js:", error);
      pdfjs = null;
    }
  }
  return pdfjs;
}

/**
 * Parse PDF using PDF.js
 */
async function parsePdfWithPdfJs(dataBuffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await loadPdfJs();
    if (!pdfjsLib) {
      throw new Error("PDF.js library not available");
    }
    
    // Load the PDF file
    const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
    const pdfDocument = await loadingTask.promise;
    
    // Extract text from all pages
    let fullText = '';
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      
      // Process text content
      let lastY, text = "";
      for (const item of textContent.items) {
        if (item.str) {
          if (lastY == item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += "\n" + item.str;
          }
          lastY = item.transform[5];
        }
      }
      
      fullText += text + '\n\n';
    }
    
    return fullText;
  } catch (error) {
    console.error("PDF.js parsing error:", error);
    return "";
  }
}

/**
 * Parse PDF with pdf-lib (fallback)
 */
async function parsePdfWithPdfLib(dataBuffer: Buffer): Promise<string> {
  try {
    // Load PDF document
    const pdfDoc = await PDFDocument.load(dataBuffer);
    pdfDoc.registerFontkit(fontkit);
    
    // Get document info
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    // Extract form field values
    let text = "";
    
    // Extract field data
    if (fields.length > 0) {
      for (const field of fields) {
        const name = field.getName();
        let value = "";
        
        // Try to get field value based on type
        if (field.constructor.name === 'PDFTextField') {
          const textField = field as any;
          value = textField.getText() || "";
        } else if (field.constructor.name === 'PDFCheckBox') {
          const checkBox = field as any;
          value = checkBox.isChecked() ? "☑" : "☐";
        } else if (field.constructor.name === 'PDFDropdown') {
          const dropdown = field as any;
          value = dropdown.getSelected().join(", ") || "";
        } else if (field.constructor.name === 'PDFRadioGroup') {
          const radioGroup = field as any;
          value = radioGroup.getSelected() || "";
        }
        
        if (value) {
          text += `${name}: ${value}\n`;
        }
      }
    }
    
    // If we have at least some text, return it
    if (text.trim()) {
      return text;
    } else {
      // No form fields found or extracted
      return "No text content could be extracted from this PDF.";
    }
  } catch (error) {
    console.error("pdf-lib parsing error:", error);
    return "";
  }
}

/**
 * Main function to parse PDF buffer
 */
export async function parsePDF(dataBuffer: Buffer): Promise<PDFData> {
  try {
    console.log("Attempting to parse PDF...");
    
    // Try PDF.js first for text extraction
    let text = await parsePdfWithPdfJs(dataBuffer);
    
    // If PDF.js failed, try pdf-lib as fallback
    if (!text || text.trim() === '') {
      console.log("PDF.js extraction failed, trying pdf-lib fallback");
      text = await parsePdfWithPdfLib(dataBuffer);
    }
    
    // If we still don't have text, return an error message
    if (!text || text.trim() === '') {
      text = "Could not extract text from this PDF. Try using an image of the receipt instead.";
    }
    
    // Get page count using pdf-lib (more reliable)
    const pdfDoc = await PDFDocument.load(dataBuffer);
    const numPages = pdfDoc.getPageCount();
    
    // Log a sample of the extracted text
    console.log(`Extracted ${text.length} chars from PDF. Sample: ${text.substring(0, 200)}...`);
    
    return {
      text,
      numpages: numPages,
      numrender: numPages,
      info: {
        PDFFormatVersion: '1.7',
        IsAcroFormPresent: false,
        IsXFAPresent: false,
      },
      metadata: null,
      version: "1.0.0"
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);
    
    // Return a default response with error message
    return {
      text: "PDF text extraction failed. Try using an image of the receipt instead.",
      numpages: 0,
      numrender: 0,
      info: {
        PDFFormatVersion: '1.7',
        IsAcroFormPresent: false,
        IsXFAPresent: false
      },
      metadata: null,
      version: "1.0.0"
    };
  }
}

/**
 * Parse PDF file from a file path
 */
export async function parsePDFFile(filePath: string): Promise<PDFData> {
  try {
    console.log(`Reading PDF file: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    return parsePDF(dataBuffer);
  } catch (error) {
    console.error("Error reading PDF file:", error);
    return {
      text: "Failed to read PDF file. The file may be corrupted or inaccessible.",
      numpages: 0,
      numrender: 0,
      info: {
        PDFFormatVersion: '1.7',
        IsAcroFormPresent: false,
        IsXFAPresent: false
      },
      metadata: null,
      version: "1.0.0"
    };
  }
}