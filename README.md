# Expense Tracker Application

A full-stack expense tracking application with receipt OCR processing, trip management, and mileage logging capabilities.

## Features

- User authentication with JWT
- Trip management
- Expense tracking with receipt uploads
- OCR processing for receipts
- Mileage logging
- Data export to Excel
- Responsive UI with dark/light mode

## Tech Stack

- **Frontend**: React, TailwindCSS, Shadcn UI components
- **Backend**: Next.js API routes (serverless functions)
- **Database**: PostgreSQL via Supabase (using Drizzle ORM)
- **Authentication**: JWT-based authentication
- **File Storage**: Supabase Storage
- **OCR Processing**: Multiple providers supported (OpenAI, Google Gemini, Anthropic Claude, OpenRouter)
- **Deployment**: Vercel

## Deployment to Vercel

### Prerequisites

1. A Vercel account (free tier is sufficient)
2. A Supabase account (free tier is sufficient)
3. At least one API key for OCR processing (OpenAI, Google Gemini, Anthropic Claude, or OpenRouter)

### Setup Supabase

1. Create a new Supabase project
2. Create a PostgreSQL database using the SQL schema in the `migrations` directory
3. Create two storage buckets:
   - `receipts` - for storing receipt images
   - `odometer-images` - for storing odometer images
4. Set the appropriate permissions for the buckets (authenticated users can read/write)
5. Get your Supabase URL and service key from the project settings

### Environment Variables

Set the following environment variables in your Vercel project:

```
# Database
DATABASE_URL=postgres://username:password@host:port/database

# Authentication
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRY=7d

# Supabase Storage
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key

# OCR API Keys (at least one is required)
OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENROUTER_API_KEY=your-openrouter-api-key

# OCR Settings
DEFAULT_OCR_METHOD=gemini
OCR_TEMPLATE=general

# Node Environment
NODE_ENV=production
```

### Deployment Steps

1. Fork or clone this repository
2. Connect your GitHub repository to Vercel
3. Configure the environment variables in the Vercel project settings
4. Deploy the application
5. After deployment, run the database migrations:
   ```
   npx vercel env pull .env.local
   npm run db:migrate
   ```

### Free Tier Limitations

When using the free tiers of Vercel and Supabase, be aware of the following limitations:

#### Vercel Free Tier Limitations
- Serverless Function Execution: Limited to 10-60 seconds
- Serverless Function Size: Limited bundle size
- Bandwidth: Limited monthly bandwidth
- Build Duration: Limited build minutes per month

#### Supabase Free Tier Limitations
- Database Size: Limited to 500MB
- Storage: Limited to 1GB
- Bandwidth: Limited egress bandwidth
- Concurrent Connections: Limited number of database connections

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example`
4. Run the database migrations: `npm run db:migrate`
5. Start the development server: `npm run dev`
6. Open [http://localhost:3000](http://localhost:3000) in your browser

## License

MIT