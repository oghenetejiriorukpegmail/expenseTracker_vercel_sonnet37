# Expense Tracker Application

A full-stack web application for tracking personal or business expenses, organized by trips. Built with React, Node.js, Express, TypeScript, and SQLite.

## Features

*   **User Authentication:** Secure user registration and login using Passport.js and persistent sessions stored in SQLite.
*   **Trip Management:** Create, view, update, and delete trips to categorize expenses.
*   **Expense Tracking:** Add, view, update, and delete expenses associated with specific trips.
*   **Receipt Upload:** Upload receipt images (JPG, PNG, GIF) or PDF files for expenses.
*   **OCR Receipt Processing:** Automatically extract data (vendor, date, total, etc.) from uploaded receipts using various OCR services (Google Gemini, OpenAI Vision, Anthropic Claude, Tesseract.js).
    *   PDFs are processed directly using vision APIs (Gemini recommended).
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
*   **OCR:** Google Gemini API, OpenAI Vision API, Anthropic Claude API, Tesseract.js (via node-fetch/external APIs or local processing)
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
3.  **Environment Variables:**
    *   Create a `.env` file in the project root (optional, but recommended for API keys).
    *   Add your API keys for the desired OCR services (the app will check `process.env`):
        ```dotenv
        # Example for Gemini
        GEMINI_API_KEY=YOUR_GEMINI_API_KEY

        # Example for OpenAI
        OPENAI_API_KEY=YOUR_OPENAI_API_KEY

        # Example for Anthropic Claude
        ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY

        # Example for OpenRouter
        OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY

        # Optional: Session Secret (defaults to 'expense-tracker-secret')
        # SESSION_SECRET=your_super_secret_session_key
        ```
    *   Configure the desired OCR method and enter the corresponding API key in the application's Settings page after logging in.
4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This command starts both the backend server and the Vite frontend development server. The application will be available at `http://localhost:5000` (or the port Vite chooses, usually 5173, proxied by the backend). The backend API runs on port 5000.
5.  **Database:** The SQLite database file (`sqlite.db`) and migrations (`./migrations`) will be automatically created/updated in the project root directory upon the first server start.

## Notes

*   This project was migrated from an in-memory storage solution to use SQLite for data persistence.
*   PDF files are processed using vision APIs (Gemini, OpenAI, Claude) directly, bypassing potentially problematic local text extraction libraries.