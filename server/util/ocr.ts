import { createWorker } from "tesseract.js";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";
import { parsePDFFile } from "./pdf-parser";

// Helper function to read PDF file
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Parse PDF and extract text using our custom parser
    const pdfData = await parsePDFFile(filePath);
    
    // Clean up text (remove excessive whitespace, etc.)
    let text = pdfData.text || "";
    text = text.replace(/\s+/g, ' ').trim();
    
    console.log(`Extracted PDF text (first 200 chars): ${text.substring(0, 200)}...`);
    
    return text;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to extract text from PDF. The file may be corrupted or password-protected.");
  }
}

// For some AI models like Gemini and OpenAI Vision, we need image data
// This is a placeholder for getting binary data from the PDF or image
async function getFileData(filePath: string): Promise<Buffer> {
  return fs.readFileSync(filePath);
}

// Check file type
function getFileType(filePath: string): 'pdf' | 'image' {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    return 'pdf';
  } else {
    return 'image';
  }
}

// Process receipt with OCR based on the selected method
export async function processReceiptWithOCR(filePath: string, method: string = "tesseract") {
  try {
    // Ensure the file exists
    if (!fs.existsSync(filePath)) {
      throw new Error("Receipt file not found");
    }

    // Check file type
    const fileType = getFileType(filePath);
    console.log(`Processing receipt of type ${fileType} with ${method} OCR method`);
    
    // Process differently based on file type and OCR method
    let result;
    
    // For PDFs
    if (fileType === 'pdf') {
      console.log(`PDF receipt detected, extracting text...`);
      // Extract text content from PDF
      const pdfText = await extractTextFromPDF(filePath);
      
      // Handle empty PDF text
      if (!pdfText || pdfText.trim() === '') {
        console.log('PDF text extraction yielded no text, will attempt vision-based processing');
        
        // Fall back to image-based methods if possible
        if (method === 'gemini' || method === 'openai' || method === 'claude') {
          // For models with vision capabilities, use file data directly (PDF as an image)
          console.log("Using vision API for PDF processing since text extraction failed");
          switch (method) {
            case "gemini":
              // Use vision API directly for PDF
              result = await processGemini(filePath);
              break;
            case "openai":
              result = await processOpenAI(filePath);
              break;
            case "claude":
              result = await processClaude(filePath);
              break;
            default:
              throw new Error(`No text content found in PDF and no vision fallback for method: ${method}`);
          }
        } else {
          throw new Error("PDF text extraction failed and selected OCR method doesn't support direct image processing");
        }
      } else {
        // Process the extracted PDF text with the selected AI model
        console.log(`Successfully extracted PDF text (${pdfText.length} chars), processing with ${method}...`);
        switch (method) {
          case "tesseract":
            // Tesseract doesn't process text directly, so we'll just return the extracted PDF text
            result = pdfText;
            break;
          case "openai":
            result = await processOpenAIText(pdfText);
            break;
          case "gemini":
            result = await processGeminiText(pdfText);
            break;
          case "claude":
            result = await processClaudeText(pdfText);
            break;
          case "openrouter":
            result = await processOpenRouterText(pdfText);
            break;
          default:
            throw new Error(`Unsupported OCR method for PDF: ${method}`);
        }
      }
    } else {
      // For image files, use the direct vision-based methods
      console.log(`Image receipt detected, processing with ${method}...`);
      switch (method) {
        case "tesseract":
          result = await processTesseract(filePath);
          break;
        case "openai":
          result = await processOpenAI(filePath);
          break;
        case "gemini":
          result = await processGemini(filePath);
          break;
        case "claude":
          result = await processClaude(filePath);
          break;
        case "openrouter":
          result = await processOpenRouter(filePath);
          break;
        default:
          throw new Error(`Unsupported OCR method: ${method}`);
      }
    }
    
    // Try to extract structured data from the OCR result
    // Log a sample of the result for debugging
    console.log(`OCR result (first 100 chars): ${result.substring(0, 100)}...`);
    
    try {
      // Extract structured data from the OCR text
      const extractedData = extractDataFromText(result);
      console.log("Successfully extracted structured data:", extractedData);
      
      return {
        success: true,
        text: result,
        extractedData
      };
    } catch (dataError) {
      console.error("Error extracting structured data:", dataError);
      // Return partial success - text was extracted but structured data failed
      return {
        success: true,
        text: result,
        extractedData: {}, // Empty data
        extractionError: dataError instanceof Error ? dataError.message : "Failed to extract structured data"
      };
    }
  } catch (error) {
    console.error("OCR processing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

// Process with Tesseract.js (local OCR)
async function processTesseract(filePath: string) {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker();
    
    // Initialize with English language
    await (worker as any).loadLanguage("eng");
    await (worker as any).initialize("eng");
    
    // Process the image
    const result = await worker.recognize(filePath);
    const text = result.data.text;
    
    // Clean up
    await worker.terminate();
    
    return text;
  } catch (error) {
    console.error('Error processing with Tesseract:', error);
    throw new Error(`Tesseract OCR error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Process OpenAI with text input from PDF
async function processOpenAIText(textContent: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o", // Using the newest OpenAI model
      messages: [
        {
          role: "system",
          content: "You are an AI specialized in extracting structured data from receipts. Your task is to extract key information from the receipt text provided."
        },
        {
          role: "user",
          content: `This is a receipt text extracted from a PDF. Extract and structure the following information: date, vendor/business name, location, items purchased with their prices, total amount, and payment method if visible. Return the data in a clean JSON format.\n\nReceipt text:\n${textContent}`
        }
      ],
      max_tokens: 1500,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Process Gemini with text input from PDF
async function processGeminiText(textContent: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are an AI specialized in extracting structured data from receipts. Your task is to extract key information from the receipt text provided. Extract and structure the following information: date, vendor/business name, location, items purchased with their prices, total amount, and payment method if visible. Return the data in a clean JSON format.\n\nReceipt text:\n${textContent}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const data = await response.json();
    
    if (data && 
        data.candidates && 
        data.candidates.length > 0 && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts.length > 0) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Unexpected response format from Gemini API");
    }
  } catch (error) {
    console.error("Error processing text with Gemini:", error);
    throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Process Claude with text input from PDF
async function processClaudeText(textContent: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  // Import Anthropic SDK
  const Anthropic = require('@anthropic-ai/sdk');
  
  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });
  
  try {
    // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
    const message = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 2000,
      system: "You are an AI assistant specialized in extracting and structuring data from receipts. Your task is to extract key information and provide it in a structured JSON format.",
      messages: [
        {
          role: "user",
          content: `This is a receipt text extracted from a PDF. Extract and structure the following information: date, vendor/business name, location, items purchased with their prices, total amount, and payment method if visible. Format this data in a structured JSON object.\n\nReceipt text:\n${textContent}`
        }
      ]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Error processing text with Claude:', error);
    throw new Error(`Claude API error: ${error.message}`);
  }
}

// Process OpenRouter with text input from PDF
async function processOpenRouterText(textContent: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured");
  }
  
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://expense-tracker-app.com"
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-opus:beta",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant specialized in extracting and structuring data from receipts."
        },
        {
          role: "user",
          content: `This is a receipt text extracted from a PDF. Extract and structure the following information: date, vendor/business name, location, items purchased with their prices, total amount, and payment method if visible. Format this data in a structured JSON object.\n\nReceipt text:\n${textContent}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Process with OpenAI Vision API
async function processOpenAI(filePath: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  // Read file as base64
  const fileData = fs.readFileSync(filePath);
  const base64Image = fileData.toString("base64");
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This is a receipt. Extract all text from it. Then analyze for: date, vendor/business name, items purchased, prices, total amount, and payment method if visible."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Process with Google Gemini
async function processGemini(filePath: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  // Read file as base64
  const fileData = fs.readFileSync(filePath);
  const base64Image = fileData.toString("base64");
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "You are an AI specialized in reading and extracting data from receipts. I'll provide you with a receipt image. Please extract all of the text you can see on the receipt. Then, analyze the receipt to identify: date, vendor/business name, location, individual items purchased with their prices, subtotal, tax, total amount, and payment method if visible. After you provide the raw extracted text, include a structured JSON object with these fields. Format your response with the extracted JSON object at the end, ensuring it's properly formatted for parsing. The JSON should include: date, vendor, location, items (array of items with name and price), total, and paymentMethod."
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const data = await response.json();
    
    // Return the text response from Gemini
    if (data && 
        data.candidates && 
        data.candidates.length > 0 && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts.length > 0) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Unexpected response format from Gemini API");
    }
  } catch (error) {
    console.error("Error processing with Gemini:", error);
    throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Process with Anthropic Claude
async function processClaude(filePath: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  // Import Anthropic SDK
  const Anthropic = require('@anthropic-ai/sdk');
  
  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  // Read file as base64
  const fileData = fs.readFileSync(filePath);
  const base64Image = fileData.toString("base64");
  
  try {
    // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
    const message = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 2000,
      system: "You are an AI assistant specialized in extracting and structuring data from receipts. Format your response to clearly separate the raw OCR text from your structured analysis. After the raw text extraction, provide a structured JSON format with fields for date, vendor, items (with prices), total, payment method, and location. Ensure the JSON is properly formatted for parsing.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This is a receipt image. First, extract all visible text from the image. Second, analyze the receipt to identify: date, vendor/business name, location, individual items purchased with prices, subtotal, tax, total amount, and payment method if visible. Format this data in a structured JSON object at the end of your response."
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }
      ]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Error processing with Claude:', error);
    throw new Error(`Claude API error: ${error.message}`);
  }
}

// Process with OpenRouter
async function processOpenRouter(filePath: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured");
  }

  // Read file as base64
  const fileData = fs.readFileSync(filePath);
  const base64Image = fileData.toString("base64");
  
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://expense-tracker-app.com"
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-opus:beta",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This is a receipt. Extract all text from it. Then analyze for: date, vendor/business name, items purchased, prices, total amount, and payment method if visible."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Extract structured data from OCR text
function extractDataFromText(text: string) {
  const data: Record<string, any> = {};
  
  console.log("Extracting data from OCR text...");
  
  // Try to extract JSON from the AI response
  try {
    // Look for JSON in code blocks first
    let jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    
    // If no code block match, look for any JSON-like structure
    if (!jsonMatch) {
      jsonMatch = text.match(/(\{[\s\S]*?\})/g);
      
      // If we have multiple matches, find the largest one (likely the most complete)
      if (jsonMatch && jsonMatch.length > 1) {
        let largestMatch = '';
        for (const match of jsonMatch) {
          if (match.length > largestMatch.length) {
            largestMatch = match;
          }
        }
        jsonMatch = [largestMatch, largestMatch];
      }
    }
    
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      console.log("Found JSON structure:", jsonStr.substring(0, 100) + (jsonStr.length > 100 ? "..." : ""));
      
      try {
        const parsedData = JSON.parse(jsonStr.trim());
        console.log("Successfully parsed JSON data");
        
        // Map the AI-extracted fields to our data structure
        // Handle various field name formats (camelCase, lowercase, with spaces, etc.)
        
        // Process date
        if (parsedData.date) {
          data.date = parsedData.date;
        } else if (parsedData.Date) {
          data.date = parsedData.Date;
        }
        
        // Process vendor/business name
        if (parsedData.vendor) {
          data.vendor = parsedData.vendor;
        } else if (parsedData.Vendor) {
          data.vendor = parsedData.Vendor;
        } else if (parsedData.business || parsedData.Business) {
          data.vendor = parsedData.business || parsedData.Business;
        } else if (parsedData.businessName || parsedData.BusinessName) {
          data.vendor = parsedData.businessName || parsedData.BusinessName;
        } else if (parsedData.merchant || parsedData.Merchant) {
          data.vendor = parsedData.merchant || parsedData.Merchant;
        }
        
        // Process location
        if (parsedData.location) {
          data.location = parsedData.location;
        } else if (parsedData.Location) {
          data.location = parsedData.Location;
        } else if (parsedData.address || parsedData.Address) {
          data.location = parsedData.address || parsedData.Address;
        }
        
        // Process total amount
        if (parsedData.total !== undefined) {
          // Handle total amount with or without currency symbol
          const totalStr = parsedData.total.toString();
          const totalMatch = totalStr.match(/\$?([0-9]+\.?[0-9]*)/);
          if (totalMatch) {
            data.total = parseFloat(totalMatch[1]);
          } else {
            data.total = parsedData.total;
          }
        } else if (parsedData.Total !== undefined) {
          const totalStr = parsedData.Total.toString();
          const totalMatch = totalStr.match(/\$?([0-9]+\.?[0-9]*)/);
          if (totalMatch) {
            data.total = parseFloat(totalMatch[1]);
          } else {
            data.total = parsedData.Total;
          }
        } else if (parsedData.amount !== undefined || parsedData.Amount !== undefined) {
          const amount = parsedData.amount !== undefined ? parsedData.amount : parsedData.Amount;
          const amountStr = amount.toString();
          const amountMatch = amountStr.match(/\$?([0-9]+\.?[0-9]*)/);
          if (amountMatch) {
            data.total = parseFloat(amountMatch[1]);
          } else {
            data.total = amount;
          }
        }
        
        // Process items list
        if (parsedData.items && Array.isArray(parsedData.items)) {
          data.items = parsedData.items;
        } else if (parsedData.Items && Array.isArray(parsedData.Items)) {
          data.items = parsedData.Items;
        } else if (parsedData.products && Array.isArray(parsedData.products)) {
          data.items = parsedData.products;
        } else if (parsedData.Products && Array.isArray(parsedData.Products)) {
          data.items = parsedData.Products;
        }
        
        // Process payment method
        if (parsedData.paymentMethod) {
          data.paymentMethod = parsedData.paymentMethod;
        } else if (parsedData.PaymentMethod) {
          data.paymentMethod = parsedData.PaymentMethod;
        } else if (parsedData.payment || parsedData.Payment) {
          data.paymentMethod = parsedData.payment || parsedData.Payment;
        }
        
        // If we successfully parsed JSON, return the data
        if (Object.keys(data).length > 0) {
          console.log("Extracted structured data:", data);
          return data;
        } else {
          console.log("Found JSON structure but couldn't extract expected fields");
        }
      } catch (parseError) {
        console.error("Failed to parse extracted JSON:", parseError);
      }
    } else {
      console.log("No JSON structure found in OCR response");
    }
  } catch (error) {
    console.log("Error while trying to extract JSON:", error);
  }
  
  // Fall back to regex-based extraction for backward compatibility
  
  // Date extraction pattern (various formats)
  const datePatterns = [
    /date:?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i,
    /([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/,
    /([a-z]{3,9}\.?\s+[0-9]{1,2},?\s+[0-9]{4})/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.date = match[1];
      break;
    }
  }
  
  // Vendor/store name extraction
  const vendorPatterns = [
    /vendor:?\s*([a-z0-9\s\.,&'-]+)/i,
    /store:?\s*([a-z0-9\s\.,&'-]+)/i,
    /merchant:?\s*([a-z0-9\s\.,&'-]+)/i,
  ];
  
  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.vendor = match[1].trim();
      break;
    }
  }
  
  // Location extraction
  const locationPatterns = [
    /location:?\s*([a-z0-9\s\.,&'-]+)/i,
    /address:?\s*([a-z0-9\s\.,&'-]+)/i, 
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.location = match[1].trim();
      break;
    }
  }
  
  // Total amount extraction
  const totalPatterns = [
    /total:?\s*\$?([0-9]+\.[0-9]{2})/i,
    /amount:?\s*\$?([0-9]+\.[0-9]{2})/i,
    /\btotal\b.*?\$?([0-9]+\.[0-9]{2})/i,
    /\$([0-9]+\.[0-9]{2})/,
  ];
  
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.total = parseFloat(match[1]);
      break;
    }
  }
  
  return data;
}

// Test OCR configuration
export async function testOCR(method: string, apiKey?: string): Promise<{ success: boolean, message: string }> {
  try {
    // Create a basic test image with text
    if (!method) {
      throw new Error("OCR method is required");
    }
    
    // For Tesseract, we can just return success as it's local
    if (method === "tesseract") {
      return { success: true, message: "Tesseract.js is available" };
    }
    
    // For other methods, we need to check the API key
    if (!apiKey) {
      throw new Error("API key is required for this OCR method");
    }
    
    // Store the API key temporarily in environment for testing
    process.env[`${method.toUpperCase()}_API_KEY`] = apiKey;
    
    // For external APIs, make a simple request to verify the API key
    switch (method) {
      case "openai":
        await testOpenAIAPI(apiKey);
        break;
      case "gemini":
        await testGeminiAPI(apiKey);
        break;
      case "claude":
        await testClaudeAPI(apiKey);
        break;
      case "openrouter":
        await testOpenRouterAPI(apiKey);
        break;
      default:
        throw new Error(`Unsupported OCR method: ${method}`);
    }
    
    return { success: true, message: `${method} API key is valid` };
  } catch (error) {
    console.error("OCR test error:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error occurred" 
    };
  }
}

async function testOpenAIAPI(apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  });
  
  if (!response.ok) {
    throw new Error("Invalid OpenAI API key or API error");
  }
}

async function testGeminiAPI(apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  
  if (!response.ok) {
    throw new Error("Invalid Gemini API key or API error");
  }
}

async function testClaudeAPI(apiKey: string) {
  try {
    // Import Anthropic SDK
    const Anthropic = require('@anthropic-ai/sdk');
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });
    
    // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
    await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: "Hello"
        }
      ]
    });
  } catch (error) {
    console.error('Error testing Claude API:', error);
    throw new Error("Invalid Anthropic API key or API error");
  }
}

async function testOpenRouterAPI(apiKey: string) {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://expense-tracker-app.com"
    }
  });
  
  if (!response.ok) {
    throw new Error("Invalid OpenRouter API key or API error");
  }
}
