// Configuration utility for the application

// Define the configuration interface
export interface AppConfig {
  // OCR settings
  defaultOcrMethod: string;
  ocrTemplate: string;
  
  // Database settings
  databaseUrl: string;
  
  // Authentication settings
  jwtSecret: string;
  jwtExpiry: string;
  
  // Storage settings
  supabaseUrl: string;
  supabaseServiceKey: string;
  
  // API keys for OCR services
  openaiApiKey?: string;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  openrouterApiKey?: string;
}

// Load configuration from environment variables
export function loadConfig(): AppConfig {
  return {
    // OCR settings
    defaultOcrMethod: process.env.DEFAULT_OCR_METHOD || 'gemini',
    ocrTemplate: process.env.OCR_TEMPLATE || 'general',
    
    // Database settings
    databaseUrl: process.env.DATABASE_URL || '',
    
    // Authentication settings
    jwtSecret: process.env.JWT_SECRET || 'expense-tracker-jwt-secret',
    jwtExpiry: process.env.JWT_EXPIRY || '7d',
    
    // Storage settings
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
    
    // API keys for OCR services
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
  };
}

// Validate required configuration
export function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check database URL
  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required');
  }
  
  // Check JWT secret
  if (!config.jwtSecret) {
    errors.push('JWT_SECRET is required');
  }
  
  // Check Supabase settings if using Supabase storage
  if (!config.supabaseUrl) {
    errors.push('SUPABASE_URL is required for file storage');
  }
  
  if (!config.supabaseServiceKey) {
    errors.push('SUPABASE_SERVICE_KEY is required for file storage');
  }
  
  // Check if at least one OCR API key is available
  const hasOcrApiKey = !!(
    config.openaiApiKey || 
    config.geminiApiKey || 
    config.anthropicApiKey || 
    config.openrouterApiKey
  );
  
  if (!hasOcrApiKey) {
    errors.push('At least one OCR API key is required (OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Get the available OCR methods based on configured API keys
export function getAvailableOcrMethods(config: AppConfig): string[] {
  const methods: string[] = [];
  
  if (config.openaiApiKey) methods.push('openai');
  if (config.geminiApiKey) methods.push('gemini');
  if (config.anthropicApiKey) methods.push('claude');
  if (config.openrouterApiKey) methods.push('openrouter');
  
  return methods;
}

// Update OCR API key in environment variables
export function updateOcrApiKey(method: string, apiKey: string): void {
  switch (method) {
    case 'openai':
      process.env.OPENAI_API_KEY = apiKey;
      break;
    case 'gemini':
      process.env.GEMINI_API_KEY = apiKey;
      break;
    case 'claude':
      process.env.ANTHROPIC_API_KEY = apiKey;
      break;
    case 'openrouter':
      process.env.OPENROUTER_API_KEY = apiKey;
      break;
    default:
      throw new Error(`Unknown OCR method: ${method}`);
  }
}

// Set default OCR method
export function setDefaultOcrMethod(method: string): void {
  process.env.DEFAULT_OCR_METHOD = method;
}

// Set OCR template
export function setOcrTemplate(template: string): void {
  process.env.OCR_TEMPLATE = template;
}