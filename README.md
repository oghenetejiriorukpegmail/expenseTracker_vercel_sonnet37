# Expense Tracker Application

A full-stack expense tracking application with receipt OCR processing, trip management, and mileage logging capabilities. This application is optimized for Vercel deployment with serverless API routes.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Foghenetejiriorukpegmail%2FexpenseTracker_vercel_sonnet37)

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

### Detailed Deployment Steps

1. **Prepare Your Repository**
   - Fork or clone this repository to your GitHub account
   - Push any changes you've made to your repository

2. **Connect to Vercel**
   - Log in to your Vercel account
   - Click "Add New" > "Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure Project Settings**
   - Project Name: Choose a name for your project
   - Framework Preset: Select "Next.js"
   - Root Directory: Leave as default (/)
   - Build Command: Leave as default (next build)
   - Output Directory: Leave as default (.next)

4. **Configure Environment Variables**
   - In the Vercel project settings, go to the "Environment Variables" tab
   - Add all the required environment variables listed above
   - Make sure to set the correct values for your Supabase project

5. **Deploy the Application**
   - Click "Deploy"
   - Wait for the build and deployment to complete
   - Once deployed, Vercel will provide you with a URL for your application

6. **Run Database Migrations**
   - After deployment, you need to run the database migrations
   - Install Vercel CLI: `npm i -g vercel`
   - Log in to Vercel CLI: `vercel login`
   - Pull environment variables: `vercel env pull .env.local`
   - Run migrations: `npm run db:migrate`

7. **Verify Deployment**
   - Visit your application URL
   - Register a new account
   - Test the core functionality (adding expenses, trips, etc.)

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

## Project Structure

```
├── api/                  # API routes (serverless functions)
│   ├── _lib/             # Shared library code for API routes
│   ├── auth/             # Authentication endpoints
│   ├── expenses/         # Expense management endpoints
│   ├── mileage-logs/     # Mileage logging endpoints
│   ├── ocr/              # OCR processing endpoints
│   ├── settings/         # Settings management endpoints
│   └── trips/            # Trip management endpoints
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   └── pages/        # Page components
├── migrations/           # Database migration files
├── scripts/              # Utility scripts
└── shared/               # Shared code between frontend and API
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Log in a user
- `POST /api/auth/logout` - Log out a user
- `GET /api/auth/user` - Get current user information
- `PUT /api/auth/update-profile` - Update user profile
- `PUT /api/auth/change-password` - Change user password

### Trips
- `GET /api/trips` - Get all trips
- `POST /api/trips` - Create a new trip
- `GET /api/trips/[id]` - Get a specific trip
- `PUT /api/trips/[id]` - Update a trip
- `DELETE /api/trips/[id]` - Delete a trip

### Expenses
- `GET /api/expenses` - Get all expenses
- `POST /api/expenses` - Create a new expense
- `GET /api/expenses/[id]` - Get a specific expense
- `PUT /api/expenses/[id]` - Update an expense
- `DELETE /api/expenses/[id]` - Delete an expense
- `POST /api/expenses/upload` - Upload a receipt
- `POST /api/expenses/batch-process` - Process multiple expenses
- `GET /api/expenses/export` - Export expenses to Excel

### Mileage Logs
- `GET /api/mileage-logs` - Get all mileage logs
- `POST /api/mileage-logs` - Create a new mileage log
- `GET /api/mileage-logs/[id]` - Get a specific mileage log
- `PUT /api/mileage-logs/[id]` - Update a mileage log
- `DELETE /api/mileage-logs/[id]` - Delete a mileage log
- `POST /api/mileage-logs/upload-odometer` - Upload an odometer image

### OCR
- `POST /api/ocr/process` - Process an image with OCR

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Verify your DATABASE_URL is correct
   - Check if your IP is allowed in Supabase's database settings
   - Ensure your database is not paused (free tier limitation)

2. **Storage Issues**
   - Verify your SUPABASE_URL and SUPABASE_SERVICE_KEY
   - Check if the storage buckets exist and have correct permissions
   - Ensure you haven't exceeded storage limits

3. **OCR Processing Issues**
   - Verify your OCR API keys
   - Check if you've set DEFAULT_OCR_METHOD correctly
   - Ensure the image format is supported (JPEG, PNG, PDF)

4. **Deployment Issues**
   - Check Vercel build logs for errors
   - Verify all environment variables are set correctly
   - Ensure your project is compatible with Vercel's serverless architecture

### Getting Help

If you encounter issues not covered here, please:
1. Check the GitHub repository issues
2. Create a new issue with detailed information about your problem
3. Include error messages, screenshots, and steps to reproduce

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT