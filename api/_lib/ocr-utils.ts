import fetch from 'node-fetch';
import { Buffer } from 'buffer';

// Process receipt with OCR based on the selected method
export async function processReceiptWithOCR(
  fileBuffer: Buffer,
  fileType: 'pdf' | 'image',
  method: string = "gemini",
  template: string = "general"
) {
  try {
    console.log(`Processing receipt of type ${fileType} with ${method} OCR method using template: ${template}`);

    let result;
    let effectiveMethod = method;

    // === PDF Processing Logic ===
    if (fileType === 'pdf') {
      console.log(`PDF receipt detected. Checking for vision API support...`);

      // Determine the best method for PDF (prefer vision APIs)
      if (!['gemini', 'openai', 'claude', 'openrouter'].includes(method)) {
        // If an unsupported method is chosen, try to default to a vision API
        if (process.env.GEMINI_API_KEY) {
          console.log(`Unsupported method ${method} for PDF, switching to Gemini.`);
          effectiveMethod = 'gemini';
        } else if (process.env.OPENAI_API_KEY) {
          console.log(`Unsupported method ${method} for PDF, switching to OpenAI.`);
          effectiveMethod = 'openai';
        } else if (process.env.ANTHROPIC_API_KEY) {
          console.log(`Unsupported method ${method} for PDF, switching to Claude.`);
          effectiveMethod = 'claude';
        } else if (process.env.OPENROUTER_API_KEY) {
          console.log(`Unsupported method ${method} for PDF, switching to OpenRouter.`);
          effectiveMethod = 'openrouter';
        } else {
          // No vision APIs available, provide a more helpful error message
          throw new Error(`No vision API (Gemini, OpenAI, Claude, OpenRouter) configured for PDF processing. Method '${method}' is not supported for PDFs. Please configure a vision API in the settings page.`);
        }
      } else {
        effectiveMethod = method; // Use the originally selected vision method
      }

      // Use the determined effective method for PDF processing
      console.log(`Using ${effectiveMethod} for PDF processing.`);
      switch (effectiveMethod) {
        case "gemini":
          result = await processGemini(fileBuffer, fileType, template);
          break;
        case "openai":
          result = await processOpenAI(fileBuffer, fileType, template);
          break;
        case "claude":
          result = await processClaude(fileBuffer, fileType, template);
          break;
        case "openrouter":
          result = await processOpenRouter(fileBuffer, fileType, template);
          break;
        default:
          // This case should ideally not be reached due to the logic above
          throw new Error(`Unsupported effective OCR method for PDF: ${effectiveMethod}`);
      }
    }
    // === Image Processing Logic ===
    else { // fileType is 'image'
      console.log(`Image receipt detected, processing with ${method}...`);
      // For image files, use vision APIs directly
      switch (method) {
        case "openai":
          result = await processOpenAI(fileBuffer, fileType, template);
          break;
        case "gemini":
          result = await processGemini(fileBuffer, fileType, template);
          break;
        case "claude":
          result = await processClaude(fileBuffer, fileType, template);
          break;
        case "openrouter":
          result = await processOpenRouter(fileBuffer, fileType, template);
          break;
        default:
          // If method is not a known vision API, throw error
          throw new Error(`Unsupported OCR method for image: ${method}. Only Gemini, OpenAI, Claude, and OpenRouter are supported.`);
      }
    }

    // --- Post-processing (common for both PDF and Image results) ---
    if (!result) {
      throw new Error("OCR processing failed to produce a result.");
    }
    console.log(`OCR result (first 100 chars): ${result.substring(0, 100)}...`);

    try {
      const extractedData = extractDataFromText(result);
      console.log("Successfully extracted structured data:", extractedData);
      return { success: true, text: result, extractedData };
    } catch (dataError) {
      console.log("No structured JSON found, attempting to parse raw text for basic info");
      const text = result.toLowerCase();
      const basicData: Record<string, any> = {};
      // Simplified fallback extraction...
      if (text.includes('hotel') || text.includes('room')) basicData.type = 'Accommodation';
      else if (text.includes('restaurant') || text.includes('food')) basicData.type = 'Food';
      else if (text.includes('taxi') || text.includes('flight')) basicData.type = 'Transportation';
      else basicData.type = 'Other';
      const dateMatches = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
      if (dateMatches) basicData.date = dateMatches[0];
      const amountMatches = text.match(/\$\s*(\d+\.\d{2})/);
      if (amountMatches) basicData.total_amount = amountMatches[1];
      console.log("Extracted basic data from raw text:", basicData);
      return { success: true, text: result, extractedData: basicData, extractionError: "No structured JSON data found" };
    }
  } catch (error) {
    console.error("OCR processing error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error occurred" };
  }
}

// Function specifically for processing odometer images with an AI Vision API
export async function processOdometerImageWithAI(
  fileBuffer: Buffer,
  method: string
): Promise<{ success: boolean, reading?: number, error?: string }> {
  console.log(`Processing odometer image with AI method: ${method}`);

  try {
    let rawResultText: string | undefined;

    // Choose the appropriate AI processing function based on the method
    // We pass a specific "odometer" template/prompt
    switch (method) {
      case "gemini":
        rawResultText = await processGemini(fileBuffer, 'image', "odometer");
        break;
      case "openai":
        rawResultText = await processOpenAI(fileBuffer, 'image', "odometer");
        break;
      case "claude":
        rawResultText = await processClaude(fileBuffer, 'image', "odometer");
        break;
      case "openrouter":
        rawResultText = await processOpenRouter(fileBuffer, 'image', "odometer");
        break;
      default:
        throw new Error(`Unsupported AI OCR method for odometer: ${method}`);
    }

    if (!rawResultText) {
      throw new Error("AI OCR processing returned no result.");
    }

    console.log(`AI raw output for odometer: ${rawResultText}`);

    // Attempt to parse potential JSON first (in case the AI returns structured data)
    let extractedReadingStr: string | undefined;
    try {
      // Attempt to find JSON within the response, potentially wrapped in markdown
      const jsonMatch = rawResultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawResultText.match(/(\{[\s\S]*?\})/);
      let jsonStrToParse = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawResultText;

      const jsonData = JSON.parse(jsonStrToParse.trim());
      // Look for common keys where the reading might be stored
      extractedReadingStr = jsonData.reading || jsonData.odometer || jsonData.value || jsonData.number || jsonData.text;
      if (typeof extractedReadingStr !== 'string' && extractedReadingStr !== undefined) {
        extractedReadingStr = String(extractedReadingStr); // Convert potential number to string
      }
      console.log("Extracted reading from JSON:", extractedReadingStr);
    } catch (e) {
      // If JSON parsing fails or no relevant key found, assume the raw text is the reading
      if (!extractedReadingStr) {
        extractedReadingStr = rawResultText;
        console.log("No JSON or relevant key found, using raw text:", extractedReadingStr);
      }
    }

    // Clean up the extracted text: keep only digits and potentially a single decimal point
    const cleanedText = extractedReadingStr?.replace(/[^0-9.]/g, '') || '';
    // Ensure only one decimal point exists if multiple were kept
    const parts = cleanedText.split('.');
    const finalCleanedText = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : parts[0];

    console.log(`Cleaned AI output: ${finalCleanedText}`);

    // Attempt to parse the cleaned text as a number
    const reading = parseFloat(finalCleanedText);

    if (isNaN(reading)) {
      console.warn("Could not parse a valid number from AI OCR text.");
      return { success: false, error: "Could not extract a valid odometer reading from the image using AI." };
    }

    console.log(`Extracted odometer reading via AI: ${reading}`);
    return { success: true, reading };

  } catch (error) {
    console.error(`AI OCR processing error (${method}):`, error);
    return { success: false, error: error instanceof Error ? error.message : `AI OCR (${method}) failed` };
  }
}

// Process with OpenAI Vision API
async function processOpenAI(
  fileBuffer: Buffer,
  fileType: 'pdf' | 'image',
  template: string = "general"
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const base64Image = fileBuffer.toString("base64");
  // Basic MIME type detection for OpenAI
  const mimeType = fileType === 'pdf' ? 'application/pdf' : 'image/jpeg';

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4-vision-preview", // Or gpt-4o if preferred
      messages: [{ role: "user", content: [
        { type: "text", text: template === 'odometer'
          ? "This is an image of a car's odometer. Extract ONLY the numerical reading displayed. Ignore any other text or symbols (like 'km', 'miles', 'trip'). Return ONLY the number as plain text, e.g., '123456.7'. If you can return JSON, use the format {\"reading\": \"123456.7\"}."
          : template === 'travel'
          ? "This is a travel expense receipt (image or PDF). Prioritize extracting: Transaction Date (date), Cost/Amount (cost), Currency Code (currency, e.g., USD, EUR, CAD), and a concise Description/Purpose (description). Return ONLY a structured JSON object with these fields: date, cost, currency, description."
          : "This is a general receipt (image or PDF). Extract all visible text. Then analyze for: date, vendor/business name (vendor), location, items purchased with prices (items array), total amount (total), and payment method (paymentMethod). Return ONLY a structured JSON object."
        },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
      ]}],
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  interface OpenAIResponse { choices?: Array<{ message?: { content?: string; }; }>; }
  const data = await response.json() as OpenAIResponse;
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  throw new Error("Unexpected response format from OpenAI API");
}

// Process with Google Gemini
async function processGemini(
  fileBuffer: Buffer,
  fileType: 'pdf' | 'image',
  template: string = "general"
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini API key not found in environment variables");
    throw new Error("Gemini API key not configured. Please set your API key in the settings page.");
  }
  console.log(`Using Gemini API key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

  const base64Data = fileBuffer.toString("base64");

  // Determine MIME type based on file type
  let mimeType = fileType === 'pdf' ? 'application/pdf' : 'image/jpeg';

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: template === 'odometer'
            ? "This is an image of a car's odometer. Extract ONLY the numerical reading displayed. Ignore any other text or symbols (like 'km', 'miles', 'trip'). Return ONLY the number as plain text, e.g., '123456.7'. If you can return JSON, use the format {\"reading\": \"123456.7\"}."
            : template === 'travel'
            ? "You are an AI specialized in extracting data from travel expense receipts (image or PDF). Extract the following REQUIRED fields: Transaction Date (date as string 'YYYY-MM-DD' if possible, otherwise original format), Cost/Amount (cost as a number), Currency Code (currency as a 3-letter string like 'USD', 'EUR', 'CAD'), a concise Description/Purpose (description as string), Expense Type (type as string, e.g., Food, Transportation), Vendor Name (vendor as string), and Location (location as string). Return ONLY a valid JSON object containing ALL these fields: date, cost, currency, description, type, vendor, location. Example: {\"date\": \"2024-03-15\", \"cost\": 45.50, \"currency\": \"USD\", \"description\": \"Taxi fare\", \"type\": \"Transportation\", \"vendor\": \"City Cabs\", \"location\": \"New York, NY\"}"
            : "You are an AI specialized in reading and extracting data from general receipts (image or PDF). Extract all visible text. Then, analyze to identify: date, vendor/business name (vendor), location, individual items purchased with prices (items array with name and price), subtotal, tax, total amount (total), and payment method (paymentMethod). Return ONLY a structured JSON object with these fields."
          },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    interface GeminiResponse { candidates?: Array<{ content?: { parts?: Array<{ text?: string; }>; }; }>; }
    const data = await response.json() as GeminiResponse;
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text;
    throw new Error("Unexpected response format from Gemini API");
  } catch (error) {
    console.error("Error processing with Gemini:", error);
    throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Process with Anthropic Claude
async function processClaude(
  fileBuffer: Buffer,
  fileType: 'pdf' | 'image',
  template: string = "general"
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const base64Image = fileBuffer.toString("base64");
  // Basic MIME type detection for Claude
  const mimeType = fileType === 'pdf' ? 'application/pdf' : 'image/jpeg';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 2000,
        system: "You are an AI assistant specialized in extracting and structuring data from receipts. Return ONLY a valid JSON object.",
        messages: [{ 
          role: "user", 
          content: [
            { type: "text", text: template === 'odometer'
              ? "This is an image of a car's odometer. Extract ONLY the numerical reading displayed. Ignore any other text or symbols (like 'km', 'miles', 'trip'). Return ONLY the number as plain text, e.g., '123456.7'. If you can return JSON, use the format {\"reading\": \"123456.7\"}."
              : template === 'travel'
              ? "This is a travel expense receipt (image or PDF). Prioritize extracting: Transaction Date (date), Cost/Amount (cost), Currency Code (currency, e.g., USD, EUR, CAD), and a concise Description/Purpose (description). Return ONLY a structured JSON object with these fields: date, cost, currency, description."
              : "This is a general receipt (image or PDF). First, extract all visible text. Second, analyze to identify: date, vendor/business name (vendor), location, items purchased with prices (items array), total amount (total), and payment method (paymentMethod). Format this data in a structured JSON object at the end."
            },
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64Image } }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${errorText}`);
    }

    interface ClaudeResponse { content?: Array<{ text?: string; }>; }
    const data = await response.json() as ClaudeResponse;
    if (data?.content?.[0]?.text) return data.content[0].text;
    throw new Error("Unexpected response format from Claude API");
  } catch (error) {
    console.error('Error processing with Claude:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Claude API error: ${errorMessage}`);
  }
}

// Process with OpenRouter
async function processOpenRouter(
  fileBuffer: Buffer,
  fileType: 'pdf' | 'image',
  template: string = "general"
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const base64Image = fileBuffer.toString("base64");
  // Basic MIME type detection
  const mimeType = fileType === 'pdf' ? 'application/pdf' : 'image/jpeg';

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${apiKey}`, 
      "HTTP-Referer": "https://expense-tracker-app.com" 
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-haiku", // Use a model known for vision, like Claude Haiku via OpenRouter
      messages: [{ role: "user", content: [
        { type: "text", text: template === 'odometer'
          ? "This is an image of a car's odometer. Extract ONLY the numerical reading displayed. Ignore any other text or symbols (like 'km', 'miles', 'trip'). Return ONLY the number as plain text, e.g., '123456.7'. If you can return JSON, use the format {\"reading\": \"123456.7\"}."
          : template === 'travel'
          ? "This is a travel expense receipt (image or PDF). Prioritize extracting: Transaction Date (date), Cost/Amount (cost), Currency Code (currency, e.g., USD, EUR, CAD), and a concise Description/Purpose (description). Return ONLY a structured JSON object with these fields: date, cost, currency, description."
          : "This is a general receipt (image or PDF). Extract all visible text. Then analyze for: date, vendor/business name (vendor), location, items purchased with prices (items array), total amount (total), and payment method (paymentMethod). Return ONLY a structured JSON object."
        },
        // OpenRouter often uses image_url format even for base64
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
      ]}]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${errorText}`);
  }

  interface OpenRouterResponse { choices?: Array<{ message?: { content?: string; }; }>; }
  const data = await response.json() as OpenRouterResponse;
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  throw new Error("Unexpected response format from OpenRouter API");
}

// Extract structured data from OCR text
function extractDataFromText(text: string) {
  const data: Record<string, any> = {};
  console.log("Extracting data from OCR text...");

  try {
    // First try to extract JSON from markdown code blocks
    let jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let jsonContent: string | null = null;

    // If found in markdown, clean it up
    if (jsonMatch && jsonMatch.length > 1) {
      console.log("Found JSON in markdown code block, extracting content");
      // Extract the content between the markdown delimiters
      jsonContent = jsonMatch[1].trim();
    }
    // If not found in markdown, try to find JSON objects directly
    else {
      jsonMatch = text.match(/(\{[\s\S]*?\})/g);
      if (jsonMatch && jsonMatch.length > 0) {
        let largestMatch = '';
        // Find the largest JSON-like string if multiple are found
        for (const match of jsonMatch) {
          if (match.length > largestMatch.length) {
            largestMatch = match;
          }
        }
        jsonContent = largestMatch; // Use the largest match as potential JSON content
      }
    }

    if (jsonContent) { // Check if we found potential JSON content
      console.log("Found potential JSON structure:", jsonContent.substring(0, 100) + (jsonContent.length > 100 ? "..." : ""));
      try {
        const parsedData = JSON.parse(jsonContent.trim());
        console.log("Successfully parsed JSON data");

        // --- Map fields based on common names ---
        // Date
        data.date = parsedData.date || parsedData.Date || parsedData.transactionDate || parsedData.TransactionDate;
        // Vendor
        data.vendor = parsedData.vendor || parsedData.Vendor || parsedData.business || parsedData.Business || parsedData.businessName || parsedData.BusinessName || parsedData.merchant || parsedData.Merchant;
        // Location
        data.location = parsedData.location || parsedData.Location || parsedData.address || parsedData.Address;
        // Cost (replaces Total)
        const costKeys = ['cost', 'Cost', 'total', 'Total', 'totalAmount', 'TotalAmount', 'amount', 'Amount'];
        for (const key of costKeys) {
          if (parsedData[key] !== undefined) {
            const costStr = String(parsedData[key]);
            // Try to extract number, removing currency symbols/commas
            const costMatch = costStr.replace(/[^0-9.]/g, '').match(/([0-9]+\.?[0-9]*)/);
            data.cost = costMatch ? parseFloat(costMatch[1]) : parsedData[key]; // Store as number if possible
            break;
          }
        }
        // Currency
        data.currency = parsedData.currency || parsedData.Currency || parsedData.currencyCode || parsedData.CurrencyCode;
        // Items
        const itemsKeys = ['items', 'Items', 'products', 'Products', 'lineItems', 'LineItems'];
        for (const key of itemsKeys) {
          if (parsedData[key] && Array.isArray(parsedData[key])) {
            data.items = parsedData[key];
            break;
          }
        }
        // Payment Method
        data.paymentMethod = parsedData.paymentMethod || parsedData.PaymentMethod || parsedData.payment || parsedData.Payment;
        // Description (for travel template)
        data.description = parsedData.description || parsedData.Description || parsedData.purpose || parsedData.Purpose;
        // Type (Add mapping for type)
        data.type = parsedData.type || parsedData.Type || parsedData.expenseType || parsedData.ExpenseType || parsedData.category || parsedData.Category;
        // --- End Field Mapping ---

        if (Object.keys(data).some(key => data[key] !== undefined)) {
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

  // Fallback regex extraction (simplified)
  console.log("Falling back to basic regex extraction...");
  const dateMatch = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/); // Keep date regex
  if (dateMatch) data.date = dateMatch[1];
  // Updated regex for cost/amount, more flexible
  const costMatch = text.match(/(?:total|amount|cost)[:\s]*\$?([0-9,]+\.[0-9]{2})/i) || text.match(/[\$€£]\s?([0-9,]+\.[0-9]{2})/);
  if (costMatch) data.cost = parseFloat(costMatch[1].replace(/,/g, '')); // Remove commas before parsing
  // Basic currency regex (example, might need refinement)
  const currencyMatch = text.match(/\b(USD|EUR|CAD|GBP|JPY)\b/i);
  if (currencyMatch) data.currency = currencyMatch[1].toUpperCase();

  return data;
}

// Test OCR configuration
export async function testOCR(method: string, apiKey?: string): Promise<{ success: boolean, message: string }> {
  try {
    if (!method) throw new Error("OCR method is required");

    if (!apiKey) throw new Error("API key is required for this OCR method");

    // Store the API key temporarily in environment for testing
    // Note: This is still non-persistent, relies on backend env vars for actual use
    process.env[`${method.toUpperCase()}_API_KEY`] = apiKey;

    switch (method) {
      case "openai": await testOpenAIAPI(apiKey); break;
      case "gemini": await testGeminiAPI(apiKey); break;
      case "claude": await testClaudeAPI(apiKey); break;
      case "openrouter": await testOpenRouterAPI(apiKey); break;
      default: throw new Error(`Unsupported OCR method: ${method}`);
    }

    return { success: true, message: `${method} API key is valid` };
  } catch (error) {
    console.error("OCR test error:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error occurred" };
  }
}

async function testOpenAIAPI(apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/models", { headers: { "Authorization": `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error("Invalid OpenAI API key or API error");
}

async function testGeminiAPI(apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!response.ok) throw new Error("Invalid Gemini API key or API error");
}

async function testClaudeAPI(apiKey: string) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hello" }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Claude API error: ${await response.text()}`);
    }
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
  if (!response.ok) throw new Error("Invalid OpenRouter API key or API error");
}