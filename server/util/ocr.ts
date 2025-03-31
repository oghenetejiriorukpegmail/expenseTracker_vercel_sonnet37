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
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "This is a receipt. Extract all text from it. Then analyze for: date, vendor/business name, items purchased, prices, total amount, and payment method if visible."
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Process with Anthropic Claude
async function processClaude(filePath: string) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("Claude API key not configured");
  }

  // Read file as base64
  const fileData = fs.readFileSync(filePath);
  const base64Image = fileData.toString("base64");
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This is a receipt. Extract all text from it. Then analyze for: date, vendor/business name, items purchased, prices, total amount, and payment method if visible."
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
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
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
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: "Hello"
        }
      ]
    })
  });
  
  if (!response.ok) {
    throw new Error("Invalid Claude API key or API error");
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
