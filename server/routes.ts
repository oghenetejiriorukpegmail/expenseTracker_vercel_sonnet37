import express, { type Express, Request } from "express";
import { format } from "date-fns"; // Import format function
import { createServer, type Server } from "http";
// Remove direct storage import: import { storage } from "./storage";
// Remove setupAuth import as it's handled in index.ts: import { setupAuth } from "./auth";
import { z } from "zod";
import { insertTripSchema, insertExpenseSchema, Expense, InsertExpense } from "@shared/schema"; // Import Expense and InsertExpense types
import { upload } from "./middleware/multer-config";
import { processReceiptWithOCR, testOCR } from "./util/ocr";
import { promises as fs } from "fs";
import path from "path";
// import * as XLSX from "xlsx"; // Removed xlsx
import ExcelJS from 'exceljs'; // Added exceljs
import { createWriteStream } from "fs";
import multer from "multer";
import type { IStorage } from "./storage"; // Import the storage interface type
import { updateOcrApiKey, setDefaultOcrMethod, loadConfig, saveConfig } from "./config"; // Import config functions
import { hashPassword, comparePasswords } from "./auth"; // Import password helpers

// Define request type with file from multer
interface MulterRequest extends Request {
  file?: any;
  files?: any[]; // Add files array for upload.array()
}

// Update function signature to accept storage instance
export async function registerRoutes(app: Express, storage: IStorage): Promise<Server> {
  // Authentication is now setup in index.ts before calling this
  // setupAuth(app);

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // --- Profile Routes ---

  // GET current user's profile
  app.get("/api/profile", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      // Fetch user data, excluding password
      const userProfile = await storage.getUserById(req.user!.id);
      if (!userProfile) {
        return res.status(404).send("User not found");
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...profileData } = userProfile; // Omit password
      res.json(profileData);
    } catch (error) {
      next(error);
    }
  });

  // PUT update user's profile
  const profileUpdateSchema = z.object({
    firstName: z.string().min(1, "First name cannot be empty").default(''),
    lastName: z.string().optional().default(''), // Add optional lastName
    phoneNumber: z.string().optional().default(''), // Add optional phoneNumber
    email: z.string().email("Invalid email address"),
    bio: z.string().optional(),
  });

  app.put("/api/profile", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const validatedData = profileUpdateSchema.parse(req.body);
      
      // Check if email is already taken by another user
      const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
      if (existingUserByEmail && existingUserByEmail.id !== req.user!.id) {
         return res.status(409).json({ message: "Email already in use by another account." });
      }

      const updatedUser = await storage.updateUserProfile(req.user!.id, validatedData);

      if (!updatedUser) {
        return res.status(404).send("User not found");
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...profileData } = updatedUser; // Omit password
      res.json(profileData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      // Handle potential unique constraint errors from the DB if email update conflicts
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
         return res.status(409).json({ message: "Email already in use." });
      }
      next(error);
    }
  });

  // POST change user's password
  const passwordChangeSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
  });

  app.post("/api/profile/change-password", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

      const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);

      // 1. Verify current password
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).send("User not found"); // Should not happen if authenticated
      }
      const isMatch = await comparePasswords(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Incorrect current password." });
      }

      // 2. Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // 3. Update password in storage
      await storage.updateUserPassword(req.user!.id, newPasswordHash);

      res.status(200).json({ message: "Password updated successfully." });

    } catch (error) {
       if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      next(error);
    }
  });

  // --- End Profile Routes ---

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

  // POST Batch process receipts for a specific trip
  app.post("/api/trips/:tripId/batch-process-receipts", (upload as any).array('receipts', 20), async (req: MulterRequest, res, next) => { // Cast upload to any
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

      const tripId = parseInt(req.params.tripId);
      if (isNaN(tripId)) {
        return res.status(400).send("Invalid trip ID");
      }

      // Verify trip exists and belongs to user
      const trip = await storage.getTrip(tripId);
      if (!trip || trip.userId !== req.user!.id) {
        return res.status(404).send("Trip not found or not authorized");
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).send("No receipt files uploaded");
      }

      const files = req.files;
      const results = [];
      const config = loadConfig(); // Load config for OCR settings

      console.log(`Starting batch processing for trip ${tripId} (${trip.name}) with ${files.length} files.`);

      for (const file of files) {
        const filePath = path.join(process.cwd(), "uploads", file.filename);
        let status = 'failed';
        let errorMsg = 'Unknown processing error';
        let createdExpense = null;

        try {
          console.log(`Processing file: ${file.originalname} (${file.filename})`);
          const ocrResult = await processReceiptWithOCR(filePath, config.defaultOcrMethod || 'gemini', config.ocrTemplate || 'travel');

          if (ocrResult.success && ocrResult.extractedData) {
            const data = ocrResult.extractedData;
            // Attempt to create expense - adapt data mapping as needed
             const expenseData: InsertExpense = {
                // Map extracted fields to InsertExpense schema
                date: data.date || format(new Date(), 'yyyy-MM-dd'), // Use extracted or default
                cost: typeof data.cost === 'number' ? data.cost : (parseFloat(data.cost) || 0), // Ensure number
                type: data.type || 'Other', // Use extracted or default
                vendor: data.vendor || 'Unknown Vendor', // Use extracted or default
                location: data.location || 'Unknown Location', // Use extracted or default
                comments: data.description || ocrResult.text?.substring(0, 200) || '', // Use description, fallback to raw text snippet
                tripName: trip.name, // Link to the current trip
             };
             
             // Validate required fields before creating
             if (!expenseData.date || !expenseData.cost || !expenseData.type || !expenseData.vendor || !expenseData.location || !expenseData.tripName) {
                 throw new Error(`Missing required fields extracted from ${file.originalname}`);
             }

             createdExpense = await storage.createExpense({
                ...expenseData,
                userId: req.user!.id,
                receiptPath: file.filename, // Link the uploaded file
             });
             status = 'success';
             errorMsg = '';
             console.log(`Successfully created expense for ${file.originalname}`);
          } else {
            errorMsg = ocrResult.error || "OCR failed to extract data";
            console.warn(`OCR failed for ${file.originalname}: ${errorMsg}`);
          }
        } catch (processingError) {
          errorMsg = processingError instanceof Error ? processingError.message : String(processingError);
          console.error(`Error processing file ${file.originalname}:`, processingError);
          // Optionally delete the uploaded file if processing failed severely
          // await fs.unlink(filePath).catch(e => console.error("Failed to delete file after error:", e));
        }
        results.push({ filename: file.originalname, status, error: errorMsg, expenseId: createdExpense?.id });
      }

      console.log(`Batch processing finished for trip ${tripId}.`);
      res.status(200).json({ message: "Batch processing complete.", results });

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
      
      // --- Refactored using exceljs and template ---
      const templatePath = path.join(process.cwd(), 'assets', 'Expense_Template.xlsx');
      const workbook = new ExcelJS.Workbook();
      
      try {
        await workbook.xlsx.readFile(templatePath);
        const worksheet = workbook.getWorksheet(1); // Assume data goes into the first sheet

        if (!worksheet) {
          throw new Error("Worksheet not found in the template.");
        }

        // --- Fetch user profile to get first name ---
        const userProfile = await storage.getUserById(req.user!.id);
        // Construct full name, handle missing names, fallback to username
        const firstName = userProfile?.firstName?.trim() || '';
        const lastName = userProfile?.lastName?.trim() || '';
        let fullName = `${firstName} ${lastName}`.trim();
        if (!fullName) {
          fullName = req.user!.username; // Fallback to username if no first/last name
        }
        const employeeName = fullName; // Keep variable name for simplicity in replacement below
        const applicationDate = new Date(); // Use Date object

        // --- Search for and replace placeholders in all cells ---
        console.log("Searching for placeholders in the template...");
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            if (cell.value && typeof cell.value === 'string') {
              let cellValue = cell.value as string;
              
              // Replace {{full name}} with employee name
              // Replace {{full name}} with the constructed full name
              if (cellValue.includes('{{full name}}')) {
                console.log(`Found {{full name}} placeholder in cell ${worksheet.getCell(rowNumber, colNumber).address}`);
                cell.value = cellValue.replace(/{{full name}}/g, fullName); // Use fullName
              }
              
              // Handle special case for "Date:___________{{Today's Date}}__________"
              if (cellValue.includes("Date:") && cellValue.includes("{{Today's Date}}")) {
                console.log(`Found Date:___{{Today's Date}} pattern in cell ${worksheet.getCell(rowNumber, colNumber).address}`);
                // Format the date as a string in MM/DD/YYYY format
                const formattedDate = format(applicationDate, 'M/d/yyyy');
                // Replace only the placeholder part while keeping the "Date:" prefix
                cell.value = cellValue.replace(/{{Today's Date}}/g, formattedDate);
              }
              // Handle regular {{Today's Date}} placeholder (not part of the Date: pattern)
              else if (cellValue.includes("{{Today's Date}}")) {
                console.log(`Found {{Today's Date}} placeholder in cell ${worksheet.getCell(rowNumber, colNumber).address}`);
                // For standalone date placeholders, replace with a date object
                if (cellValue === "{{Today's Date}}") {
                  cell.value = applicationDate;
                  // Apply date format if not already set
                  if (!cell.numFmt) {
                    cell.numFmt = 'mm/dd/yyyy';
                  }
                } else {
                  // For mixed content, replace with formatted string
                  const formattedDate = format(applicationDate, 'M/d/yyyy');
                  cell.value = cellValue.replace(/{{Today's Date}}/g, formattedDate);
                }
              }
            }
          });
        });

        // --- Also populate specific cells as before (for backward compatibility) ---
        // Populate Header Info (Assuming cells B9 and B10 from template image)
        console.log(`Populating B9 with Employee Name: ${fullName}`); // Use fullName
        worksheet.getCell('B9').value = fullName; // Use fullName
        
        console.log(`Populating B10 with Application Date: ${applicationDate}`);
        worksheet.getCell('B10').value = applicationDate;
        // Apply MM/DD/YYYY format if not set by template
        if (!worksheet.getCell('B10').numFmt) {
           console.log("Applying date format 'mm/dd/yyyy' to B10");
           worksheet.getCell('B10').numFmt = 'mm/dd/yyyy';
        }

        // Populate Signature Fields (Assuming B57 and E58)
        console.log(`Populating B57 (Applicant Signature) with: ${fullName}`); // Use fullName
        worksheet.getCell('B57').value = fullName; // Use fullName
        
        console.log(`Populating E58 (Date) with: ${applicationDate}`);
        worksheet.getCell('E58').value = applicationDate; // Date next to Manager Signature
        // Apply MM/DD/YYYY format if not set by template
        if (!worksheet.getCell('E58').numFmt) {
           console.log("Applying date format 'mm/dd/yyyy' to E58");
           worksheet.getCell('E58').numFmt = 'mm/dd/yyyy';
        }

        // --- Populate Expense Data (Assuming starting row 13, columns A, B, C, D) ---
        const expenseTableStartRow = 13; 
        expenses.forEach((expense: Expense, index: number) => {
          const currentRowNumber = expenseTableStartRow + index;
          const currentRow = worksheet.getRow(currentRowNumber); // Get the row object

          // Populate cells - use cell objects for better control
          const dateCell = currentRow.getCell('A'); // Column A for Date
          dateCell.value = new Date(expense.date);
          // Apply format if not already set by template
          if (!dateCell.numFmt) dateCell.numFmt = 'mm/dd/yyyy'; 

          const costCell = currentRow.getCell('B'); // Column B for Cost
          costCell.value = typeof expense.cost === 'number' ? expense.cost : parseFloat(expense.cost);
          // Apply format if not already set by template
          if (!costCell.numFmt) costCell.numFmt = '$#,##0.00'; 

          const currencyCell = currentRow.getCell('C'); // Column C for Currency
          currencyCell.value = "CAD"; // Hardcoded currency
          // Apply alignment if not already set by template
          if (!currencyCell.alignment) currencyCell.alignment = { horizontal: 'center' }; 

          const descriptionCell = currentRow.getCell('D'); // Column D for Description
          descriptionCell.value = expense.comments || expense.type || ""; // Use comments, fallback to type
          
          // Optional: Ensure row height is sufficient if template doesn't define it
          // currentRow.height = 15; // Example height
        });
        
        // If there are more rows in the template than needed, clear them (optional)
        // const lastDataRow = expenseTableStartRow + expenses.length - 1;
        // // Example: Clear rows from lastDataRow + 1 down to row 50 if template has extra rows
        // for (let r = lastDataRow + 1; r <= 50; r++) { 
        //    const row = worksheet.getRow(r);
        //    if (!row.hasValues) break; // Stop if we hit empty rows
        //    row.values = []; // Clear values
        // }


        // --- Write to Buffer ---
        const buffer = await workbook.xlsx.writeBuffer();

        // --- Send Response ---
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=expenses-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`); // Changed filename slightly
        res.send(buffer);

      } catch (templateError) {
         console.error("Error processing Excel template:", templateError);
         // Fallback or error response if template loading/processing fails
         res.status(500).json({ message: "Failed to generate report from template.", error: templateError instanceof Error ? templateError.message : String(templateError) });
      }
    } catch (error) {
      next(error); // Catch errors from fetching expenses or authentication
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
