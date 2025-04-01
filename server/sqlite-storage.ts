import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@shared/schema';
import type { User, InsertUser, Trip, InsertTrip, Expense, InsertExpense } from "@shared/schema";
import { eq, and, desc } from 'drizzle-orm'; // Import desc for ordering
import session from "express-session";
// Import types if needed, but actual import is dynamic
// import type BetterSqlite3StoreType from 'better-sqlite3-session-store';

import { IStorage } from './storage'; // Import the interface

export class SqliteStorage implements IStorage {
  private db; // Drizzle instance
  private sqlite: Database.Database; // Raw better-sqlite3 instance
  public sessionStore!: session.Store; // Use definite assignment assertion

  // Private constructor to enforce initialization via async method
  private constructor(dbPath: string = 'sqlite.db') {
    this.sqlite = new Database(dbPath); // Store the raw connection
    // Enable WAL mode for better concurrency
    this.sqlite.pragma('journal_mode = WAL');
    this.db = drizzle(this.sqlite, { schema, logger: false }); // Pass raw connection to Drizzle
  }

  // Public async initialization method
  public static async initialize(dbPath: string = 'sqlite.db'): Promise<SqliteStorage> {
    const instance = new SqliteStorage(dbPath);

    // Run migrations using the Drizzle instance
    console.log("Running database migrations...");
    try {
        migrate(instance.db, { migrationsFolder: './migrations' });
        console.log("Migrations complete.");
    } catch (error) {
        console.error("Error running migrations:", error);
        // Decide if you want to throw or handle this error
    }

    // Dynamically import and initialize session store
    const storeModule = await import('better-sqlite3-session-store');
    const SqliteStore = storeModule.default(session); // Or storeModule(session) depending on export
    instance.sessionStore = new SqliteStore({
        client: instance.sqlite, // Pass the raw better-sqlite3 connection instance
        expired: {
            clear: true,
            intervalMs: 900000 // Check for expired sessions every 15 minutes
        }
    });
    console.log("SQLite session store initialized.");
    return instance;
  }

  // --- User methods ---
  async getUser(id: number): Promise<User | undefined> {
    // Use prepared statements for potentially better performance
    // const prepared = this.db.select().from(schema.users).where(eq(schema.users.id, sql.placeholder('id'))).prepare();
    // const result = await prepared.execute({ id });
    const result = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
     // Ensure case-insensitive comparison if needed (SQLite is often case-insensitive by default for ASCII)
     // Using lower() function for explicit case-insensitivity:
     // const result = await this.db.select().from(schema.users).where(eq(sql`lower(${schema.users.username})`, username.toLowerCase())).limit(1);
    const result = await this.db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0];
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Ensure all required fields for InsertUser are provided if not handled by DB defaults
    const result = await this.db.insert(schema.users).values(userData).returning();
    return result[0];
  }

  // --- Trip methods ---
  async getTrip(id: number): Promise<Trip | undefined> {
    const result = await this.db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
    return result[0];
  }

  async getTripsByUserId(userId: number): Promise<Trip[]> {
    // Add ordering if desired, e.g., by creation date
    return this.db.select().from(schema.trips).where(eq(schema.trips.userId, userId)).orderBy(desc(schema.trips.createdAt));
  }

  async createTrip(tripData: InsertTrip & { userId: number }): Promise<Trip> {
     // Ensure all required fields for InsertTrip are provided
     if (!tripData.name) {
        throw new Error("Trip name is required");
     }
     // Add default description if missing?
     const dataToInsert = {
        description: '', // Provide default if schema requires it and it's missing
        ...tripData,
     };
    const result = await this.db.insert(schema.trips).values(dataToInsert).returning();
    return result[0];
  }

  async updateTrip(id: number, tripData: Partial<InsertTrip>): Promise<Trip> {
     const result = await this.db.update(schema.trips)
       .set(tripData)
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
        await tx.delete(schema.expenses).where(and(eq(schema.expenses.userId, trip[0].userId), eq(schema.expenses.tripName, trip[0].name)));
        // Now delete the trip
        await tx.delete(schema.trips).where(eq(schema.trips.id, id));
    });
  }

  // --- Expense methods ---
  async getExpense(id: number): Promise<Expense | undefined> {
     const result = await this.db.select().from(schema.expenses).where(eq(schema.expenses.id, id)).limit(1);
     // Drizzle should map REAL to number directly
     // if (result[0]) {
     //    return { ...result[0], cost: parseFloat(result[0].cost as string) };
     // }
     return result[0]; // Return directly, cost should be number
  }

  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    const results = await this.db.select().from(schema.expenses)
                                .where(eq(schema.expenses.userId, userId))
                                .orderBy(desc(schema.expenses.date)); // Order by date descending
    // Drizzle should map REAL to number directly
    // return results.map(exp => ({ ...exp, cost: parseFloat(exp.cost as string) }));
    return results; // Return directly, cost should be number
  }

  async getExpensesByTripName(userId: number, tripName: string): Promise<Expense[]> {
    const results = await this.db.select().from(schema.expenses)
      .where(and(eq(schema.expenses.userId, userId), eq(schema.expenses.tripName, tripName)))
      .orderBy(desc(schema.expenses.date)); // Order by date descending
     // Drizzle should map REAL to number directly
     // return results.map(exp => ({ ...exp, cost: parseFloat(exp.cost as string) }));
     return results; // Return directly, cost should be number
  }

  async createExpense(expenseData: InsertExpense & { userId: number, receiptPath?: string | null }): Promise<Expense> {
     // Ensure all required fields for InsertExpense are provided
     const requiredFields: (keyof InsertExpense)[] = ['date', 'type', 'vendor', 'location', 'cost', 'tripName'];
     for (const field of requiredFields) {
        if (expenseData[field] === undefined || expenseData[field] === null) {
            // Ensure cost is not undefined/null before checking if it's a number
            if (field === 'cost' && typeof expenseData.cost !== 'number') {
                 throw new Error(`Missing or invalid required expense field: ${field}`);
            } else if (field !== 'cost') {
                 throw new Error(`Missing required expense field: ${field}`);
            }
        }
     }

     const dataToInsert = {
        ...expenseData,
        // Cost should be a number as defined in InsertExpense and mapped to REAL
        cost: expenseData.cost,
        receiptPath: expenseData.receiptPath || null,
        // Ensure default values if needed by schema and not provided
        comments: expenseData.comments ?? '',
     };
     const result = await this.db.insert(schema.expenses).values(dataToInsert).returning();
     // Cost should already be a number
     return result[0];
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense & { receiptPath?: string | null }>): Promise<Expense> {
    // Create a new object for data to update to avoid modifying original expenseData
    const dataToUpdate: Partial<typeof schema.expenses.$inferInsert> = {};

    // Copy allowed fields from expenseData to dataToUpdate
    for (const key in expenseData) {
        if (Object.prototype.hasOwnProperty.call(expenseData, key)) {
            const typedKey = key as keyof typeof expenseData;
            // Directly assign the value, Drizzle handles type mapping for 'real'
            (dataToUpdate as any)[typedKey] = expenseData[typedKey];
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
    // Cost should already be a number
    return result[0];
  }

  async deleteExpense(id: number): Promise<void> {
    await this.db.delete(schema.expenses).where(eq(schema.expenses.id, id));
  }
}