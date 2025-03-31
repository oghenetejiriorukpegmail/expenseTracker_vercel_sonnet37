import { users, trips, expenses } from "@shared/schema";
import type { User, InsertUser, Trip, InsertTrip, Expense, InsertExpense } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Define the storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  
  // Session store
  sessionStore: session.SessionStore;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private trips: Map<number, Trip>;
  private expenses: Map<number, Expense>;
  private userIdCounter: number;
  private tripIdCounter: number;
  private expenseIdCounter: number;
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.trips = new Map();
    this.expenses = new Map();
    this.userIdCounter = 1;
    this.tripIdCounter = 1;
    this.expenseIdCounter = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = {
      ...userData,
      id,
      createdAt: now
    };
    this.users.set(id, user);
    return user;
  }

  // Trip methods
  async getTrip(id: number): Promise<Trip | undefined> {
    return this.trips.get(id);
  }

  async getTripsByUserId(userId: number): Promise<Trip[]> {
    return Array.from(this.trips.values()).filter(
      (trip) => trip.userId === userId
    );
  }

  async createTrip(tripData: InsertTrip & { userId: number }): Promise<Trip> {
    const id = this.tripIdCounter++;
    const now = new Date();
    const trip: Trip = {
      ...tripData,
      id,
      createdAt: now
    };
    this.trips.set(id, trip);
    return trip;
  }

  async updateTrip(id: number, tripData: Partial<InsertTrip>): Promise<Trip> {
    const existingTrip = this.trips.get(id);
    if (!existingTrip) {
      throw new Error(`Trip with ID ${id} not found`);
    }
    
    const updatedTrip: Trip = {
      ...existingTrip,
      ...tripData
    };
    
    this.trips.set(id, updatedTrip);
    return updatedTrip;
  }

  async deleteTrip(id: number): Promise<void> {
    const tripExists = this.trips.has(id);
    if (!tripExists) {
      throw new Error(`Trip with ID ${id} not found`);
    }
    
    // Delete all expenses associated with this trip
    const tripToDelete = this.trips.get(id)!;
    const expensesToDelete = Array.from(this.expenses.values())
      .filter(expense => expense.tripName === tripToDelete.name);
    
    for (const expense of expensesToDelete) {
      this.expenses.delete(expense.id);
    }
    
    this.trips.delete(id);
  }

  // Expense methods
  async getExpense(id: number): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    return Array.from(this.expenses.values())
      .filter(expense => expense.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getExpensesByTripName(userId: number, tripName: string): Promise<Expense[]> {
    return Array.from(this.expenses.values())
      .filter(expense => expense.userId === userId && expense.tripName === tripName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createExpense(expenseData: InsertExpense & { userId: number, receiptPath?: string | null }): Promise<Expense> {
    const id = this.expenseIdCounter++;
    const now = new Date();
    
    // Convert cost to numeric if it's not already
    const cost = typeof expenseData.cost === 'number' 
      ? expenseData.cost 
      : parseFloat(expenseData.cost.toString());
    
    const expense: Expense = {
      ...expenseData,
      id,
      cost,
      receiptPath: expenseData.receiptPath || null,
      createdAt: now,
      updatedAt: now
    };
    
    this.expenses.set(id, expense);
    return expense;
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense & { receiptPath?: string | null }>): Promise<Expense> {
    const existingExpense = this.expenses.get(id);
    if (!existingExpense) {
      throw new Error(`Expense with ID ${id} not found`);
    }
    
    // Convert cost to numeric if it exists and it's not already
    let cost = existingExpense.cost;
    if (expenseData.cost !== undefined) {
      cost = typeof expenseData.cost === 'number' 
        ? expenseData.cost 
        : parseFloat(expenseData.cost.toString());
    }
    
    const updatedExpense: Expense = {
      ...existingExpense,
      ...expenseData,
      cost,
      updatedAt: new Date()
    };
    
    this.expenses.set(id, updatedExpense);
    return updatedExpense;
  }

  async deleteExpense(id: number): Promise<void> {
    const expenseExists = this.expenses.has(id);
    if (!expenseExists) {
      throw new Error(`Expense with ID ${id} not found`);
    }
    
    this.expenses.delete(id);
  }
}

// Export a singleton instance of MemStorage
export const storage = new MemStorage();
