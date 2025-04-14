## Objective: Develop a Native Android Expense Tracker Application

Create a native Android application that replicates the core features and functionality of the existing web-based Expense Tracker application. The Android app should provide a seamless and intuitive mobile experience for managing trips and expenses.

## Target Platform:

*   **Platform:** Android
*   **Minimum SDK:** API Level 24 (Android 7.0 Nougat) - *Suggestion, can be adjusted.*
*   **Target SDK:** Latest stable version.

## Core Features:

1.  **User Authentication:**
    *   Secure user registration (Email/Password).
    *   User login and session management (persistent login).
    *   Password recovery/reset option.
    *   Consider integration with existing backend authentication or suggest a suitable mobile authentication strategy (e.g., Firebase Authentication, JWT).
2.  **User Profile Management:**
    *   Dedicated screen to view and update user information (First Name, Last Name, Phone, Email, Bio).
    *   Functionality to change the account password securely.
3.  **Trip Management:**
    *   Create new trips with relevant details (Name, Description, Start/End Dates).
    *   View a list of all trips.
    *   Update existing trip details.
    *   Delete trips (handle associated expenses appropriately - confirmation needed).
4.  **Expense Tracking:**
    *   Add new expenses associated with a specific trip (Description, Amount, Category, Date, Vendor).
    *   View expenses filtered by trip or view all expenses.
    *   Update existing expense details.
    *   Delete expenses.
5.  **Receipt Handling:**
    *   Attach receipts to expenses by:
        *   Capturing a photo using the device camera.
        *   Selecting an image from the device gallery (JPG, PNG, GIF).
        *   Selecting a PDF file from device storage.
    *   Display attached receipt thumbnails/previews.
    *   Allow viewing the full receipt image/PDF within the app.
6.  **OCR Receipt Processing:**
    *   Integrate with external OCR APIs (Google Gemini, OpenAI Vision, Anthropic Claude, OpenRouter).
    *   Allow users to configure API keys and select the preferred OCR provider and template (e.g., "General Receipt", "Travel Expenses") within the app's settings.
    *   Implement functionality to trigger OCR processing on uploaded receipts (images and PDFs) and automatically populate expense fields (Vendor, Date, Total, etc.) based on the extracted data. Provide a way for users to review and confirm/edit the extracted data.
7.  **Local Data Persistence:**
    *   Store all user data, trips, expenses, and potentially cached settings locally using an SQLite database.
    *   Implement robust data storage and retrieval logic.
8.  **Data Export:**
    *   Allow users to export expenses (for a specific trip or all expenses) to an Excel (.xlsx) file.
    *   The exported file should be shareable or saveable to the device's storage.
9.  **Dashboard:**
    *   A main dashboard screen displaying:
        *   Personalized welcome message.
        *   Summary statistics (Total Trips, Total Expenses, Total Spending).
        *   Visualizations/Charts (e.g., expense breakdown by category, spending trends over time) using a native charting library.
        *   List of recent activities or recent expenses.
10. **Settings:**
    *   Theme selection (Light/Dark Mode).
    *   OCR provider selection and API key configuration.
    *   User profile access.
    *   Logout functionality.

## Technology Stack Suggestions:

*   **Language:** Kotlin
*   **UI Toolkit:** Jetpack Compose (preferred) or XML Layouts with View Binding/Data Binding.
*   **Architecture:** MVVM (Model-View-ViewModel) or MVI (Model-View-Intent).
*   **Database:** Room Persistence Library over SQLite.
*   **Networking:** Retrofit or Ktor Client for API communication (OCR, potentially backend sync).
*   **Asynchronous Operations:** Kotlin Coroutines & Flow.
*   **Image Loading:** Coil or Glide.
*   **Charts:** MPAndroidChart, Compose Charts, or similar native library.
*   **File Handling:** Android Storage Access Framework, Content Providers.

## Key Considerations:

*   **Native Look & Feel:** Adhere to Material Design 3 guidelines for a modern and consistent user experience.
*   **Offline Capability:** The app should be usable offline for viewing/adding/editing data stored locally. Implement a strategy for syncing data with a backend if applicable.
*   **Security:** Securely store API keys, user credentials, and sensitive data. Use HTTPS for all network communication.
*   **Permissions:** Properly request and handle necessary permissions (Camera, Storage).
*   **Performance:** Optimize for smooth performance and efficient resource usage on mobile devices.
*   **Error Handling:** Implement comprehensive error handling and provide clear user feedback.
*   **Testing:** Include unit and integration tests.

## Deliverables:

*   Well-structured and documented source code for the native Android application.
*   Instructions for building and running the application.