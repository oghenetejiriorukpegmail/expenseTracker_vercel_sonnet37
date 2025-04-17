# Mileage Tracking Feature Plan (Revised)

This document outlines the plan for implementing the mileage tracking feature in the Expense Tracker application.

## 1. Data Model (Database Schema)

A new table, `mileage_logs`, will be added to `shared/schema.ts`. It includes an optional foreign key `tripId` to link mileage logs to specific trips.

```typescript
// In shared/schema.ts

import { pgTable, text, integer, serial, timestamp, numeric, varchar, pgEnum } from "drizzle-orm/pg-core";
import { users, trips } from "./schema"; // Assuming users and trips tables are imported or in the same file

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

// Define insert/select types using drizzle-zod if needed
// export const insertMileageLogSchema = createInsertSchema(mileageLogs);
// export type InsertMileageLog = z.infer<typeof insertMileageLogSchema>;
// export type MileageLog = typeof mileageLogs.$inferSelect;
```

**Rationale:**
*   Uses `numeric` for odometer readings/distance.
*   `tripId` links logs to trips (`onDelete: 'set null'` preserves logs if trip is deleted).
*   `entryMethod` uses a PostgreSQL `enum`.
*   `calculatedDistance` is computed in the backend.
*   Image URLs/paths stored in `startImageUrl`/`endImageUrl`.

## 2. API Endpoints (Backend)

New endpoints in `server/routes.ts`, handling the optional `tripId`.

*   **`POST /api/mileage-logs`**: Create a new log.
    *   **Method:** `POST`
    *   **Auth:** Required
    *   **Body:** Includes optional `tripId`, `tripDate`, `startOdometer`, `endOdometer`, `purpose`, `entryMethod`, optional image files.
    *   **Logic:** Validate, calculate distance, handle image uploads, call `storage.createMileageLog()`.
*   **`GET /api/mileage-logs`**: Retrieve logs.
    *   **Method:** `GET`
    *   **Auth:** Required
    *   **Query Params:** Optional `tripId`, `startDate`, `endDate`, pagination, sorting.
    *   **Logic:** Call `storage.getMileageLogsByUserId()` with filters.
*   **`PUT /api/mileage-logs/:id`**: Update a log.
    *   **Method:** `PUT`
    *   **Auth:** Required
    *   **Path Param:** `id`
    *   **Body:** Optional fields including `tripId`.
    *   **Logic:** Validate, fetch, verify ownership, recalculate distance, handle image updates, call `storage.updateMileageLog()`.
*   **`DELETE /api/mileage-logs/:id`**: Delete a log.
    *   **Method:** `DELETE`
    *   **Auth:** Required
    *   **Path Param:** `id`
    *   **Logic:** Validate, fetch, verify ownership, delete images, call `storage.deleteMileageLog()`.
*   **(Optional) `POST /api/mileage-logs/ocr`**: Process odometer image.
    *   **Method:** `POST`
    *   **Auth:** Required
    *   **Body:** `odometerImage` file.
    *   **Logic:** Upload via Multer, call `processOdometerImageWithOCR`, return reading.

## 3. Frontend Components (Client)

*   **`TripCard` (`client/src/components/cards/trip-card.tsx`):**
    *   **Modified:** Add a "+ Mileage" button.
    *   Button opens `AddEditMileageLogModal`, passing the `trip.id`.
*   **`MileageLogTable` (`client/src/components/mileage-log-table.tsx`):**
    *   Displays all mileage logs for the user.
    *   **Placement:** Shown in a new view/section accessible from the main navigation (e.g., "Mileage Logs" sidebar item). Allows filtering (including by trip).
    *   Includes Edit/Delete actions per row.
*   **`AddEditMileageLogModal` (`client/src/components/modals/add-edit-mileage-log-modal.tsx`):**
    *   **Modified:** Accepts optional `tripId` prop. Includes `tripId` in `POST` request if provided.
    *   Contains form for manual entry (Phase 1) and OCR upload controls (Phase 2).
*   **`OdometerImageUpload` (`client/src/components/upload/odometer-image-upload.tsx`) (Phase 2):**
    *   Reusable component for image capture/upload and OCR interaction.
*   **Sidebar (`client/src/components/sidebar.tsx`):**
    *   **Modified:** Add "Mileage Logs" navigation item linking to the view containing `MileageLogTable`.

## 4. OCR Strategy

*   **Approach:** Backend-based OCR (`server/util/ocr.ts`).
*   **Implementation:**
    *   Create `processOdometerImageWithOCR` function with specific prompts/settings for number extraction.
    *   Use the dedicated `POST /api/mileage-logs/ocr` endpoint.
    *   Frontend `OdometerImageUpload` component interacts with this endpoint.

## 5. Phased Implementation Plan

*   **Phase 1: Core Manual Entry**
    1.  **Database:** Implement updated `mileage_logs` schema & migration.
    2.  **Backend:** Implement CRUD API endpoints handling `tripId`.
    3.  **Frontend:** Modify `TripCard`, create `AddEditMileageLogModal` (manual), `MileageLogTable`, add sidebar navigation & view for the table.
*   **Phase 2: Image Upload & OCR Integration**
    1.  **Backend:** Implement image upload handling in API, OCR utility function, and OCR endpoint.
    2.  **Frontend:** Create `OdometerImageUpload` component, integrate into modal.