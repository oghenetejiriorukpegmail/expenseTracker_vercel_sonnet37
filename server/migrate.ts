import 'dotenv/config'; // Load environment variables first!
// Import the Supabase storage initializer which handles migrations
import { SupabaseStorage } from './supabase-storage';

console.log("Running database migrations via SupabaseStorage initializer...");

(async () => {
  try {
    // Initialize storage - this will connect and run migrations
    await SupabaseStorage.initialize();
    console.log("Migrations applied successfully via initializer!");
    process.exit(0); // Exit successfully
  } catch (error) {
    console.error("Error running migrations via initializer:", error);
    process.exit(1); // Exit with error
  }
})();