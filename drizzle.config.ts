import 'dotenv/config'; // Load environment variables
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Configure Drizzle Kit for Supabase PostgreSQL
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql", // Change dialect to postgresql
  dbCredentials: {
    // Use the Supabase connection string
    url: process.env.DATABASE_URL,
  },
  verbose: true, // Optional: for more detailed output during migrations
  strict: true, // Optional: for stricter schema checks
});
