import { users, trips, expenses } from "@shared/schema";
import type { User, InsertUser, Trip, InsertTrip, Expense, InsertExpense, MileageLog, InsertMileageLog } from "@shared/schema"; // Added MileageLog types
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Define the storage interface
export interface IStorage {
  // User methods
  getUserById(id: number): Promise<User | undefined>; // Renamed from getUser
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>; // Add getUserByEmail
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(userId: number, profileData: { firstName: string; email: string; bio?: string | null }): Promise<User | undefined>; // Add updateUserProfile
  updateUserPassword(userId: number, newPasswordHash: string): Promise<void>; // Add updateUserPassword
  
  // Trip methods
  getTrip(id: number): Promise<Trip | undefined>;
  getTripsByUserId(userId: number): Promise<Trip[]>;
  createTrip(trip: InsertTrip & { userId: number }): Promise<Trip>;
  updateTrip(id: number, trip: Partial<InsertTrip>): Promise<Trip>;
  deleteTrip(id: number): Promise<void>;
  
  // Expense methods
  getExpense(id: number): Promise<Expense | undefined>;
  getExpensesByUserId(userId: number): Promise<Expense[]>;
  getExpensesByTripName(userId: number, tripName: string): Promise<Expense[]>;
  createExpense(expense: InsertExpense & { userId: number, receiptPath?: string | null }): Promise<Expense>;
  updateExpense(id: number, expense: Partial<InsertExpense & { receiptPath?: string | null }>): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;

  // Mileage Log methods
  getMileageLogById(id: number): Promise<MileageLog | undefined>;
  getMileageLogsByUserId(userId: number, options?: { tripId?: number; startDate?: string; endDate?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<MileageLog[]>;
  createMileageLog(log: InsertMileageLog & { userId: number; calculatedDistance: number; startImageUrl?: string | null; endImageUrl?: string | null }): Promise<MileageLog>;
  updateMileageLog(id: number, log: Partial<InsertMileageLog & { calculatedDistance?: number; startImageUrl?: string | null; endImageUrl?: string | null }>): Promise<MileageLog>;
  deleteMileageLog(id: number): Promise<void>;

  // Session store
  sessionStore: session.Store; // Use session.Store type
}

// MemStorage class removed as it's no longer used.

// Import the new Supabase storage implementation
import { SupabaseStorage } from './supabase-storage';

// Initialize and export the storage instance (as a promise)
const storagePromise = SupabaseStorage.initialize(); // Call the async initializer

// Export the promise. Modules importing this will need to await it.
export const storage = storagePromise;
