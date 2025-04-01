import express, { type Express, Request } from "express";
import { format } from "date-fns"; // Import format function
import { createServer, type Server } from "http";
// Remove direct storage import: import { storage } from "./storage";
// Remove setupAuth import as it's handled in index.ts: import { setupAuth } from "./auth";
import { z } from "zod";
import { insertTripSchema, insertExpenseSchema, Expense } from "@shared/schema"; // Import Expense type
import { upload } from "./middleware/multer-config";
import { processReceiptWithOCR, testOCR } from "./util/ocr";
import { promises as fs } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { createWriteStream } from "fs";
import multer from "multer";
import type { IStorage } from "./storage"; // Import the storage interface type
import { updateOcrApiKey, setDefaultOcrMethod, loadConfig, saveConfig } from "./config"; // Import config functions

// Define request type with file from multer
interface MulterRequest extends Request {
  file?: any; // Use any type to avoid TypeScript errors
}

// Update function signature to accept storage instance
export async function registerRoutes(app: Express, storage: IStorage): Promise<Server> {
  // Authentication is now setup in index.ts before calling this
  // setupAuth(app);

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Trips routes
  app.get("/api/trips", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      const trips = await storage.getTripsByUserId(req.user!.id);
      res.json(trips);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/trips", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const validatedData = insertTripSchema.parse(req.body);
      const trip = await storage.createTrip({
        ...validatedData,
        userId: req.user!.id,
      });
      
      res.status(201).json(trip);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/trips/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const tripId = parseInt(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).send("Invalid trip ID");
      }
      
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).send("Trip not found");
      }
      
      if (trip.userId !== req.user!.id) {
        return res.status(403).send("Forbidden");
      }
      
      const validatedData = insertTripSchema.parse(req.body);
      const updatedTrip = await storage.updateTrip(tripId, validatedData);
      
      res.json(updatedTrip);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/trips/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const tripId = parseInt(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).send("Invalid trip ID");
      }
      
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).send("Trip not found");
      }
      
      if (trip.userId !== req.user!.id) {
        return res.status(403).send("Forbidden");
      }
      
      await storage.deleteTrip(tripId);
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Expenses routes
  app.get("/api/expenses", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const tripName = req.query.tripName as string | undefined;
      
      let expenses;
      if (tripName) {
        expenses = await storage.getExpensesByTripName(req.user!.id, tripName);
      } else {
        expenses = await storage.getExpensesByUserId(req.user!.id);
      }
      
      res.json(expenses);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/expenses/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const expenseId = parseInt(req.params.id);
      if (isNaN(expenseId)) {
        return res.status(400).send("Invalid expense ID");
      }
      
      const expense = await storage.getExpense(expenseId);
      if (!expense) {
        return res.status(404).send("Expense not found");
      }
      
      if (expense.userId !== req.user!.id) {
        return res.status(403).send("Forbidden");
      }
      
      res.json(expense);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/expenses", (upload as any).single("receipt"), async (req: MulterRequest, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      // Load config to check current OCR template
      const config = loadConfig();
      const currentTemplate = config.ocrTemplate || 'general';
      
      // Parse and validate the expense data
      let expenseData: any = {
        date: req.body.date,
        cost: parseFloat(req.body.cost),
        tripName: req.body.tripName,
        comments: req.body.comments || '',
      };
      
      // Handle template-specific fields
      if (currentTemplate === 'travel') {
        // For travel template
        // Use description as type if type is not provided
        expenseData.type = req.body.type || req.body.description || 'Travel Expense';
        
        // Store description in comments if not empty
        if (req.body.description && (!expenseData.comments || expenseData.comments.trim() === '')) {
          expenseData.comments = req.body.description;
        } else if (req.body.description) {
          // Append description to comments if both exist
          expenseData.comments = `${req.body.description}\n\n${expenseData.comments}`;
        }
        
        // Use provided values or defaults for vendor and location
        expenseData.vendor = req.body.vendor || 'Travel Vendor';
        expenseData.location = req.body.location || 'Travel Location';
      } else {
        // For general template
        expenseData.type = req.body.type;
        expenseData.vendor = req.body.vendor;
        expenseData.location = req.body.location;
      }
      
      // Add the receipt path if a file was uploaded
      let receiptPath = null;
      if (req.file) {
        receiptPath = req.file.filename;
      }
      
      // Create the expense in the database
      const expense = await storage.createExpense({
        ...expenseData,
        userId: req.user!.id,
        receiptPath,
      });
      
      res.status(201).json(expense);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/expenses/:id", (upload as any).single("receipt"), async (req: MulterRequest, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const expenseId = parseInt(req.params.id);
      if (isNaN(expenseId)) {
        return res.status(400).send("Invalid expense ID");
      }
      
      const expense = await storage.getExpense(expenseId);
      if (!expense) {
        return res.status(404).send("Expense not found");
      }
      
      if (expense.userId !== req.user!.id) {
        return res.status(403).send("Forbidden");
      }
      
      // Load config to check current OCR template
      const config = loadConfig();
      const currentTemplate = config.ocrTemplate || 'general';
      
      // Parse and validate the expense data
      let expenseData: any = {
        date: req.body.date,
        cost: parseFloat(req.body.cost),
        tripName: req.body.tripName,
        comments: req.body.comments || '',
      };
      
      // Handle template-specific fields
      if (currentTemplate === 'travel') {
        // For travel template
        // Use description as type if type is not provided
        expenseData.type = req.body.type || req.body.description || 'Travel Expense';
        
        // Store description in comments if not empty
        if (req.body.description && (!expenseData.comments || expenseData.comments.trim() === '')) {
          expenseData.comments = req.body.description;
        } else if (req.body.description) {
          // Append description to comments if both exist
          expenseData.comments = `${req.body.description}\n\n${expenseData.comments}`;
        }
        
        // Use provided values or defaults for vendor and location
        expenseData.vendor = req.body.vendor || 'Travel Vendor';
        expenseData.location = req.body.location || 'Travel Location';
      } else {
        // For general template
        expenseData.type = req.body.type;
        expenseData.vendor = req.body.vendor;
        expenseData.location = req.body.location;
      }
      
      // Update receipt path if a new file was uploaded
      let receiptPath = expense.receiptPath;
      if (req.file) {
        // Delete the old receipt if it exists
        if (expense.receiptPath) {
          const oldReceiptPath = path.join(process.cwd(), "uploads", expense.receiptPath);
          await fs.unlink(oldReceiptPath).catch(() => {});
        }
        receiptPath = req.file.filename;
      }
      
      // Update the expense in the database
      const updatedExpense = await storage.updateExpense(expenseId, {
        ...expenseData,
        receiptPath,
      });
      
      res.json(updatedExpense);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/expenses/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const expenseId = parseInt(req.params.id);
      if (isNaN(expenseId)) {
        return res.status(400).send("Invalid expense ID");
      }
      
      const expense = await storage.getExpense(expenseId);
      if (!expense) {
        return res.status(404).send("Expense not found");
      }
      
      if (expense.userId !== req.user!.id) {
        return res.status(403).send("Forbidden");
      }
      
      // Delete the receipt file if it exists
      if (expense.receiptPath) {
        const receiptPath = path.join(process.cwd(), "uploads", expense.receiptPath);
        await fs.unlink(receiptPath).catch(() => {});
      }
      
      await storage.deleteExpense(expenseId);
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // OCR processing routes
  app.post("/api/ocr/process", (upload as any).single("receipt"), async (req: MulterRequest, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      if (!req.file) {
        return res.status(400).send("No receipt file uploaded");
      }
      
      const filePath = path.join(process.cwd(), "uploads", req.file.filename);
      
      // Get file extension and check if it's a PDF
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      const isPdfFile = fileExtension === '.pdf';
      
      // Get the OCR method from the request or from the config
      const config = loadConfig();
      let method = req.body.method || config.defaultOcrMethod || "gemini";
      
      // If it's a PDF and the method is tesseract, recommend using Gemini, OpenAI, or Claude
      if (isPdfFile && method === "tesseract") {
        console.log("PDF detected with tesseract method. Recommending Gemini, OpenAI, or Claude for better results.");
        // We'll continue with tesseract, but the user will see a message in the logs
      }
      
      // Check if we have an API key for the selected method
      if (method !== "tesseract") {
        const envVarName = `${method.toUpperCase()}_API_KEY`;
        const apiKey = process.env[envVarName];
        
        if (!apiKey) {
          console.log(`No API key found for ${method} OCR method`);
          return res.status(400).json({
            success: false,
            error: `No API key configured for ${method}. Please set your API key in the settings page.`
          });
        }
        
        console.log(`Using ${method} OCR method with API key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
      }
      
      // Read the template from the request body or config
      const template = req.body.template || config.ocrTemplate || 'general'; // Default to 'general' if not provided

      console.log(`Processing receipt with ${method} OCR method using template: ${template}`);
      // Pass the template to the processing function
      const result = await processReceiptWithOCR(filePath, method, template);
      
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
      
      // Get total cost
      const getCostValue = (): string => {
        if (extractedData && 
            typeof extractedData === 'object' && 
            'total' in extractedData && 
            extractedData.total) {
          return String(extractedData.total);
        }
        return '';
      };
      
      // Structure data for our settings verification table based on the travel template fields (required + optional)
      const dateValue = getExtractedValue('date');
      const costValue = getExtractedValue('cost');
      const currencyValue = getExtractedValue('currency');
      const descriptionValue = getExtractedValue('description');
      // Re-add extraction for optional fields
      const typeValue = getExtractedValue('type');
      const vendorValue = getExtractedValue('vendor');
      const locationValue = getExtractedValue('location');
      
      // Remove old field extractions (vendor, location, type, totalAmountValue loop)
      
      // Add more verbose logging of what we found
      // Update console logging to reflect the new fields
      // Update console logging to include optional fields
      console.log('Extracted data summary (for verification table):');
      console.log('- Date:', dateValue || 'Not found');
      console.log('- Cost:', costValue || 'Not found');
      console.log('- Currency:', currencyValue || 'Not found');
      console.log('- Description:', descriptionValue || 'Not found');
      console.log('- Type:', typeValue || 'Not found');
      console.log('- Vendor:', vendorValue || 'Not found');
      console.log('- Location:', locationValue || 'Not found');
      
      // descriptionValue is already extracted above
      
      // Combined response with both the original extracted data and formatted data for form fields
      const formattedData: any = {
        ...result,
        // Updated data structure for the verification table display, including optional fields
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
          // Update formData for potential auto-fill
          date: dateValue,
          cost: costValue,
          currency: currencyValue, // Keep currency in case needed later
          description: descriptionValue,
          // Add back type, vendor, location
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
      if (isPdfFile && method === "tesseract" && (!result.extractedData || Object.keys(result.extractedData).length === 0)) {
        formattedData.pdfMessage = "PDF processing with Tesseract has limited capabilities. For better results with PDF files, please use Gemini, OpenAI, or Claude OCR methods in the settings page.";
      }
      
      res.json(formattedData);
    } catch (error) {
      console.error("OCR processing error:", error);
      next(error);
    }
  });
  
// Helper function to guess expense type based on receipt content
function guessExpenseType(text: string, vendor: string): string {
  const lowerText = text.toLowerCase();
  const lowerVendor = vendor ? vendor.toLowerCase() : '';
  
  console.log('Guessing expense type from text:', lowerText.substring(0, 100) + '...');
  
  // Check for transportation-related keywords
  const transportKeywords = [
    'airline', 'flight', 'taxi', 'uber', 'lyft', 'train', 'transit', 'bus', 'car rental',
    'rental car', 'parking', 'gas', 'fuel', 'metro', 'subway', 'transport', 'ticket'
  ];
  
  if (
    transportKeywords.some(keyword => lowerText.includes(keyword)) ||
    (lowerVendor && 
      ['airlines', 'air', 'taxi', 'uber', 'lyft', 'train', 'transit', 'hertz', 'avis', 'rental'].some(
        keyword => lowerVendor.includes(keyword)
      )
    )
  ) {
    console.log('Detected as: Transportation');
    return 'Transportation';
  }
  
  // Check for accommodation-related keywords
  const accommodationKeywords = [
    'hotel', 'inn', 'motel', 'resort', 'airbnb', 'lodging', 'stay', 'suite', 'room',
    'accommodation', 'booking.com', 'reservation', 'nights'
  ];
  
  if (
    accommodationKeywords.some(keyword => lowerText.includes(keyword)) ||
    (lowerVendor && 
      ['hotel', 'inn', 'motel', 'resort', 'lodging', 'airbnb', 'booking', 'marriott', 'hilton'].some(
        keyword => lowerVendor.includes(keyword)
      )
    )
  ) {
    console.log('Detected as: Accommodation');
    return 'Accommodation';
  }
  
  // Check for food-related keywords
  const foodKeywords = [
    'restaurant', 'cafe', 'coffee', 'breakfast', 'lunch', 'dinner', 'food', 'meal',
    'pizza', 'burger', 'sandwich', 'drink', 'menu', 'order', 'takeout', 'delivery',
    'appetizer', 'dessert', 'entree', 'beer', 'wine', 'cocktail', 'beverage', 'bakery',
    'server', 'waiter', 'chef', 'kitchen', 'diner', 'bistro', 'grill', 'starbucks', 'mcdonalds'
  ];
  
  if (
    foodKeywords.some(keyword => lowerText.includes(keyword)) ||
    (lowerVendor && 
      ['restaurant', 'cafe', 'coffee', 'bistro', 'grill', 'kitchen', 'bakery', 'pizzeria'].some(
        keyword => lowerVendor.includes(keyword)
      )
    )
  ) {
    console.log('Detected as: Food');
    return 'Food';
  }
  
  // Check for other common expense types
  if (lowerText.includes('office') || lowerText.includes('supplies') || lowerText.includes('stationery')) {
    console.log('Detected as: Office Supplies');
    return 'Office Supplies';
  }
  
  if (lowerText.includes('entertainment') || lowerText.includes('movie') || lowerText.includes('theatre') || lowerText.includes('theater')) {
    console.log('Detected as: Entertainment');
    return 'Entertainment';
  }
  
  // Default to "Other" if no matches
  console.log('No specific type detected, using: Other');
  return 'Other';
}

// Helper function to guess expense purpose for travel template
function guessExpensePurpose(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Check for business meeting related keywords
  if (lowerText.includes('meeting') || lowerText.includes('conference') ||
      lowerText.includes('client') || lowerText.includes('business')) {
    return 'Business Meeting';
  }
  
  // Check for transportation related keywords
  if (lowerText.includes('flight') || lowerText.includes('airline') ||
      lowerText.includes('airport') || lowerText.includes('taxi') ||
      lowerText.includes('uber') || lowerText.includes('train')) {
    return 'Transportation';
  }
  
  // Check for accommodation related keywords
  if (lowerText.includes('hotel') || lowerText.includes('lodging') ||
      lowerText.includes('stay') || lowerText.includes('room')) {
    return 'Accommodation';
  }
  
  // Check for meal related keywords
  if (lowerText.includes('restaurant') || lowerText.includes('meal') ||
      lowerText.includes('dinner') || lowerText.includes('lunch') ||
      lowerText.includes('breakfast')) {
    return 'Meal';
  }
  
  // Default to generic travel expense
  return 'Travel Expense';
}

  app.post("/api/test-ocr", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const { method, apiKey, ocrApiKey } = req.body;
      
      // Use ocrApiKey if provided, otherwise use apiKey for backward compatibility
      const actualApiKey = ocrApiKey !== undefined ? ocrApiKey : apiKey;
      
      const result = await testOCR(method, actualApiKey);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Update environment settings
  app.post("/api/update-env", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const { ocrMethod, apiKey, ocrApiKey, ocrTemplate } = req.body;
      
      // Use ocrApiKey if provided, otherwise use apiKey for backward compatibility
      const actualApiKey = ocrApiKey !== undefined ? ocrApiKey : apiKey;
      
      // Persist the OCR method and API key in the config file
      if (ocrMethod) {
        setDefaultOcrMethod(ocrMethod);
        console.log(`Set default OCR method to ${ocrMethod}`);
        
        if (actualApiKey) {
          updateOcrApiKey(ocrMethod, actualApiKey);
          console.log(`Updated API key for ${ocrMethod}`);
        }
      }
      
      // Store the template preference in the config
      if (ocrTemplate) {
        const config = loadConfig();
        config.ocrTemplate = ocrTemplate;
        saveConfig(config);
        console.log(`Set OCR template to ${ocrTemplate}`);
      }
      
      res.json({ success: true, message: "Settings updated successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Export expenses to Excel
  app.get("/api/export-expenses", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const tripName = req.query.tripName as string | undefined;
      
      let expenses;
      if (tripName) {
        expenses = await storage.getExpensesByTripName(req.user!.id, tripName);
      } else {
        expenses = await storage.getExpensesByUserId(req.user!.id);
      }
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // --- Prepare data for the new Excel format ---
      
      // 1. Employee and Application Date Info
      const headerData = [
        ["Employee Name", req.user!.username], // Use logged-in username
        ["Application Date", format(new Date(), "MMMM do, yyyy")] // Current date
      ];
      
      // 2. Expense Table Data
      const expenseTableData = expenses.map((expense: Expense) => ({
        Date: format(new Date(expense.date), "MM/dd/yyyy"), // Format date
        Cost: typeof expense.cost === 'number' ? expense.cost : parseFloat(expense.cost), // Ensure cost is number
        Currency: "CAD", // Hardcoded currency as per example
        "Description of Travel Expenses": expense.comments || expense.description || expense.type || "", // Use comments, fallback to description/type
      }));

      // --- Create Worksheet ---
      
      // Create worksheet starting with Employee/Date info
      const worksheet = XLSX.utils.aoa_to_sheet(headerData);
      
      // Define the starting row for the expense table (leaving space below header)
      // headerData has 2 rows, add title row, add empty row = start at row 5 (index 4)
      // Let's simplify and start right after headerData for now. Adjust row index if needed.
      const expenseTableStartRow = headerData.length + 2; // Add space for title and headers

      // Add the main expense table headers and data below the header info
      XLSX.utils.sheet_add_json(worksheet, expenseTableData, {
        origin: `A${expenseTableStartRow}`, // Start table data below header + space
        skipHeader: false // Include headers from expenseTableData keys
      });

      // Optional: Add main title (Requires more complex cell manipulation)
      // Example: worksheet['C3'] = { v: "EXPENSES & TRAVEL REIMBURSEMENT FORM", t: 's', s: { font: { bold: true }, alignment: { horizontal: 'center'} } };
      // Example: worksheet['!merges'] = [{ s: { r: 2, c: 2 }, e: { r: 2, c: 4 } }]; // Merge C3:E3

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
      
      // Optional: Set column widths (Requires direct worksheet manipulation)
      // Example: worksheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 50 }]; // A, B, C, D widths
      
      // Write to buffer
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=expenses-${new Date().toISOString().split("T")[0]}.xlsx`);
      
      // Send the file
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
