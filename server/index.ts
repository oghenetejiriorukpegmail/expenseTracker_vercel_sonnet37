import 'dotenv/config'; // Load environment variables FIRST
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet"; // Import helmet
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage as storagePromise } from "./storage"; // Import the promise
import { setupAuth } from "./auth"; // Import setupAuth
import { initializeEnvFromConfig } from "./config"; // Import config initialization

const app = express();

// Add helmet middleware for security headers
// Loosen CSP in development to allow Vite HMR and React Refresh
if (process.env.NODE_ENV !== 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'"], // Allow inline scripts for Vite
        "connect-src": ["'self'", "ws:"], // Allow WebSocket connections for HMR
      },
    }
  }));
} else {
  app.use(helmet()); // Use default helmet settings in production
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
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
initializeEnvFromConfig();

(async () => {
  // Await the storage initialization
  const storage = await storagePromise;
  console.log("Storage initialized successfully.");

  // Setup auth with the initialized storage and session store
  // Ensure setupAuth is called BEFORE registerRoutes if routes depend on auth/session
  setupAuth(app, storage.sessionStore, storage); // Pass storage instance
  console.log("Auth setup complete.");

  // Register routes, passing the initialized storage
  const server = await registerRoutes(app, storage); // Pass storage instance
  console.log("Routes registered.");
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error("Server error:", err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "127.0.0.1",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
