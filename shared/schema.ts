// Import PostgreSQL core functions
import { pgTable, text, integer, serial, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core"; // Added pgEnum
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define users table for PostgreSQL
export const users = pgTable("users", {
  id: serial("id").primaryKey(), // Use serial for auto-incrementing integer PK in PG
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull().default(''),
  lastName: text("last_name").notNull().default(''),
  phoneNumber: text("phone_number").notNull().default(''),
  email: text("email").notNull().unique().default(''),
  bio: text("bio"),
  // Use timestamp with timezone for PG
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
});

// Define trips table for PostgreSQL
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  // Ensure foreign key references integer type (serial resolves to integer)
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
});

// Define expenses table for PostgreSQL
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  date: text("date").notNull(), // Keep date as text (YYYY-MM-DD) or use date type: date("date")
  vendor: text("vendor").notNull(),
  location: text("location").notNull(),
  // Use numeric for precise decimal values (good for currency)
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull(),
  comments: text("comments"),
  tripName: text("trip_name").notNull(),
  receiptPath: text("receipt_path"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
});

// Define an enum for the entry method
export const entryMethodEnum = pgEnum('entry_method', ['manual', 'ocr']);

// Define mileage_logs table for PostgreSQL
export const mileageLogs = pgTable("mileage_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Foreign key to users
  tripId: integer("trip_id").references(() => trips.id, { onDelete: 'set null' }), // Optional foreign key to trips
  tripDate: timestamp("trip_date", { withTimezone: true, mode: 'date' }).notNull(),
  startOdometer: numeric("start_odometer", { precision: 10, scale: 1 }).notNull(),
  endOdometer: numeric("end_odometer", { precision: 10, scale: 1 }).notNull(),
  calculatedDistance: numeric("calculated_distance", { precision: 10, scale: 1 }).notNull(), // Automatically calculated
  purpose: text("purpose"), // Optional reason for the trip
  startImageUrl: text("start_image_url"), // URL/path to the starting odometer image
  endImageUrl: text("end_image_url"), // URL/path to the ending odometer image
  entryMethod: entryMethodEnum("entry_method").notNull(), // 'manual' or 'ocr'
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'date' }).defaultNow(),
});


// Insert schemas (should adapt automatically to the new table types)
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  firstName: true, // Existing firstName
  lastName: true, // Include lastName in insert schema
  phoneNumber: true, // Include phoneNumber in insert schema
  email: true, // Existing email
  // bio is optional, not included by default
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

// 1. Raw schema from createInsertSchema + pick
export const rawInsertMileageLogSchema = createInsertSchema(mileageLogs).pick({
    tripId: true, // Optional
    tripDate: true,
    startOdometer: true,
    endOdometer: true,
    purpose: true, // Optional
    entryMethod: true,
    // calculatedDistance is derived, start/endImageUrl handled separately
});

// 2. Extended schema with number validation
export const extendedInsertMileageLogSchema = rawInsertMileageLogSchema.extend({
    // Ensure numeric fields are treated as numbers by Zod
    startOdometer: z.number().positive('Start odometer must be positive'),
    endOdometer: z.number().positive('End odometer must be positive'),
    tripId: z.number().int().positive().optional(), // Ensure tripId is validated correctly if provided
});

// 3. Final schema for creation, adding the refinement
export const insertMileageLogSchema = extendedInsertMileageLogSchema.refine(data => data.endOdometer > data.startOdometer, {
    message: "End odometer reading must be greater than start odometer reading",
    path: ["endOdometer"],
});

// Export the base schema separately for potential use (like updates before refinement)
export const baseInsertMileageLogSchema = rawInsertMileageLogSchema;

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export type InsertMileageLog = z.infer<typeof insertMileageLogSchema>; // Type for creation
export type RawInsertMileageLog = z.infer<typeof rawInsertMileageLogSchema>; // Type for base schema (useful for updates)
export type MileageLog = typeof mileageLogs.$inferSelect;
