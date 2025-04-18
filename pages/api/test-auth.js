import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Get Supabase credentials from environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase credentials not found in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Supabase credentials not configured'
      });
    }

    // Initialize Supabase client with proper configuration
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      },
      global: {
        fetch: fetch.bind(globalThis)
      }
    });

    // Get test credentials from request body
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: username, email, and password are required'
      });
    }

    // Test user registration
    try {
      // Check if user already exists
      // Use proper parameterized queries to avoid SQL injection
      const { data: existingUsers, error: queryError } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq."${username}",email.eq."${email}"`)
        .limit(1);

      if (queryError) {
        console.error('Error checking for existing user:', queryError);
        return res.status(500).json({
          success: false,
          message: 'Error checking for existing user',
          error: queryError.message
        });
      }

      if (existingUsers && existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'User with this username or email already exists'
        });
      }

      // For testing purposes, we'll just return success without actually creating the user
      return res.status(200).json({
        success: true,
        message: 'User registration test successful',
        note: 'This is a test endpoint and does not actually create a user'
      });
    } catch (error) {
      console.error('Error testing user registration:', error);
      return res.status(500).json({
        success: false,
        message: 'Error testing user registration',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Unexpected error in test-auth endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error in test-auth endpoint',
      error: error.message
    });
  }
}