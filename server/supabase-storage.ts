import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '@shared/schema';
import type { User, InsertUser, Trip, InsertTrip, Expense, InsertExpense, MileageLog, InsertMileageLog } from "@shared/schema"; // Added MileageLog types
import { eq, and, desc, gte, lte, asc } from 'drizzle-orm'; // Added gte, lte, asc
import session from "express-session";
import connectPgSimple from 'connect-pg-simple'; // Import connect-pg-simple

import { IStorage } from './storage'; // Import the interface

// Get Supabase connection string from environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1); // Exit if the database URL is not configured
}

export class SupabaseStorage implements IStorage {
  private db: PostgresJsDatabase<typeof schema>; // Drizzle instance for Postgres
  private client: postgres.Sql; // Raw postgres client instance
  public sessionStore!: session.Store; // Use definite assignment assertion

  // Private constructor to enforce initialization via async method
  private constructor() {
    // Initialize the postgres client
    // Use non-null assertion (!) as the check above ensures databaseUrl is defined here
    this.client = postgres(databaseUrl!, { max: 1 }); // Use database URL from env, max 1 connection for migrations/setup
    // Initialize Drizzle with the postgres client
    this.db = drizzle(this.client, { schema, logger: false });
  }

  // Public async initialization method
  public static async initialize(): Promise<SupabaseStorage> {
    const instance = new SupabaseStorage();

    // --- BEGIN CONNECTIVITY TEST ---
    console.log("Testing database connection...");
    try {
      // Use the raw client for a simple query
      await instance.client`SELECT 1`; // Corrected syntax
      console.log("Successfully connected to Supabase database.");
    } catch (error) {
      console.error("FATAL ERROR: Failed to connect to Supabase database during startup.");
      console.error("Error details:", error);
      
      // In development mode, create a mock storage instance instead of exiting
      if (process.env.NODE_ENV !== 'production') {
        console.warn("Running in development mode with mock storage. Database features will be limited.");
        return createMockStorage();
      }
      
      process.exit(1); // Exit the process on connection failure in production
    }
    // --- END CONNECTIVITY TEST ---

    // Initialize PostgreSQL session store
    const PgStore = connectPgSimple(session);
    instance.sessionStore = new PgStore({
        conString: databaseUrl, // Use the database connection string from env
        createTableIfMissing: false, // Explicitly disable table/schema creation
    });
    console.log("PostgreSQL session store initialized.");

    // Close the initial migration client connection if it's no longer needed
    // Drizzle might keep its own connection pool based on the client passed
    // await instance.client.end(); // Consider if needed or if Drizzle manages the connection lifecycle

    return instance;
  }

  // --- User methods ---
  async getUserById(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // PostgreSQL is case-sensitive by default, use ilike for case-insensitive search if needed
    // const result = await this.db.select().from(schema.users).where(ilike(schema.users.username, username)).limit(1);
    const result = await this.db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0];
  }

  async createUser(userData: InsertUser): Promise<User> {
    const result = await this.db.insert(schema.users).values(userData).returning();
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Use eq for case-sensitive comparison (default in PG)
    const result = await this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return result[0];
  }

  async updateUserProfile(userId: number, profileData: { firstName: string; lastName?: string | null; phoneNumber?: string | null; email: string; bio?: string | null }): Promise<User | undefined> {
    const updateData: Partial<typeof schema.users.$inferInsert> = {};
    if (profileData.firstName !== undefined) updateData.firstName = profileData.firstName;
    // Use empty string '' as fallback, matching the schema's NOT NULL default('') constraint
    if (profileData.lastName !== undefined) updateData.lastName = profileData.lastName ?? '';
    if (profileData.phoneNumber !== undefined) updateData.phoneNumber = profileData.phoneNumber ?? '';
    if (profileData.email !== undefined) updateData.email = profileData.email;
    if (profileData.bio !== undefined) updateData.bio = profileData.bio ?? null; // bio allows null

    // Removed updatedAt as it's not in the users schema

    const result = await this.db.update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length === 0) {
      return undefined; // User not found
    }
    return result[0];
  }

  async updateUserPassword(userId: number, newPasswordHash: string): Promise<void> {
    const result = await this.db.update(schema.users)
      // Removed updatedAt as it's not in the users schema
      .set({ password: newPasswordHash })
      .where(eq(schema.users.id, userId))
      .returning({ id: schema.users.id });

    if (result.length === 0) {
      throw new Error(`User with ID ${userId} not found for password update.`);
    }
  }

  // --- Trip methods ---
  async getTrip(id: number): Promise<Trip | undefined> {
    const result = await this.db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
    return result[0];
  }

  async getTripsByUserId(userId: number): Promise<Trip[]> {
    return this.db.select().from(schema.trips).where(eq(schema.trips.userId, userId)).orderBy(desc(schema.trips.createdAt));
  }

  async createTrip(tripData: InsertTrip & { userId: number }): Promise<Trip> {
     if (!tripData.name) {
        throw new Error("Trip name is required");
     }
     const dataToInsert = {
        description: '', // Provide default if schema requires it and it's missing
        ...tripData,
        // Ensure createdAt and updatedAt are set if not handled by DB defaults
        createdAt: new Date(),
        updatedAt: new Date(),
     };
    const result = await this.db.insert(schema.trips).values(dataToInsert).returning();
    return result[0];
  }

  async updateTrip(id: number, tripData: Partial<InsertTrip>): Promise<Trip> {
     const dataToUpdate = {
         ...tripData,
         updatedAt: new Date() // Update the timestamp
     };
     const result = await this.db.update(schema.trips)
       .set(dataToUpdate)
       .where(eq(schema.trips.id, id))
       .returning();
     if (result.length === 0) {
        throw new Error(`Trip with ID ${id} not found`);
     }
     return result[0];
  }

  async deleteTrip(id: number): Promise<void> {
    // Use transaction for atomicity
    await this.db.transaction(async (tx) => {
        const trip = await tx.select({ name: schema.trips.name, userId: schema.trips.userId })
                             .from(schema.trips)
                             .where(eq(schema.trips.id, id))
                             .limit(1);

        if (!trip[0]) {
            throw new Error(`Trip with ID ${id} not found`);
        }
        // Delete associated expenses first
        // Note: Ensure tripName comparison is correct (case sensitivity)
        await tx.delete(schema.expenses).where(and(eq(schema.expenses.userId, trip[0].userId), eq(schema.expenses.tripName, trip[0].name)));
        // Now delete the trip
        await tx.delete(schema.trips).where(eq(schema.trips.id, id));
    });
  }

  // --- Expense methods ---
  async getExpense(id: number): Promise<Expense | undefined> {
     const result = await this.db.select().from(schema.expenses).where(eq(schema.expenses.id, id)).limit(1);
     return result[0]; // Drizzle maps numeric types correctly for PG
  }

  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    const results = await this.db.select().from(schema.expenses)
                                .where(eq(schema.expenses.userId, userId))
                                .orderBy(desc(schema.expenses.date)); // Order by date descending
    return results;
  }

  async getExpensesByTripName(userId: number, tripName: string): Promise<Expense[]> {
    // Note: Ensure tripName comparison is correct (case sensitivity)
    const results = await this.db.select().from(schema.expenses)
      .where(and(eq(schema.expenses.userId, userId), eq(schema.expenses.tripName, tripName)))
      .orderBy(desc(schema.expenses.date));
     return results;
  }

  async createExpense(expenseData: InsertExpense & { userId: number, receiptPath?: string | null }): Promise<Expense> {
     const requiredFields: (keyof InsertExpense)[] = ['date', 'type', 'vendor', 'location', 'cost', 'tripName'];
     for (const field of requiredFields) {
        if (expenseData[field] === undefined || expenseData[field] === null) {
            if (field === 'cost' && typeof expenseData.cost !== 'number') {
                 throw new Error(`Missing or invalid required expense field: ${field}`);
            } else if (field !== 'cost') {
                 throw new Error(`Missing required expense field: ${field}`);
            }
        }
     }

     const dataToInsert = {
        ...expenseData,
        cost: expenseData.cost, // Should be number
        receiptPath: expenseData.receiptPath || null,
        comments: expenseData.comments ?? null, // Use null for PG
        // Ensure createdAt and updatedAt are set if not handled by DB defaults
        createdAt: new Date(),
        updatedAt: new Date(),
     };
     const result = await this.db.insert(schema.expenses).values(dataToInsert).returning();
     return result[0];
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense & { receiptPath?: string | null }>): Promise<Expense> {
    const dataToUpdate: Partial<typeof schema.expenses.$inferInsert> = {};

    for (const key in expenseData) {
        if (Object.prototype.hasOwnProperty.call(expenseData, key)) {
            const typedKey = key as keyof typeof expenseData;
            // Handle potential null values appropriately for PG
            if (expenseData[typedKey] === undefined) {
                 (dataToUpdate as any)[typedKey] = null;
            } else {
                 (dataToUpdate as any)[typedKey] = expenseData[typedKey];
            }
        }
    }
     // Add updatedAt timestamp
     dataToUpdate.updatedAt = new Date();


    const result = await this.db.update(schema.expenses)
      .set(dataToUpdate)
      .where(eq(schema.expenses.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`Expense with ID ${id} not found`);
    }
    return result[0];
  }

  async deleteExpense(id: number): Promise<void> {
    const result = await this.db.delete(schema.expenses).where(eq(schema.expenses.id, id)).returning({ id: schema.expenses.id });
     if (result.length === 0) {
        console.warn(`Attempted to delete non-existent expense with ID ${id}`);
        // Decide if this should throw an error or just warn
     }
  }

  // --- Mileage Log methods ---
  async getMileageLogById(id: number): Promise<MileageLog | undefined> {
    const result = await this.db.select().from(schema.mileageLogs).where(eq(schema.mileageLogs.id, id)).limit(1);
    return result[0];
  }

  async getMileageLogsByUserId(userId: number, options?: { tripId?: number; startDate?: string; endDate?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<MileageLog[]> {
    try {
      // Create a simple query to get all mileage logs for the user
      const result = await this.db
        .select()
        .from(schema.mileageLogs)
        .where(eq(schema.mileageLogs.userId, userId));
      
      // Filter the results in memory
      let filteredResults = [...result];
      
      // Apply filters
      if (options?.tripId !== undefined) {
        filteredResults = filteredResults.filter(log => log.tripId === options.tripId);
      }
      
      if (options?.startDate) {
        const startDate = new Date(options.startDate);
        filteredResults = filteredResults.filter(log => new Date(log.tripDate) >= startDate);
      }
      
      if (options?.endDate) {
        const endDate = new Date(options.endDate);
        filteredResults = filteredResults.filter(log => new Date(log.tripDate) <= endDate);
      }
      
      // Sort the results
      const sortBy = options?.sortBy || 'tripDate';
      const sortDirection = options?.sortOrder || 'desc';
      
      filteredResults.sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === 'tripDate') {
          comparison = new Date(a.tripDate).getTime() - new Date(b.tripDate).getTime();
        } else if (sortBy === 'startOdometer') {
          comparison = parseFloat(a.startOdometer) - parseFloat(b.startOdometer);
        } else if (sortBy === 'endOdometer') {
          comparison = parseFloat(a.endOdometer) - parseFloat(b.endOdometer);
        } else if (sortBy === 'calculatedDistance') {
          comparison = parseFloat(a.calculatedDistance) - parseFloat(b.calculatedDistance);
        } else if (sortBy === 'createdAt' && a.createdAt && b.createdAt) {
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
      
      // Apply pagination
      if (options?.limit !== undefined || options?.offset !== undefined) {
        const offset = options?.offset || 0;
        const limit = options?.limit || filteredResults.length;
        filteredResults = filteredResults.slice(offset, offset + limit);
      }
      
      return filteredResults;
    } catch (error) {
      console.error('Error in getMileageLogsByUserId:', error);
      return []; // Return empty array on error
    }
  }

  async createMileageLog(logData: InsertMileageLog & { userId: number; calculatedDistance: number; startImageUrl?: string | null; endImageUrl?: string | null }): Promise<MileageLog> {
    // Ensure required fields are present (handled by Zod schema mostly, but good practice)
    if (logData.startOdometer === undefined || logData.endOdometer === undefined || logData.tripDate === undefined || logData.entryMethod === undefined) {
        throw new Error("Missing required fields for mileage log creation.");
    }

    const dataToInsert = {
        ...logData,
        // Ensure numeric values are passed correctly
        startOdometer: String(logData.startOdometer), // Drizzle expects string for numeric PG type
        endOdometer: String(logData.endOdometer),
        calculatedDistance: String(logData.calculatedDistance),
        tripId: logData.tripId ?? null, // Use null if tripId is not provided
        purpose: logData.purpose ?? null,
        startImageUrl: logData.startImageUrl ?? null,
        endImageUrl: logData.endImageUrl ?? null,
        createdAt: new Date(), // Set creation timestamp
        updatedAt: new Date(), // Set initial update timestamp
    };

    const result = await this.db.insert(schema.mileageLogs).values(dataToInsert).returning();
    return result[0];
  }

  async updateMileageLog(id: number, logData: Partial<InsertMileageLog & { calculatedDistance?: number; startImageUrl?: string | null; endImageUrl?: string | null }>): Promise<MileageLog> {
    const dataToUpdate: Partial<typeof schema.mileageLogs.$inferInsert> = {};

    // Map provided fields, converting numbers to strings for numeric columns
    if (logData.tripId !== undefined) dataToUpdate.tripId = logData.tripId ?? null;
    if (logData.tripDate !== undefined) dataToUpdate.tripDate = logData.tripDate;
    if (logData.startOdometer !== undefined) dataToUpdate.startOdometer = String(logData.startOdometer);
    if (logData.endOdometer !== undefined) dataToUpdate.endOdometer = String(logData.endOdometer);
    if (logData.calculatedDistance !== undefined) dataToUpdate.calculatedDistance = String(logData.calculatedDistance);
    if (logData.purpose !== undefined) dataToUpdate.purpose = logData.purpose ?? null;
    if (logData.startImageUrl !== undefined) dataToUpdate.startImageUrl = logData.startImageUrl ?? null;
    if (logData.endImageUrl !== undefined) dataToUpdate.endImageUrl = logData.endImageUrl ?? null;
    if (logData.entryMethod !== undefined) dataToUpdate.entryMethod = logData.entryMethod;

    dataToUpdate.updatedAt = new Date(); // Always update the timestamp

    const result = await this.db.update(schema.mileageLogs)
      .set(dataToUpdate)
      .where(eq(schema.mileageLogs.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`Mileage log with ID ${id} not found`);
    }
    return result[0];
  }

  async deleteMileageLog(id: number): Promise<void> {
    // Note: Associated images should be deleted from storage (e.g., Supabase Storage Bucket)
    // This logic would typically be in the route handler *before* calling this method.
    const result = await this.db.delete(schema.mileageLogs).where(eq(schema.mileageLogs.id, id)).returning({ id: schema.mileageLogs.id });
    if (result.length === 0) {
      console.warn(`Attempted to delete non-existent mileage log with ID ${id}`);
    }
  }
}

// Create a mock storage instance for development when database is not available
function createMockStorage(): IStorage {
  // Create a mock session store
  const mockSessionStore = new (connectPgSimple(session))({
    conString: 'postgres://mock:mock@localhost:5432/mock',
    createTableIfMissing: false,
  });
  
  // Create a mock storage object
  const mockStorage: IStorage = {
    // Session store
    sessionStore: mockSessionStore,
    
    // User methods
    getUserById: async () => {
      console.log("Using mock getUserById");
      return {
        id: 1,
        username: 'demo',
        password: 'hashed_password',
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        phoneNumber: '',
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    getUserByUsername: async () => {
      console.log("Using mock getUserByUsername");
      return {
        id: 1,
        username: 'demo',
        password: 'hashed_password',
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        phoneNumber: '',
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    getUserByEmail: async () => {
      console.log("Using mock getUserByEmail");
      return {
        id: 1,
        username: 'demo',
        password: 'hashed_password',
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        phoneNumber: '',
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    createUser: async (userData) => {
      console.log("Using mock createUser", userData);
      return {
        id: 1,
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as User;
    },
    updateUserProfile: async (userId, profileData) => {
      console.log("Using mock updateUserProfile", userId, profileData);
      return {
        id: userId,
        username: 'demo',
        password: 'hashed_password',
        email: profileData.email,
        firstName: profileData.firstName,
        lastName: profileData.lastName || '',
        phoneNumber: profileData.phoneNumber || '',
        bio: profileData.bio || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    updateUserPassword: async (userId, newPasswordHash) => {
      console.log("Using mock updateUserPassword", userId, newPasswordHash);
    },
    
    // Trip methods
    getTrip: async (id) => {
      console.log("Using mock getTrip", id);
      return {
        id,
        userId: 1,
        name: 'Mock Trip',
        description: 'This is a mock trip',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    getTripsByUserId: async () => {
      console.log("Using mock getTripsByUserId");
      return [{
        id: 1,
        userId: 1,
        name: 'Mock Trip 1',
        description: 'This is mock trip 1',
        createdAt: new Date(),
        updatedAt: new Date()
      }];
    },
    createTrip: async (tripData) => {
      console.log("Using mock createTrip", tripData);
      return {
        id: 1,
        ...tripData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Trip;
    },
    updateTrip: async (id, tripData) => {
      console.log("Using mock updateTrip", id, tripData);
      return {
        id,
        userId: 1,
        name: tripData.name || 'Mock Trip',
        description: tripData.description || 'This is a mock trip',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    deleteTrip: async (id) => {
      console.log("Using mock deleteTrip", id);
    },
    
    // Expense methods
    getExpense: async (id) => {
      console.log("Using mock getExpense", id);
      return {
        id,
        userId: 1,
        tripName: 'Mock Trip',
        date: new Date().toISOString(),
        type: 'Food',
        vendor: 'Mock Vendor',
        location: 'Mock Location',
        cost: 100,
        comments: 'Mock comments',
        receiptPath: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    getExpensesByUserId: async () => {
      console.log("Using mock getExpensesByUserId");
      return [{
        id: 1,
        userId: 1,
        tripName: 'Mock Trip',
        date: new Date().toISOString(),
        type: 'Food',
        vendor: 'Mock Vendor',
        location: 'Mock Location',
        cost: 100,
        comments: 'Mock comments',
        receiptPath: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }];
    },
    getExpensesByTripName: async () => {
      console.log("Using mock getExpensesByTripName");
      return [{
        id: 1,
        userId: 1,
        tripName: 'Mock Trip',
        date: new Date().toISOString(),
        type: 'Food',
        vendor: 'Mock Vendor',
        location: 'Mock Location',
        cost: 100,
        comments: 'Mock comments',
        receiptPath: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }];
    },
    createExpense: async (expenseData) => {
      console.log("Using mock createExpense", expenseData);
      return {
        id: 1,
        ...expenseData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Expense;
    },
    updateExpense: async (id, expenseData) => {
      console.log("Using mock updateExpense", id, expenseData);
      return {
        id,
        userId: 1,
        tripName: 'Mock Trip',
        date: expenseData.date || new Date().toISOString(),
        type: expenseData.type || 'Food',
        vendor: expenseData.vendor || 'Mock Vendor',
        location: expenseData.location || 'Mock Location',
        cost: expenseData.cost || 100,
        comments: expenseData.comments || 'Mock comments',
        receiptPath: expenseData.receiptPath || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    deleteExpense: async (id) => {
      console.log("Using mock deleteExpense", id);
    },
    
    // Mileage Log methods
    getMileageLogById: async (id) => {
      console.log("Using mock getMileageLogById", id);
      return {
        id,
        userId: 1,
        tripId: 1,
        tripDate: new Date(),
        startOdometer: '10000',
        endOdometer: '10100',
        calculatedDistance: '100',
        purpose: 'Mock purpose',
        startImageUrl: null,
        endImageUrl: null,
        entryMethod: 'manual',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    getMileageLogsByUserId: async () => {
      console.log("Using mock getMileageLogsByUserId");
      return [{
        id: 1,
        userId: 1,
        tripId: 1,
        tripDate: new Date(),
        startOdometer: '10000',
        endOdometer: '10100',
        calculatedDistance: '100',
        purpose: 'Mock purpose',
        startImageUrl: null,
        endImageUrl: null,
        entryMethod: 'manual',
        createdAt: new Date(),
        updatedAt: new Date()
      }];
    },
    createMileageLog: async (logData) => {
      console.log("Using mock createMileageLog", logData);
      return {
        id: 1,
        userId: logData.userId,
        tripId: logData.tripId || null,
        tripDate: logData.tripDate,
        startOdometer: String(logData.startOdometer),
        endOdometer: String(logData.endOdometer),
        calculatedDistance: String(logData.calculatedDistance),
        purpose: logData.purpose || null,
        startImageUrl: logData.startImageUrl || null,
        endImageUrl: logData.endImageUrl || null,
        entryMethod: logData.entryMethod,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    updateMileageLog: async (id, logData) => {
      console.log("Using mock updateMileageLog", id, logData);
      return {
        id,
        userId: 1,
        tripId: logData.tripId || null,
        tripDate: logData.tripDate || new Date(),
        startOdometer: logData.startOdometer ? String(logData.startOdometer) : '10000',
        endOdometer: logData.endOdometer ? String(logData.endOdometer) : '10100',
        calculatedDistance: logData.calculatedDistance ? String(logData.calculatedDistance) : '100',
        purpose: logData.purpose || 'Mock purpose',
        startImageUrl: logData.startImageUrl || null,
        endImageUrl: logData.endImageUrl || null,
        entryMethod: logData.entryMethod || 'manual',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    deleteMileageLog: async (id) => {
      console.log("Using mock deleteMileageLog", id);
    }
  };
  
  return mockStorage;
}