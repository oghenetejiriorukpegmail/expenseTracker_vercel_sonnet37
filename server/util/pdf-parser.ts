import * as fs from 'fs';
// Import dynamically to avoid the issue with test PDF file missing
let pdfParse: any = null;

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

// Custom render function to improve text extraction
function renderPage(pageData: any) {
  // Check if text content is available
  if (!pageData.getTextContent) {
    return Promise.resolve("");
  }
  
  return pageData.getTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  }).then(function(textContent: any) {
    let lastY, text = "";
    
    // Organize text by position
    for (let item of textContent.items) {
      if (lastY == item.transform[5] || !lastY) {
        text += item.str;
      } else {
        text += "\n" + item.str;
      }
      lastY = item.transform[5];
    }
    
    return text;
  });
}

// Helper function to lazily load the pdf-parse module
async function getPdfParser() {
  if (!pdfParse) {
    try {
      // This will prevent the library from looking for test PDFs at startup
      process.env.PDF_TEST_SAMPLES = 'false';
      pdfParse = await import('pdf-parse').then(module => module.default);
    } catch (error) {
      console.error("Failed to load pdf-parse module:", error);
      throw new Error("PDF parsing library not available");
    }
  }
  return pdfParse;
}

/**
 * Parse PDF file using pdf-parse, which has better text extraction capabilities
 * than pdf-lib for our use case
 */
export async function parsePDF(dataBuffer: Buffer): Promise<PDFData> {
  try {
    // Get the parser
    const parser = await getPdfParser();
    
    // Use pdf-parse to extract text from PDF
    const result = await parser(dataBuffer, {
      pagerender: renderPage,
    });
    
    // Convert to our interface format
    return {
      text: result.text || "",
      numpages: result.numpages || 0,
      numrender: result.numpages || 0,
      info: {
        PDFFormatVersion: '1.7',
        IsAcroFormPresent: false,
        IsXFAPresent: false,
      },
      metadata: result.metadata || null,
      version: result.version || "1.0.0"
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);
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