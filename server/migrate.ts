import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url'; // Import url module

console.log("Running database migrations...");

// ESM equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  // Construct the path to the database file relative to the script location
  // Assuming migrate.ts is in server/ and sqlite.db is in the root
  const dbPath = path.join(__dirname, '..', 'sqlite.db'); // This should now work
  console.log(`Database path: ${dbPath}`);

  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  // Construct the path to the migrations folder relative to the script location
  const migrationsFolder = path.join(__dirname, '..', 'migrations'); // This should now work
  console.log(`Migrations folder: ${migrationsFolder}`);

  // This will automatically search for SQL files in the migrations folder and apply the ones not applied yet.
  migrate(db, { migrationsFolder: migrationsFolder });

  console.log("Migrations applied successfully!");
  sqlite.close(); // Close the database connection
  process.exit(0); // Exit successfully
} catch (error) {
  console.error("Error running migrations:", error);
  process.exit(1); // Exit with error
}