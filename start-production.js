#!/usr/bin/env node

/**
 * Production startup script for the Expense Tracker application
 * This script performs pre-flight checks and starts the application in production mode
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
console.log('Loading environment variables...');
dotenv.config();

// Check for required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`FATAL ERROR: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Check if at least one OCR API key is available
const ocrApiKeys = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'];
const hasOcrApiKey = ocrApiKeys.some(key => !!process.env[key]);
if (!hasOcrApiKey) {
  console.error('FATAL ERROR: At least one OCR API key is required in production.');
  process.exit(1);
}

// Check if app-config.json exists
const configPath = path.join(process.cwd(), 'app-config.json');
if (!fs.existsSync(configPath)) {
  console.error('FATAL ERROR: app-config.json not found. Please create this file with your configuration.');
  process.exit(1);
}

// Check if the config file is valid JSON
try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  JSON.parse(configContent);
  console.log('Configuration file is valid.');
} catch (error) {
  console.error('FATAL ERROR: app-config.json is not valid JSON:', error.message);
  process.exit(1);
}

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';
console.log('Setting NODE_ENV to production');

// Check if the build exists
const buildPath = path.join(process.cwd(), '.next');
if (!fs.existsSync(buildPath)) {
  console.log('Next.js build not found. Running build...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('Build completed successfully.');
  } catch (error) {
    console.error('FATAL ERROR: Build failed:', error.message);
    process.exit(1);
  }
}

// Check if migrations need to be run
console.log('Checking database migrations...');
try {
  execSync('npm run db:migrate', { stdio: 'inherit' });
  console.log('Database migrations completed successfully.');
} catch (error) {
  console.error('FATAL ERROR: Database migrations failed:', error.message);
  process.exit(1);
}

// Start the application
console.log('Starting the application in production mode...');
try {
  // Start both the Next.js frontend and Express backend using the same approach as development
  execSync('npm run start:all', { stdio: 'inherit' });
} catch (error) {
  console.error('Application crashed:', error.message);
  process.exit(1);
}