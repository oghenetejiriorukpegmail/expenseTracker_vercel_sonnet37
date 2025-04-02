import express, { type Express, Request } from "express";
import { format } from "date-fns"; // Import format function
import { createServer, type Server } from "http";
import { z } from "zod";
import { insertTripSchema, insertExpenseSchema, Expense, InsertExpense } from "@shared/schema"; // Import Expense and InsertExpense types
import { upload } from "./middleware/multer-config";
import { processReceiptWithOCR, testOCR } from "./util/ocr";
import { promises as fsPromises, createReadStream, existsSync } from "fs"; // Import fs promises and createReadStream, existsSync
import path from "path";
import ExcelJS from 'exceljs'; // Added exceljs
import archiver from 'archiver'; // Import archiver
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
          // await fsPromises.unlink(filePath).catch(e => console.error("Failed to delete file after error:", e));
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
          await fsPromises.unlink(oldReceiptPath).catch(() => {});
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
        await fsPromises.unlink(receiptPath).catch(() => {});
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

  // Export expenses to Excel and include receipts in a ZIP
  app.get("/api/export-expenses", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

      const tripName = req.query.tripName as string | undefined;
      const dateSuffix = format(new Date(), "yyyyMMdd");
      const safeTripName = tripName ? tripName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'all';
      const zipFilename = `expense-export-${safeTripName}-${dateSuffix}.zip`;
      const excelFilename = `expenses-${safeTripName}-${dateSuffix}.xlsx`;

      let expenses: Expense[];
      if (tripName) {
        expenses = await storage.getExpensesByTripName(req.user!.id, tripName);
      } else {
        expenses = await storage.getExpensesByUserId(req.user!.id);
      }

      // Initialize archiver
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });

      // Set headers for ZIP download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${zipFilename}`);

      // Pipe archive data to the response
      archive.pipe(res);

      // Handle warnings and errors
      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          console.warn("Archiver warning: ", err); // Log file not found warnings
        } else {
          // Throw error for other warnings
          throw err;
        }
      });
      archive.on('error', function(err) {
        console.error("Archiving error:", err);
        // Ensure response ends if headers not sent
        if (!res.headersSent) {
            res.status(500).send({ error: 'Failed to create zip file.' });
        }
        // No need to call next(err) here as the stream handles errors
      });


      // --- Generate Excel ---
      const templatePath = path.join(process.cwd(), 'assets', 'Expense_Template.xlsx');
      const workbook = new ExcelJS.Workbook();
      let excelBuffer: Buffer | undefined;

      try {
        await workbook.xlsx.readFile(templatePath);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
          throw new Error("Worksheet not found in the template.");
        }

        const userProfile = await storage.getUserById(req.user!.id);
        const firstName = userProfile?.firstName?.trim() || '';
        const lastName = userProfile?.lastName?.trim() || '';
        let fullName = `${firstName} ${lastName}`.trim();
        if (!fullName) {
          fullName = req.user!.username;
        }
        const applicationDate = new Date();

        // Populate template placeholders (simplified loop)
        worksheet.eachRow({ includeEmpty: true }, (row) => {
          row.eachCell({ includeEmpty: true }, (cell) => {
            if (cell.value && typeof cell.value === 'string') {
              let cellValue = cell.value;
              cellValue = cellValue.replace(/{{full name}}/g, fullName);
              cellValue = cellValue.replace(/{{Today's Date}}/g, format(applicationDate, 'M/d/yyyy'));
              cell.value = cellValue;
            } else if (cell.value === "{{Today's Date}}") { // Handle standalone date object placeholder
                 cell.value = applicationDate;
                 if (!cell.numFmt) cell.numFmt = 'mm/dd/yyyy';
            }
          });
        });

        // Populate specific cells
        worksheet.getCell('B9').value = fullName;
        worksheet.getCell('B10').value = applicationDate;
        if (!worksheet.getCell('B10').numFmt) worksheet.getCell('B10').numFmt = 'mm/dd/yyyy';
        worksheet.getCell('B57').value = fullName;
        worksheet.getCell('E58').value = applicationDate;
        if (!worksheet.getCell('E58').numFmt) worksheet.getCell('E58').numFmt = 'mm/dd/yyyy';


        // Populate Expense Data
        const expenseTableStartRow = 13;
        expenses.forEach((expense: Expense, index: number) => {
          const currentRowNumber = expenseTableStartRow + index;
          const currentRow = worksheet.getRow(currentRowNumber);
          currentRow.getCell('A').value = new Date(expense.date);
          if (!currentRow.getCell('A').numFmt) currentRow.getCell('A').numFmt = 'mm/dd/yyyy';
          currentRow.getCell('B').value = typeof expense.cost === 'number' ? expense.cost : parseFloat(expense.cost);
          if (!currentRow.getCell('B').numFmt) currentRow.getCell('B').numFmt = '$#,##0.00';
          currentRow.getCell('C').value = "CAD";
          if (!currentRow.getCell('C').alignment) currentRow.getCell('C').alignment = { horizontal: 'center' };
          currentRow.getCell('D').value = expense.comments || expense.type || "";
        });

        // Write Excel to buffer
        excelBuffer = await workbook.xlsx.writeBuffer(); // Removed 'as Buffer' cast

      } catch (templateError) {
         console.error("Error processing Excel template:", templateError);
         // If template fails, we might still want to zip receipts, or send an error
         // For now, let's send an error and not proceed with zip
         return next(new Error("Failed to generate Excel report from template."));
      }

      // --- Add Excel to ZIP ---
      if (excelBuffer) {
        archive.append(excelBuffer, { name: excelFilename });
        console.log(`Appended ${excelFilename} to archive.`);
      } else {
         console.error("Excel buffer is undefined, cannot add to archive.");
         // Handle error - perhaps finalize archive without Excel? Or send error response.
         // For now, let's finalize without it if buffer creation failed silently, though the catch block above should prevent this.
      }


      // --- Add Receipts to ZIP ---
      const uploadsDir = path.join(process.cwd(), "uploads");
      for (const expense of expenses) {
        if (expense.receiptPath) {
          const receiptFilePath = path.join(uploadsDir, expense.receiptPath);
          try {
            // Check if file exists before attempting to add
            await fsPromises.stat(receiptFilePath);
            // Add file to a 'receipts' directory within the zip
            archive.file(receiptFilePath, { name: `receipts/${expense.receiptPath}` });
            console.log(`Adding receipt: ${expense.receiptPath}`);
          } catch (fileError: any) {
            // Log if a receipt file is missing but continue archiving others
            if (fileError.code === 'ENOENT') {
              console.warn(`Receipt file not found, skipping: ${receiptFilePath}`);
            } else {
              console.error(`Error accessing receipt file ${receiptFilePath}:`, fileError);
              // Decide if you want to stop the whole process or just skip this file
            }
          }
        }
      }

      // Finalize the archive (signals the end of the stream)
      await archive.finalize();
      console.log("Archive finalized.");

    } catch (error) {
      console.error("Error during export:", error);
      // Ensure response ends if headers not sent
      if (!res.headersSent) {
          res.status(500).send({ error: 'Failed to generate export file.' });
      }
      // Pass error to default error handler if needed, but stream errors are handled above
      // next(error);
    }
  });


  const httpServer = createServer(app);

  return httpServer;
}
