import { createWorker } from "tesseract.js";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";

// Process receipt with OCR based on the selected method
export async function processReceiptWithOCR(filePath: string, method: string = "tesseract") {
  try {
    // Ensure the file exists
    if (!fs.existsSync(filePath)) {
      throw new Error("Receipt file not found");
    }

    let result;
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

    // Extract structured data from the OCR text
    const extractedData = extractDataFromText(result);
    return {
      success: true,
      text: result,
      extractedData
    };
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
  const worker = await createWorker();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
  
  const { data: { text } } = await worker.recognize(filePath);
  await worker.terminate();
  
  return text;
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
  
  // Try to extract JSON from the AI response
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[2];
      const parsedData = JSON.parse(jsonStr.trim());
      
      // Map the AI-extracted fields to our data structure
      if (parsedData.date) {
        data.date = parsedData.date;
      }
      
      if (parsedData.vendor) {
        data.vendor = parsedData.vendor;
      }
      
      if (parsedData.location) {
        data.location = parsedData.location;
      }
      
      if (parsedData.total) {
        // Handle total amount with or without currency symbol
        const totalStr = parsedData.total.toString();
        const totalMatch = totalStr.match(/\$?([0-9]+\.?[0-9]*)/);
        if (totalMatch) {
          data.total = parseFloat(totalMatch[1]);
        }
      }
      
      if (parsedData.items && Array.isArray(parsedData.items)) {
        data.items = parsedData.items;
      }
      
      if (parsedData.paymentMethod) {
        data.paymentMethod = parsedData.paymentMethod;
      }
      
      // If we successfully parsed JSON, return the data
      if (Object.keys(data).length > 0) {
        return data;
      }
    }
  } catch (error) {
    console.log("Failed to parse JSON from AI response, falling back to regex", error);
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
