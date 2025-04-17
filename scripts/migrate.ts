import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get database URL from environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// TypeScript non-null assertion since we've checked above
const dbUrl = databaseUrl as string;

// Run migrations
async function main() {
  console.log('Running migrations...');
  
  try {
    // Create a postgres client
    const client = postgres(dbUrl, { max: 1 });
    
    // Create a drizzle instance
    const db = drizzle(client);
    
    // Run migrations
    await migrate(db, { migrationsFolder: './migrations' });
    
    console.log('Migrations completed successfully');
    
    // Close the connection
    await client.end();
    
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

main();