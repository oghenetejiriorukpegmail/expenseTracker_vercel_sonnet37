import { defineConfig } from "drizzle-kit";

// No need to check for DATABASE_URL for local SQLite

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite", // Change dialect to sqlite
  // driver property removed, let drizzle-kit infer or use default
  dbCredentials: {
    url: "sqlite.db", // Point to a local file
  },
  verbose: true, // Optional: for more detailed output during migrations
  strict: true, // Optional: for stricter schema checks
});
