import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken"; // Import JWT for token generation
// Remove direct storage import: import { storage } from "./storage";
import type { IStorage } from "./storage"; // Import storage interface type
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) { // Add export
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) { // Add export
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Update function signature to accept sessionStore and storage instance
export function setupAuth(app: Express, sessionStore: session.Store, storage: IStorage) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "expense-tracker-secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // Use passed-in sessionStore
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id); // Use renamed function
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log('POST /api/register - Processing registration request:', req.body.username);
      
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log(`Registration failed: Username ${req.body.username} already exists`);
        return res.status(400).json({ message: "Username already exists" });
      }
  
      // Check if email already exists (if provided)
      if (req.body.email) {
        const existingEmail = await storage.getUserByEmail(req.body.email);
        if (existingEmail) {
          console.log(`Registration failed: Email ${req.body.email} already exists`);
          return res.status(409).json({ message: "Email already exists" });
        }
      }
  
      // Create user with validated data
      const userData = {
        username: req.body.username,
        password: await hashPassword(req.body.password),
        firstName: req.body.firstName || '',
        lastName: req.body.lastName || '',
        email: req.body.email || '',
        phoneNumber: req.body.phoneNumber || '',
      };
  
      console.log(`Creating new user: ${req.body.username}`);
      
      try {
        const user = await storage.createUser(userData);
        console.log(`User created successfully: ${user.username} (ID: ${user.id})`);
  
        // Generate JWT token for API routes
        const token = jwt.sign(
          { id: user.id, username: user.username },
          process.env.JWT_SECRET || 'expense-tracker-jwt-secret',
          { expiresIn: '7d' }
        );
  
        // Login the user with Passport.js
        req.login(user, (err) => {
          if (err) return next(err);
          
          // Set JWT token cookie for API routes
          res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'strict',
            path: '/'
          });
          
          // Return user data (excluding password)
          const { password: _, ...userData } = user;
          res.status(201).json({
            user: userData,
            token
          });
        });
      } catch (dbError: unknown) {
        console.error('Database error during user creation:', dbError);
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        return res.status(500).json({ message: 'Failed to create user account', error: errorMessage });
      }
    } catch (error) {
      console.error('Registration error:', error);
      next(error);
    }
  });
  
  app.post("/api/login", (req, res, next) => {
    console.log('POST /api/login - Processing login request:', req.body.username);
    
    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }
      
      if (!user) {
        console.log(`Login failed: Invalid credentials for ${req.body.username}`);
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      console.log(`Login successful for user ${user.username} (ID: ${user.id})`);
      
      // Generate JWT token for API routes
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET || 'expense-tracker-jwt-secret',
        { expiresIn: '7d' }
      );
      
      // Login the user with Passport.js
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Set JWT token cookie for API routes
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          sameSite: 'strict',
          path: '/'
        });
        
        // Return user data (excluding password)
        const { password: _, ...userData } = user;
        res.status(200).json({
          user: userData,
          token
        });
      });
    })(req, res, next);
  });
  
  app.post("/api/logout", (req, res, next) => {
    console.log('POST /api/logout - Processing logout request');
    
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return next(err);
      }
      
      // Clear the token cookie
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      
      console.log('Logout successful');
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });
  
  app.get("/api/user", (req, res) => {
    console.log('GET /api/user - Checking authentication status');
    
    if (!req.isAuthenticated()) {
      console.log('GET /api/user - Not authenticated');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    console.log(`GET /api/user - Authenticated as ${req.user.username} (ID: ${req.user.id})`);
    
    // Return user data (excluding password)
    const { password: _, ...userData } = req.user;
    res.status(200).json(userData);
  });
}
