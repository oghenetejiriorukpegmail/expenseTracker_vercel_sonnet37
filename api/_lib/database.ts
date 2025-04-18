import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// For Vercel serverless functions, we need to handle connection pooling differently
// https://vercel.com/docs/storage/vercel-postgres/using-an-orm#drizzle-orm

// Global is used here to maintain a cached connection across hot reloads
// in development. This prevents connections growing exponentially
// during API Route usage.
declare global {
  var cachedConnection: postgres.Sql | undefined;
}

let conn: postgres.Sql;

// Check if DATABASE_URL is defined
if (!process.env.DATABASE_URL) {
  console.error('FATAL ERROR: DATABASE_URL environment variable is not set');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1); // Exit in production if DATABASE_URL is missing
  }
}

try {
  if (process.env.NODE_ENV === 'production') {
    // In production, we'll create a new connection for each request
    // Use a smaller connection pool size for Vercel's serverless environment
    console.log('Initializing production database connection');
    conn = postgres(process.env.DATABASE_URL!, {
      max: 1, // Single connection for serverless functions
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout after 10 seconds
      debug: false, // Disable debug logging in production
      ssl: true, // Force SSL to be enabled
    });
  } else {
    // In development, we'll reuse the connection
    console.log('Initializing development database connection');
    if (!global.cachedConnection) {
      global.cachedConnection = postgres(process.env.DATABASE_URL!, {
        max: 5, // More connections for development
        idle_timeout: 30,
        debug: true, // Enable debug logging in development
        ssl: true, // Force SSL to be enabled
      });
    }
    conn = global.cachedConnection;
  }

  // Test the connection
  console.log('Testing database connection...');
  conn`SELECT 1`.then(() => {
    console.log('Database connection successful');
  }).catch(err => {
    console.error('Database connection test failed:', err);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1); // Exit in production if connection test fails
    }
  });
} catch (error) {
  console.error('Error initializing database connection:', error);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1); // Exit in production if connection initialization fails
  }
  // In development, create a dummy connection that will throw errors when used
  conn = postgres('postgres://invalid:invalid@localhost:5432/invalid', {
    ssl: true // Force SSL to be enabled
  });
}

// Initialize Drizzle with the postgres client
export const db = drizzle(conn, { schema });

// Export the raw connection for direct queries if needed
export const sql = conn;

// Helper function to close the connection (useful for serverless functions)
export const closeConnection = async (req?: any) => {
  // Check if we should prevent auto-closing (set by dbConnectionMiddleware)
  if (req && req.__preventAutoConnectionClose) {
    console.log('Skipping database connection close due to middleware flag');
    return;
  }

  // Only close connections in production environment and only for non-cached connections
  if (process.env.NODE_ENV === 'production' && conn !== global.cachedConnection) {
    try {
      console.log('Closing database connection in production environment');
      await conn.end();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  } else {
    // In development, we keep the connection open
    console.log('Keeping database connection open in development environment');
  }
};