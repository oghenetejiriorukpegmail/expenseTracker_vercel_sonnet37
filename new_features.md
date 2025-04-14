# Feature Plan: Mileage Tracking

This document outlines the plan for adding a mileage tracking feature to the ExpenseTracker application.

## 1. Goals

*   Allow users to record mileage for trips.
*   Store mileage data persistently.
*   Provide UI for inputting and viewing mileage records.
*   Integrate mileage tracking seamlessly into the existing application.

## 2. Data Model (Database Schema)

*   **Location:** `shared/schema.ts`
*   **Changes:**
    *   Introduce a new table, `mileage_logs`.
    *   **Schema Definition (Example):**
        ```typescript
        import { sql } from "drizzle-orm";
        import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
        import { users } from "./users"; // Assuming a users table exists and is imported

        export const mileage_logs = sqliteTable('mileage_logs', {
          id: integer('id').primaryKey(),
          userId: integer('user_id').notNull().references(() => users.id), // Link to the user
          trip_date: integer('trip_date', { mode: 'timestamp' }).notNull(),
          purpose: text('purpose').notNull(),
          start_location: text('start_location'), // Optional
          end_location: text('end_location'),     // Optional
          start_odometer: real('start_odometer'), // Optional, for odometer tracking
          end_odometer: real('end_odometer'),     // Optional, for odometer tracking
          distance: real('distance').notNull(),   // Required, can be calculated or entered directly
          vehicle: text('vehicle'),               // Optional
          notes: text('notes'),                   // Optional
          createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
        });
        ```
    *   **Considerations:** Decide whether to enforce `start_odometer`/`end_odometer` or allow direct `distance` input, or both. Consider linking to a potential `vehicles` table if more detailed vehicle tracking is desired later.

## 3. Database Migration

*   **Action:** Create a new Drizzle migration file after updating the schema.
*   **Command:** Run the migration generation script (e.g., `npm run db:generate-migration` or similar, check `package.json`). Then run the migration apply script (e.g., `npm run db:migrate`).
*   **Location:** A new file will be generated in the `migrations/` directory.

## 4. Backend (Server)

*   **Location:** `server/routes.ts` (for API endpoints), potentially new files for service logic if complexity increases.
*   **API Endpoints (Example):**
    *   `POST /api/mileage`: Create a new mileage log.
    *   `GET /api/mileage`: Get all mileage logs for the logged-in user (consider pagination/filtering).
    *   `GET /api/mileage/:id`: Get a specific mileage log by its ID.
    *   `PUT /api/mileage/:id`: Update a specific mileage log.
    *   `DELETE /api/mileage/:id`: Delete a specific mileage log.
*   **Logic:**
    *   Implement route handlers using the existing framework (likely Hono based on typical Vite setups).
    *   Use Drizzle ORM instance (likely available via context or import from `server/storage.ts` or similar) to interact with the `mileage_logs` table.
    *   Validate incoming data (potentially using Zod, check existing patterns).
    *   Ensure proper authentication and authorization using existing middleware (`server/auth.ts`). Only the owner should be able to access/modify their logs.

## 5. Frontend (Client)

*   **Location:** `client/src/` (likely within subdirectories like `components`, `pages` or `views`, `api`).
*   **UI Components (Example - using React/TSX):**
    *   `MileageForm.tsx`: A form component for creating/editing mileage logs (inputs for date, purpose, distance/odometer, locations, vehicle, notes).
    *   `MileageList.tsx`: Component to display a list or table of mileage logs fetched from the API.
    *   `MileageListItem.tsx`: Component representing a single row/item in the `MileageList`.
*   **Pages/Views:**
    *   Create a new route and corresponding page component (e.g., `MileagePage.tsx` mapped to `/mileage`) to host the `MileageList` and provide access to the `MileageForm` (e.g., via a "Add Mileage" button opening a modal or navigating to a separate form page).
*   **API Integration:**
    *   Create or update a client-side API service module (e.g., `client/src/lib/api/mileage.ts`) with functions to call the new backend endpoints (using `fetch` or a library like `tanstack-query` if already in use).
*   **State Management:** Integrate mileage data fetching and management into the existing client-side state management solution (if any) or use local component state/`tanstack-query` caching.

## 6. Integration

*   Add a new link in the main application navigation (e.g., sidebar, header menu) pointing to the `/mileage` page.
*   Consider future enhancements like associating mileage logs with specific expense entries (e.g., fuel) or generating mileage reports.

## 7. Testing

*   Add unit tests for new backend logic (route handlers, validation, database interactions).
*   Add integration tests for the new API endpoints.
*   Add component tests for the new React components.
*   Consider adding end-to-end tests covering the user flow of adding and viewing mileage.

## 8. Documentation Updates

*   Update the main `README.md` to mention the new mileage tracking feature.
*   Add code comments where necessary to explain complex logic.