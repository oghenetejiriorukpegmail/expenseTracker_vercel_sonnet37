# Expense Tracker Application

A full-stack web application for tracking personal or business expenses, organized by trips. Built with React, Node.js, Express, TypeScript, and SQLite.

## Features

*   **User Authentication:** Secure user registration and login using Passport.js and persistent sessions stored in SQLite.
*   **Trip Management:** Create, view, update, and delete trips to categorize expenses.
*   **Expense Tracking:** Add, view, update, and delete expenses associated with specific trips.
*   **Receipt Upload:** Upload receipt images (JPG, PNG, GIF) or PDF files for expenses.
*   **OCR Receipt Processing:** Automatically extract data (vendor, date, total, etc.) from uploaded receipts using various cloud OCR services (Google Gemini, OpenAI Vision, Anthropic Claude, OpenRouter).
    *   PDFs are processed directly using these vision APIs.
*   **Persistent Storage:** All user data, trips, expenses, and sessions are stored persistently in an SQLite database (`sqlite.db`) using Drizzle ORM.
*   **Data Export:** Export expenses for a specific trip or all expenses to an Excel (.xlsx) file.
*   **Dashboard:** Overview of total trips, expenses, spending, and recent activity. Includes charts for expense breakdown and trends.
*   **Responsive UI:** Built with Tailwind CSS and Shadcn UI for a clean and responsive user interface.
*   **Light/Dark Mode:** Theme toggling available in settings.

## Tech Stack

*   **Frontend:** React, TypeScript, Vite, TanStack Query, Tailwind CSS, Shadcn UI, Wouter
*   **Backend:** Node.js, Express, TypeScript, tsx
*   **Database:** SQLite
*   **ORM:** Drizzle ORM
*   **Authentication:** Passport.js, express-session, better-sqlite3-session-store
*   **File Uploads:** Multer
*   **OCR:** Google Gemini API, OpenAI Vision API, Anthropic Claude API, OpenRouter (via external APIs)
*   **Excel Export:** XLSX

## Setup and Running

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Variables (Backend):**
    *   For the backend server to use external OCR APIs (Gemini, OpenAI, Claude, OpenRouter), you **must** set the corresponding API keys as environment variables when starting the server process. The recommended way is to create a `.env` file in the project root:
        ```dotenv
        # .env file examples (use your actual keys)
        GEMINI_API_KEY=YOUR_GEMINI_API_KEY
        OPENAI_API_KEY=YOUR_OPENAI_API_KEY
        ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
        OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY

        # Optional: Session Secret (defaults to 'expense-tracker-secret')
        SESSION_SECRET=your_super_secret_session_key
        ```
    *   The `npm run dev` command (using `tsx`) might not automatically load `.env` files. You might need to use a package like `dotenv` explicitly in `server/index.ts` or prefix your start command (e.g., `dotenv tsx server/index.ts`). Alternatively, set system environment variables.
4.  **Configure OCR in App Settings (Frontend):**
    *   After logging in, go to the Settings page.
    *   Select the desired OCR Method (e.g., "Google Gemini").
    *   Select the desired OCR Template ("General Receipt" or "Travel Expenses").
    *   Optionally, enter the API key in the "API Key" field *for frontend testing/verification only*. This key is **not** used for the main expense creation OCR process; the backend uses the keys set via environment variables.
    *   Click "Save Settings". Your chosen method and template preferences are saved in your browser's local storage and will persist.
4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This command starts both the backend server and the Vite frontend development server. The application will be available at `http://localhost:5000` (or the port Vite chooses, usually 5173, proxied by the backend). The backend API runs on port 5000.
5.  **Database:** The SQLite database file (`sqlite.db`) and migrations (`./migrations`) will be automatically created/updated in the project root directory upon the first server start.

## Notes

*   This project was migrated from an in-memory storage solution to use SQLite for data persistence.
*   PDF files are processed using the configured vision APIs (Gemini, OpenAI, Claude, OpenRouter) directly, bypassing potentially problematic local text extraction libraries.
*   Local OCR (Tesseract.js) functionality has been removed.