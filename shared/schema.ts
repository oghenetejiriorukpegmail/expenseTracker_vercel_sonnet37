// Import SQLite core functions
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define users table for SQLite
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }), // Use integer primary key
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  // Store timestamps as integers (Unix epoch milliseconds) or ISO strings (text)
  // Using integer mode for simplicity with Date objects
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).default(new Date()),
});

// Define trips table for SQLite
export const trips = sqliteTable("trips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Ensure foreign key references integer type
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).default(new Date()),
});

// Define expenses table for SQLite
export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  date: text("date").notNull(), // Keep date as text (YYYY-MM-DD) for simplicity
  vendor: text("vendor").notNull(),
  location: text("location").notNull(),
  cost: real("cost").notNull(), // Use real for floating-point numbers in SQLite
  comments: text("comments"),
  tripName: text("trip_name").notNull(),
  receiptPath: text("receipt_path"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).default(new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).default(new Date()),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTripSchema = createInsertSchema(trips).pick({
  name: true,
  description: true,
}); // Removed .omit({ userId: true })

export const insertExpenseSchema = createInsertSchema(expenses).pick({
  type: true,
  date: true,
  vendor: true,
  location: true,
  cost: true,
  comments: true,
  tripName: true,
}); // Removed .omit({ userId: true })

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
