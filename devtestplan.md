# Expense Tracker Application - Development Test Plan

## Overview

This document outlines the test procedures for verifying the functionality of the refactored expense tracker application. The test plan covers all key features of the application, including authentication, expense management, trip management, and OCR processing.

## Prerequisites

- The application is running in development mode with `npm run dev`
- A modern web browser (Chrome, Firefox, Edge, etc.)
- Test data for creating expenses and trips
- Sample receipt images for OCR testing

## 1. System Status Verification

### 1.1 Initial Status Check

1. Access the application at http://localhost:3000
2. Verify the following status indicators:
   - Supabase Storage: Connected
   - API Routes: Working
3. Check the terminal output for any errors or warnings

### 1.2 Environment Variables Verification

1. Confirm the following environment variables are properly configured:
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Secret key for JWT token generation
   - `SUPABASE_URL` - Supabase project URL
   - `SUPABASE_SERVICE_KEY` - Supabase service key
   - `OPENAI_API_KEY` or another OCR API key

## 2. Authentication Testing

### 2.1 Registration Testing

1. Navigate to http://localhost:3000/test-auth
2. Enter test credentials:
   - Username: testuser
   - Email: test@example.com
   - Password: Password123
3. Click "Test Registration"
4. Verify successful response:
   - Status: 200
   - Success: Yes
   - Message: "User registration test successful"

### 2.2 Login Testing

1. Use Postman or a similar tool to send a POST request to `/api/auth/login`
2. Include the following JSON body:
   ```json
   {
     "username": "testuser",
     "password": "Password123"
   }
   ```
3. Verify successful response:
   - Status: 200
   - User data returned (excluding password)
   - JWT token returned
   - Cookie set with token

### 2.3 User Authentication Testing

1. Use Postman or a similar tool to send a GET request to `/api/auth/user`
2. Include the JWT token from the login response in the Authorization header
3. Verify successful response:
   - Status: 200
   - User data returned (excluding password)

### 2.4 Logout Testing

1. Use Postman or a similar tool to send a POST request to `/api/auth/logout`
2. Include the JWT token from the login response in the Authorization header
3. Verify successful response:
   - Status: 200
   - Message: "Logged out successfully"
   - Cookie cleared

## 3. Trip Management Testing

### 3.1 Create Trip

1. Use Postman or a similar tool to send a POST request to `/api/trips`
2. Include the JWT token from the login response in the Authorization header
3. Include the following JSON body:
   ```json
   {
     "name": "Business Trip to New York",
     "description": "Annual conference attendance"
   }
   ```
4. Verify successful response:
   - Status: 201
   - Trip data returned with ID

### 3.2 Get Trips

1. Use Postman or a similar tool to send a GET request to `/api/trips`
2. Include the JWT token from the login response in the Authorization header
3. Verify successful response:
   - Status: 200
   - Array of trips returned, including the one created in the previous step

### 3.3 Get Trip by ID

1. Use Postman or a similar tool to send a GET request to `/api/trips/{id}` (replace {id} with the ID from the created trip)
2. Include the JWT token from the login response in the Authorization header
3. Verify successful response:
   - Status: 200
   - Trip data returned

### 3.4 Update Trip

1. Use Postman or a similar tool to send a PUT request to `/api/trips/{id}` (replace {id} with the ID from the created trip)
2. Include the JWT token from the login response in the Authorization header
3. Include the following JSON body:
   ```json
   {
     "name": "Business Trip to New York - Updated",
     "description": "Annual conference attendance and client meetings"
   }
   ```
4. Verify successful response:
   - Status: 200
   - Updated trip data returned

### 3.5 Delete Trip

1. Use Postman or a similar tool to send a DELETE request to `/api/trips/{id}` (replace {id} with the ID from the created trip)
2. Include the JWT token from the login response in the Authorization header
3. Verify successful response:
   - Status: 200
   - Message: "Trip deleted successfully"

## 4. Expense Management Testing

### 4.1 Create Expense

1. Use Postman or a similar tool to send a POST request to `/api/expenses`
2. Include the JWT token from the login response in the Authorization header
3. Include the following JSON body:
   ```json
   {
     "date": "2025-04-17",
     "cost": "150.75",
     "type": "meal",
     "vendor": "Restaurant ABC",
     "location": "New York",
     "tripName": "Business Trip to New York",
     "comments": "Dinner with clients"
   }
   ```
4. Verify successful response:
   - Status: 201
   - Expense data returned with ID

### 4.2 Get Expenses

1. Use Postman or a similar tool to send a GET request to `/api/expenses`
2. Include the JWT token from the login response in the Authorization header
3. Verify successful response:
   - Status: 200
   - Array of expenses returned, including the one created in the previous step

### 4.3 Get Expenses by Trip Name

1. Use Postman or a similar tool to send a GET request to `/api/expenses?tripName=Business Trip to New York`
2. Include the JWT token from the login response in the Authorization header
3. Verify successful response:
   - Status: 200
   - Array of expenses returned, filtered by the specified trip name

### 4.4 Get Expense by ID

1. Use Postman or a similar tool to send a GET request to `/api/expenses/{id}` (replace {id} with the ID from the created expense)
2. Include the JWT token from the login response in the Authorization header
3. Verify successful response:
   - Status: 200
   - Expense data returned

### 4.5 Update Expense

1. Use Postman or a similar tool to send a PUT request to `/api/expenses/{id}` (replace {id} with the ID from the created expense)
2. Include the JWT token from the login response in the Authorization header
3. Include the following JSON body:
   ```json
   {
     "date": "2025-04-17",
     "cost": "175.50",
     "type": "meal",
     "vendor": "Restaurant XYZ",
     "location": "New York",
     "tripName": "Business Trip to New York",
     "comments": "Dinner with clients and partners"
   }
   ```
4. Verify successful response:
   - Status: 200
   - Updated expense data returned

### 4.6 Delete Expense

1. Use Postman or a similar tool to send a DELETE request to `/api/expenses/{id}` (replace {id} with the ID from the created expense)
2. Include the JWT token from the login response in the Authorization header
3. Verify successful response:
   - Status: 200
   - Message: "Expense deleted successfully"

## 5. OCR Processing Testing

### 5.1 Process Receipt with OCR

1. Use Postman or a similar tool to send a POST request to `/api/ocr/process`
2. Include the JWT token from the login response in the Authorization header
3. Set the content type to `multipart/form-data`
4. Include the following form fields:
   - `receipt`: Upload a sample receipt image file
   - `method`: "gemini" (or another available OCR method)
   - `template`: "general"
5. Verify successful response:
   - Status: 200
   - Extracted data returned, including date, cost, vendor, etc.
   - Formatted data for form auto-fill

### 5.2 Upload Receipt with Expense

1. Use Postman or a similar tool to send a POST request to `/api/expenses/upload`
2. Include the JWT token from the login response in the Authorization header
3. Set the content type to `multipart/form-data`
4. Include the following form fields:
   - `receipt`: Upload a sample receipt image file
   - `date`: "2025-04-17"
   - `cost`: "150.75"
   - `type`: "meal"
   - `vendor`: "Restaurant ABC"
   - `location`: "New York"
   - `tripName`: "Business Trip to New York"
   - `comments`: "Dinner with clients"
5. Verify successful response:
   - Status: 201
   - Expense data returned with ID and receipt path

## 6. Error Handling Testing

### 6.1 Authentication Errors

1. Test registration with an existing username
   - Expected response: Status 409, "Username already exists"
2. Test login with invalid credentials
   - Expected response: Status 401, "Invalid username or password"
3. Test accessing protected endpoints without authentication
   - Expected response: Status 401, "Unauthorized"

### 6.2 Validation Errors

1. Test creating an expense with missing required fields
   - Expected response: Status 400, "Missing required fields"
2. Test creating a trip with missing name
   - Expected response: Status 400, "Trip name is required"
3. Test OCR processing without a receipt file
   - Expected response: Status 400, "Receipt file is required"

## 7. Performance Testing

### 7.1 Response Time

1. Measure response time for key API endpoints:
   - Authentication endpoints
   - Expense management endpoints
   - Trip management endpoints
   - OCR processing endpoint
2. Verify all endpoints respond within acceptable time limits (< 1000ms)

### 7.2 Concurrent Requests

1. Simulate multiple concurrent requests to key API endpoints
2. Verify the application handles concurrent requests without errors

## 8. Security Testing

### 8.1 Authentication Security

1. Verify JWT tokens expire after the configured time
2. Verify password hashing is implemented correctly
3. Verify HTTP-only cookies are used for token storage

### 8.2 Authorization Security

1. Verify users can only access their own data
2. Verify proper input validation and sanitization

## Test Results Documentation

For each test case, document the following:

1. Test case ID and description
2. Test steps performed
3. Expected result
4. Actual result
5. Pass/Fail status
6. Any issues encountered and their resolutions
7. Screenshots or logs as evidence

## Issue Tracking

Any issues discovered during testing should be documented with the following information:

1. Issue description
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Severity (Critical, High, Medium, Low)
6. Priority (High, Medium, Low)
7. Assigned to
8. Status (Open, In Progress, Resolved, Closed)