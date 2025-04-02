import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url'; // Import url module

console.log("Attempting to reset Drizzle migration tracking...");

// ESM equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const dbPath = path.join(__dirname, '..', 'sqlite.db'); // This should now work
  console.log(`Database path: ${dbPath}`);
  
  const sqlite = new Database(dbPath);

  // Check if the table exists before trying to drop it
  const checkTableStmt = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations';");
  const tableExists = checkTableStmt.get();

  if (tableExists) {
    console.log("Found __drizzle_migrations table. Dropping it...");
    const dropStmt = sqlite.prepare("DROP TABLE `__drizzle_migrations`;");
    dropStmt.run();
    console.log("__drizzle_migrations table dropped successfully.");
  } else {
    console.log("__drizzle_migrations table does not exist. No action needed.");
  }

  sqlite.close();
  console.log("Migration tracking reset complete.");
  process.exit(0); 
} catch (error) {
  console.error("Error resetting migration tracking:", error);
  process.exit(1); 
}