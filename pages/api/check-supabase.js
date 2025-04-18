import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Get Supabase credentials from environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase credentials not found in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Supabase credentials not configured'
      });
    }

    // Initialize Supabase client
    // Initialize Supabase client with proper configuration
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      },
      global: {
        fetch: fetch.bind(globalThis)
      }
    });

    try {
      // Test connection by making a simple query
      const { data, error } = await supabase
        .from('users')
        .select('count', { count: 'exact' })
        .limit(1);

      if (error) {
        console.error('Supabase connection error:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      console.log('Supabase connection successful');
      return res.status(200).json({
        success: true
      });
    } catch (error) {
      console.error('Error querying Supabase:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  } catch (error) {
    console.error('Unexpected error checking Supabase connection:', error);
    return res.status(500).json({
      success: false,
      error: 'Unexpected error checking Supabase connection'
    });
  }
}