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

if (process.env.NODE_ENV === 'production') {
  // In production, we'll create a new connection for each request
  // Use a smaller connection pool size for Vercel's serverless environment
  conn = postgres(process.env.DATABASE_URL!, {
    max: 1, // Single connection for serverless functions
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 10 // Connection timeout after 10 seconds
  });
} else {
  // In development, we'll reuse the connection
  if (!global.cachedConnection) {
    global.cachedConnection = postgres(process.env.DATABASE_URL!, {
      max: 5, // More connections for development
      idle_timeout: 30
    });
  }
  conn = global.cachedConnection;
}

// Initialize Drizzle with the postgres client
export const db = drizzle(conn, { schema });

// Export the raw connection for direct queries if needed
export const sql = conn;

// Helper function to close the connection (useful for serverless functions)
export const closeConnection = async () => {
  if (process.env.NODE_ENV === 'production') {
    await conn.end();
  }
};