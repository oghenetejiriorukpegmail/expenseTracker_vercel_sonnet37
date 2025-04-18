import 'dotenv/config'; // Load environment variables FIRST
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet"; // Import helmet
import cors from "cors"; // Import cors
import cookieParser from "cookie-parser"; // Import cookie-parser
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage as storagePromise } from "./storage"; // Import the promise
import { setupAuth } from "./auth"; // Import setupAuth
import { jsonResponseMiddleware } from "./middleware/json-response"; // Import JSON response middleware
import { authRedirectMiddleware } from "./middleware/auth-redirect"; // Import auth redirect middleware
import { dbConnectionMiddleware } from "./middleware/db-connection"; // Import DB connection middleware
import { initializeEnvFromConfig } from "./config"; // Import config initialization
import path from "path";
import fs from "fs";

// Check for required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`FATAL ERROR: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1); // Exit in production if required env vars are missing
  }
}

// Check if at least one OCR API key is available
const ocrApiKeys = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'];
const hasOcrApiKey = ocrApiKeys.some(key => !!process.env[key]);
if (!hasOcrApiKey) {
  console.warn('WARNING: No OCR API keys found. OCR functionality will be limited.');
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL ERROR: At least one OCR API key is required in production.');
    process.exit(1);
  }
}

// Initialize Express app
const app = express();

// Add helmet middleware for security headers
if (process.env.NODE_ENV === 'production') {
  console.log('Applying production security settings');
  app.use(helmet()); // Use default helmet settings in production
  
  // Additional security headers for production
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
} else {
  console.log('Applying development security settings');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'"], // Allow inline scripts for Vite
        "connect-src": ["'self'", "ws:"], // Allow WebSocket connections for HMR
      },
    }
  }));
}

// CORS middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true, // Allow cookies to be sent with requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Add cookie parser middleware
app.use(cookieParser());

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add auth redirect middleware to handle routing conflicts
app.use(authRedirectMiddleware);

// Add JSON response middleware to ensure auth endpoints return JSON
app.use(jsonResponseMiddleware);

// Add database connection middleware to prevent premature connection closing
app.use(dbConnectionMiddleware);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Limit the response size in logs
        const responseStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${responseStr.length > 100 ? responseStr.substring(0, 100) + '...' : responseStr}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize environment variables from config file
console.log('Initializing environment variables from config file');
initializeEnvFromConfig();

// Main application initialization
(async () => {
  try {
    console.log('Starting server initialization...');
    
    // Await the storage initialization
    console.log('Initializing storage...');
    const storage = await storagePromise;
    console.log("Storage initialized successfully.");

    // Setup auth with the initialized storage and session store
    console.log('Setting up authentication...');
    setupAuth(app, storage.sessionStore, storage); // Pass storage instance
    console.log("Auth setup complete.");

    // Register routes, passing the initialized storage
    console.log('Registering routes...');
    const server = await registerRoutes(app, storage); // Pass storage instance
    console.log("Routes registered.");
    
    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Don't expose stack traces in production
      const errorResponse = process.env.NODE_ENV === 'production'
        ? { message }
        : { message, stack: err.stack };

      res.status(status).json(errorResponse);
      console.error("Server error:", err);
    });

    // Setup static file serving or development server
    if (process.env.NODE_ENV === 'development') {
      console.log('Setting up development server with Vite...');
      await setupVite(app, server);
    } else {
      console.log('Setting up static file serving for production...');
      serveStatic(app);
    }

    // Catch-all route for SPA
    app.get('*', (req, res) => {
      // Exclude API routes from catch-all
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found' });
      }
      
      // Serve the index.html for client-side routing
      const indexPath = path.join(process.cwd(), 'client', 'dist', 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application not found');
      }
    });

    // Start the server
    const port = process.env.PORT || 5000;
    server.listen({
      port,
      host: "127.0.0.1",
    }, () => {
      console.log(`Server started successfully`);
      log(`Expense Tracker API serving on http://127.0.0.1:${port}`);
    });
  } catch (error) {
    console.error('FATAL ERROR during server initialization:', error);
    process.exit(1);
  }
})();

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});
