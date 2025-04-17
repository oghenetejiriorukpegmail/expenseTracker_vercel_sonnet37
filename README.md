# Expense Tracker Application

A full-stack expense tracking application with receipt image upload and OCR processing capabilities.

## Features

- User authentication and authorization
- Trip management
- Expense tracking with receipt uploads
- OCR processing of receipt images to extract expense information
- Mileage tracking
- Data export

## Technology Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Supabase Storage
- **OCR**: Multiple providers supported (Gemini, OpenAI, Claude, OpenRouter)
- **Containerization**: Docker, Docker Compose

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Supabase account for storage (or self-hosted Supabase)
- At least one OCR API key (Gemini, OpenAI, Claude, or OpenRouter)

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```
# Database Configuration
DATABASE_URL=your_postgres_connection_string_here

# JWT Authentication
JWT_SECRET=your_secure_jwt_secret_here
JWT_EXPIRY=7d

# Supabase Storage
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# OCR API Keys (at least one is required)
GEMINI_API_KEY=your_gemini_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
# OPENROUTER_API_KEY=your_openrouter_api_key_here

# OCR Settings
DEFAULT_OCR_METHOD=gemini
OCR_TEMPLATE=general

# Node Environment
NODE_ENV=production
```

## Configuration

Create an `app-config.json` file in the root directory:

```json
{
  "ocrApiKeys": {
    "gemini": "your_gemini_api_key_here"
  },
  "defaultOcrMethod": "gemini",
  "ocrTemplate": "travel"
}
```

## Installation

### Option 1: Local Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Build the application:
   ```
   npm run build
   ```

3. Run database migrations:
   ```
   npm run db:migrate
   ```

4. Start the application in production mode:
   ```
   npm run start:prod
   ```

### Option 2: Docker Installation

1. Make sure Docker and Docker Compose are installed on your system.

2. Build and start the containers:
   ```
   docker-compose up -d
   ```

3. The application will be available at http://localhost:5000

## Development

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. In a separate terminal, start the Express server:
   ```
   npm run start:server
   ```

## Testing OCR with Sample Receipt

The application includes a sample receipt image (`Receipt sample.jpg`) that you can use to test the OCR functionality:

1. Log in to the application
2. Create a new trip
3. Add a new expense and upload the sample receipt
4. Enable OCR processing to extract information from the receipt

## License

MIT