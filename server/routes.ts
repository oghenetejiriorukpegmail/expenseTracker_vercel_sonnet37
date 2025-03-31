import express, { type Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertTripSchema, insertExpenseSchema } from "@shared/schema";
import { upload } from "./middleware/multer-config";
import { processReceiptWithOCR, testOCR } from "./util/ocr";
import { promises as fs } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { createWriteStream } from "fs";
import multer from "multer";

// Define request type with file from multer
interface MulterRequest extends Request {
  file?: multer.File;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

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

  app.post("/api/expenses", upload.single("receipt"), async (req: MulterRequest, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      // Parse and validate the expense data
      const expenseData = {
        type: req.body.type,
        date: req.body.date,
        vendor: req.body.vendor,
        location: req.body.location,
        cost: parseFloat(req.body.cost),
        comments: req.body.comments,
        tripName: req.body.tripName,
      };
      
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

  app.put("/api/expenses/:id", upload.single("receipt"), async (req: MulterRequest, res, next) => {
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
      
      // Parse and validate the expense data
      const expenseData = {
        type: req.body.type,
        date: req.body.date,
        vendor: req.body.vendor,
        location: req.body.location,
        cost: parseFloat(req.body.cost),
        comments: req.body.comments,
        tripName: req.body.tripName,
      };
      
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
  app.post("/api/ocr/process", upload.single("receipt"), async (req: MulterRequest, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      if (!req.file) {
        return res.status(400).send("No receipt file uploaded");
      }
      
      const filePath = path.join(process.cwd(), "uploads", req.file.filename);
      
      // Get the OCR method from the request or from the user's settings
      const method = req.body.method || "tesseract";
      
      console.log(`Processing receipt with ${method} OCR method`);
      const result = await processReceiptWithOCR(filePath, method);
      
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
      
      const vendor = getExtractedValue('vendor');
      
      const formattedData = {
        ...result,
        formData: result.success ? {
          date: getExtractedValue('date'),
          vendor: vendor,
          location: getExtractedValue('location'),
          cost: getCostValue(),
          type: guessExpenseType(result.text || '', vendor),
          // Include additional data like items, payment method, etc.
          items: getItemsArray(),
          paymentMethod: getExtractedValue('paymentMethod'),
        } : {
          // Provide empty default values if no data was extracted
          date: '',
          vendor: '',
          location: '',
          cost: '',
          type: 'other',
          items: [],
          paymentMethod: '',
        }
      };
      
      res.json(formattedData);
    } catch (error) {
      console.error("OCR processing error:", error);
      next(error);
    }
  });
  
// Helper function to guess expense type based on receipt content
function guessExpenseType(text: string, vendor: string): string {
  const lowerText = text.toLowerCase();
  const lowerVendor = vendor.toLowerCase();
  
  // Check for transportation-related keywords
  if (
    lowerText.includes('airline') || 
    lowerText.includes('flight') || 
    lowerText.includes('taxi') || 
    lowerText.includes('uber') || 
    lowerText.includes('lyft') ||
    lowerText.includes('train') ||
    lowerText.includes('transit') ||
    lowerVendor.includes('airlines') ||
    lowerVendor.includes('air') ||
    lowerVendor.includes('taxi') ||
    lowerVendor.includes('uber') ||
    lowerVendor.includes('lyft')
  ) {
    return 'Transportation';
  }
  
  // Check for accommodation-related keywords
  if (
    lowerText.includes('hotel') ||
    lowerText.includes('inn') ||
    lowerText.includes('motel') ||
    lowerText.includes('resort') ||
    lowerText.includes('airbnb') ||
    lowerText.includes('lodging') ||
    lowerText.includes('stay') ||
    lowerVendor.includes('hotel') ||
    lowerVendor.includes('inn') ||
    lowerVendor.includes('motel') ||
    lowerVendor.includes('resort')
  ) {
    return 'Accommodation';
  }
  
  // Check for food-related keywords
  if (
    lowerText.includes('restaurant') ||
    lowerText.includes('cafe') ||
    lowerText.includes('coffee') ||
    lowerText.includes('breakfast') ||
    lowerText.includes('lunch') ||
    lowerText.includes('dinner') ||
    lowerText.includes('food') ||
    lowerText.includes('meal') ||
    lowerVendor.includes('restaurant') ||
    lowerVendor.includes('cafe') ||
    lowerVendor.includes('coffee')
  ) {
    return 'Food';
  }
  
  // Default to "Other" if no matches
  return 'Other';
}

  app.post("/api/test-ocr", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const { method, apiKey } = req.body;
      
      const result = await testOCR(method, apiKey);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Update environment settings
  app.post("/api/update-env", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
      
      const { ocrMethod, apiKey } = req.body;
      
      // In a real app, we would update the environment variables or store in database
      // For this example, we'll just return success
      
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
      
      // Format expenses for Excel
      const excelData = expenses.map(expense => ({
        Type: expense.type,
        Date: expense.date,
        Vendor: expense.vendor,
        Location: expense.location,
        Amount: parseFloat(expense.cost.toString()),
        Trip: expense.tripName,
        Comments: expense.comments || "",
        "Has Receipt": expense.receiptPath ? "Yes" : "No"
      }));
      
      // Create worksheet from data
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
      
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
